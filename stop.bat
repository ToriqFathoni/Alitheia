@echo off
cd /d "%~dp0"
docker compose down
echo.
echo Semua container Alitheia dimatikan. Data tetap tersimpan.
pause
