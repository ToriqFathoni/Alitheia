#!/usr/bin/env bash
# Menjalankan backend Alitheia lewat Docker + Cloudflare Tunnel, lalu mencetak
# tautan frontend (Vercel) yang sudah terhubung ke backend ini.
#
#   ./start.sh        -> API + database + tunnel   (frontend dipakai dari Vercel)
#   ./start.sh web    -> sama, ditambah frontend lokal di http://localhost:3001
set -euo pipefail
cd "$(dirname "$0")"

WITH_WEB=0
[ "${1:-}" = "web" ] && WITH_WEB=1

if ! docker info >/dev/null 2>&1; then
  echo "[GAGAL] Docker belum berjalan. Nyalakan Docker lalu coba lagi."
  exit 1
fi

# --- .env: API key Gemini ------------------------------------------------------
if [ ! -f .env ]; then
  echo "Pertama kali dijalankan, dibutuhkan API key Gemini."
  echo "Dapatkan gratis di: https://aistudio.google.com/apikey"
  read -r -p "Tempel API key lalu tekan Enter: " KEY
  if [ -z "$KEY" ]; then
    echo "[GAGAL] API key kosong."
    exit 1
  fi
  printf 'GEMINI_API_KEY=%s\nGEMINI_MODEL=gemini-2.5-flash\n' "$KEY" > .env
  echo "File .env dibuat."
fi

# --- .env: alamat frontend di Vercel (untuk CORS) -------------------------------
if ! grep -q '^FRONTEND_URL=.\+' .env; then
  echo
  echo "Masukkan alamat frontend di Vercel, contoh: https://alitheia.vercel.app"
  read -r -p "URL frontend: " FURL
  FURL="${FURL%/}"
  if [ -z "$FURL" ]; then
    echo "[GAGAL] URL frontend kosong."
    exit 1
  fi
  printf '\nFRONTEND_URL=%s\n' "$FURL" >> .env
fi

FRONTEND_URL="$(grep '^FRONTEND_URL=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d '\r')"
FRONTEND_URL="${FRONTEND_URL%/}"

# --- Mode tunnel: permanen (token) atau quick (tanpa akun) ---------------------
NAMED=0
if grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' .env; then
  NAMED=1
  TUNNEL_PROFILE="tunnel-named"
  TUNNEL_SERVICE="tunnel-named"
  TUNNEL_CONTAINER="alitheia-tunnel-named"
else
  TUNNEL_PROFILE="tunnel"
  TUNNEL_SERVICE="tunnel"
  TUNNEL_CONTAINER="alitheia-tunnel"
fi

# --- Jalankan backend ---------------------------------------------------------
SERVICES="api"
[ "$WITH_WEB" -eq 1 ] && SERVICES="api web"

echo
echo "Membangun dan menjalankan backend. Build pertama bisa beberapa menit..."
if ! docker compose up -d --build --wait $SERVICES; then
  echo "[GAGAL] Ada container yang tidak sehat. Log terakhir:"
  docker compose logs --tail=40 $SERVICES
  exit 1
fi

# --- Jalankan tunnel (dibuat ulang agar URL di log selalu yang terbaru) ---------
echo "Menyalakan Cloudflare Tunnel..."
docker compose --profile "$TUNNEL_PROFILE" up -d --force-recreate "$TUNNEL_SERVICE" >/dev/null

if [ "$NAMED" -eq 1 ]; then
  echo
  echo "=============================================="
  echo "  Siap. Tunnel permanen aktif."
  echo "  Frontend: $FRONTEND_URL"
  echo "  (pastikan NEXT_PUBLIC_API_URL di Vercel = Public Hostname tunnel Anda)"
  echo "  Matikan : ./stop.sh"
  echo "=============================================="
  exit 0
fi

TUNNEL_URL=""
for _ in $(seq 1 30); do
  TUNNEL_URL="$(docker logs "$TUNNEL_CONTAINER" 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n1 || true)"
  [ -n "$TUNNEL_URL" ] && break
  sleep 2
done

if [ -z "$TUNNEL_URL" ]; then
  echo "[GAGAL] URL tunnel belum muncul. Log tunnel:"
  docker logs --tail=30 "$TUNNEL_CONTAINER" 2>&1 || true
  exit 1
fi

# Pastikan tunnel benar-benar meneruskan ke API (DNS tunnel butuh beberapa detik).
OK=0
for _ in $(seq 1 15); do
  if curl -fsS "$TUNNEL_URL/api/v1/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 2
done

LINK="$FRONTEND_URL/?api=$TUNNEL_URL"

echo
echo "=============================================="
echo "  Siap digunakan"
echo "  Backend (tunnel) : $TUNNEL_URL"
[ "$OK" -eq 1 ] || echo "  (peringatan: health check tunnel belum merespons, tunggu sebentar lalu coba tautan)"
echo
echo "  Buka tautan ini sekali (alamat backend tersimpan di browser):"
echo "  $LINK"
[ "$WITH_WEB" -eq 1 ] && echo "  Frontend lokal   : http://localhost:3001"
echo
echo "  URL tunnel berubah setiap start.sh dijalankan ulang,"
echo "  jadi buka tautan baru yang dicetak di sini."
echo "  Matikan : ./stop.sh"
echo "=============================================="

if command -v xdg-open >/dev/null 2>&1; then xdg-open "$LINK" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then open "$LINK" >/dev/null 2>&1 || true
fi
