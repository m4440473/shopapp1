#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy --skip-generate

  echo "Ensuring Prisma client is generated..."
  npx prisma generate
else
  echo "DATABASE_URL not set; skipping Prisma migrations."
fi

exec "$@"
