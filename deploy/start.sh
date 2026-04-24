#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy deploy/env.production.example to .env.production and edit it first."
  exit 1
fi

cd "$ROOT_DIR"

set -a
source "$ENV_FILE"
set +a

exec npm start
