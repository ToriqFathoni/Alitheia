#!/usr/bin/env bash
# Mematikan semua container Alitheia (data database tetap tersimpan).
set -euo pipefail
cd "$(dirname "$0")"
docker compose --profile tunnel --profile tunnel-named --profile worker down
echo "Semua container Alitheia dimatikan. Data tetap tersimpan."
