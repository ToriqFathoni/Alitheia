#!/usr/bin/env bash
# Menjalankan Alitheia (backend + frontend) lewat Docker. Untuk Linux/macOS.
set -euo pipefail
cd "$(dirname "$0")"

if ! docker info >/dev/null 2>&1; then
  echo "[GAGAL] Docker belum berjalan. Nyalakan Docker lalu coba lagi."
  exit 1
fi

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

echo "Membangun dan menjalankan container..."
if ! docker compose up -d --build --wait; then
  echo "[GAGAL] Ada container yang tidak sehat. Log terakhir:"
  docker compose logs --tail=40 api web
  exit 1
fi

echo
echo "Siap digunakan"
echo "  Aplikasi : http://localhost:3001"
echo "  API      : http://localhost:5000/api/v1/health"
echo "  Matikan  : docker compose down"
