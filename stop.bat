@echo off
cd /d "%~dp0"
docker compose --profile tunnel --profile tunnel-named --profile worker down
echo.
echo Semua container Alitheia dimatikan. Data tetap tersimpan.
pause
