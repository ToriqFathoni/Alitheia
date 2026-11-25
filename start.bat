@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Alitheia

echo ==============================================
echo   Alitheia - menjalankan backend dan frontend
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

echo Membangun dan menjalankan container. Build pertama bisa beberapa menit...
echo.
docker compose up -d --build --wait
if errorlevel 1 (
  echo.
  echo [GAGAL] Ada container yang tidak sehat. Log terakhir:
  docker compose logs --tail=40 api web
  echo.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo   Siap digunakan
echo   Aplikasi : http://localhost:3001
echo   API      : http://localhost:5000/api/v1/health
echo   Matikan  : jalankan stop.bat
echo ==============================================
start "" http://localhost:3001
pause
