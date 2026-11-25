@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Alitheia

rem Pemakaian:
rem   start.bat       -> API + database + tunnel (frontend dipakai dari Vercel)
rem   start.bat web   -> sama, ditambah frontend lokal di http://localhost:3001

echo ==============================================
echo   Alitheia - backend + Cloudflare Tunnel
echo ==============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
  echo [GAGAL] Docker Desktop belum berjalan.
  echo Buka Docker Desktop, tunggu sampai statusnya siap, lalu jalankan file ini lagi.
  echo.
  pause
  exit /b 1
)

rem --- .env: API key Gemini ---------------------------------------------------
if not exist .env (
  echo Pertama kali dijalankan, dibutuhkan API key Gemini.
  echo Dapatkan gratis di: https://aistudio.google.com/apikey
  echo.
  set "KEY="
  set /p KEY=Tempel API key lalu tekan Enter: 
  if not defined KEY (
    echo [GAGAL] API key kosong. Dibatalkan.
    pause
    exit /b 1
  )
  > .env echo GEMINI_API_KEY=!KEY!
  >> .env echo GEMINI_MODEL=gemini-2.5-flash
  echo File .env dibuat.
  echo.
)

rem --- .env: alamat frontend di Vercel (untuk CORS) ---------------------------
findstr /b /r /c:"FRONTEND_URL=." .env >nul 2>&1
if errorlevel 1 (
  echo Masukkan alamat frontend di Vercel, contoh: https://alitheia.vercel.app
  set "FURL="
  set /p FURL=URL frontend: 
  if not defined FURL (
    echo [GAGAL] URL frontend kosong. Dibatalkan.
    pause
    exit /b 1
  )
  if "!FURL:~-1!"=="/" set "FURL=!FURL:~0,-1!"
  >> .env echo.
  >> .env echo FRONTEND_URL=!FURL!
  echo.
)

set "FRONTEND_URL="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "FRONTEND_URL=" .env`) do set "FRONTEND_URL=%%B"
set "FRONTEND_URL=!FRONTEND_URL:"=!"
if "!FRONTEND_URL:~-1!"=="/" set "FRONTEND_URL=!FRONTEND_URL:~0,-1!"

rem --- Mode tunnel: permanen (token) atau quick (tanpa akun) ------------------
set "NAMED=0"
set "TUNNEL_PROFILE=tunnel"
set "TUNNEL_SERVICE=tunnel"
set "TUNNEL_CONTAINER=alitheia-tunnel"
findstr /b /r /c:"CLOUDFLARE_TUNNEL_TOKEN=." .env >nul 2>&1
if not errorlevel 1 (
  set "NAMED=1"
  set "TUNNEL_PROFILE=tunnel-named"
  set "TUNNEL_SERVICE=tunnel-named"
  set "TUNNEL_CONTAINER=alitheia-tunnel-named"
)

set "SERVICES=api"
if /i "%~1"=="web" set "SERVICES=api web"

rem --- Jalankan backend -------------------------------------------------------
echo Membangun dan menjalankan backend. Build pertama bisa beberapa menit...
echo.
docker compose up -d --build --wait !SERVICES!
if errorlevel 1 (
  echo.
  echo [GAGAL] Ada container yang tidak sehat. Log terakhir:
  docker compose logs --tail=40 !SERVICES!
  echo.
  pause
  exit /b 1
)

rem --- Jalankan tunnel, dibuat ulang agar URL di log selalu yang terbaru ------
echo Menyalakan Cloudflare Tunnel...
docker compose --profile !TUNNEL_PROFILE! up -d --force-recreate !TUNNEL_SERVICE! >nul
if errorlevel 1 (
  echo [GAGAL] Tunnel tidak bisa dijalankan.
  pause
  exit /b 1
)

if "!NAMED!"=="1" (
  echo.
  echo ==============================================
  echo   Siap. Tunnel permanen aktif.
  echo   Frontend: !FRONTEND_URL!
  echo   Pastikan NEXT_PUBLIC_API_URL di Vercel sama dengan Public Hostname tunnel Anda.
  echo   Matikan : jalankan stop.bat
  echo ==============================================
  pause
  exit /b 0
)

set "TUNNEL_URL="
for /l %%i in (1,1,30) do (
  if not defined TUNNEL_URL (
    for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "cmd /c 'docker logs !TUNNEL_CONTAINER! 2>&1' | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1 | ForEach-Object { $_.Matches[0].Value }"`) do set "TUNNEL_URL=%%U"
    if not defined TUNNEL_URL timeout /t 2 /nobreak >nul
  )
)

if not defined TUNNEL_URL (
  echo.
  echo [GAGAL] URL tunnel belum muncul. Log tunnel:
  docker logs --tail=30 !TUNNEL_CONTAINER!
  echo.
  pause
  exit /b 1
)

rem Pastikan tunnel benar-benar meneruskan ke API, DNS tunnel butuh beberapa detik.
set "OK=0"
for /l %%i in (1,1,15) do (
  if "!OK!"=="0" (
    curl.exe -fsS "!TUNNEL_URL!/api/v1/health" >nul 2>&1
    if not errorlevel 1 (
      set "OK=1"
    ) else (
      timeout /t 2 /nobreak >nul
    )
  )
)

set "LINK=!FRONTEND_URL!/?api=!TUNNEL_URL!"

echo.
echo ==============================================
echo   Siap digunakan
echo   Backend, tunnel : !TUNNEL_URL!
if not "!OK!"=="1" echo   Peringatan: health check tunnel belum merespons, tunggu sebentar lalu coba tautan.
echo.
echo   Buka tautan ini sekali, alamat backend tersimpan di browser:
echo   !LINK!
if /i "%~1"=="web" echo   Frontend lokal  : http://localhost:3001
echo.
echo   URL tunnel berubah setiap start.bat dijalankan ulang,
echo   jadi buka tautan baru yang dicetak di sini.
echo   Matikan : jalankan stop.bat
echo ==============================================
start "" "!LINK!"
pause
