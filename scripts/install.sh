#!/usr/bin/env bash
set -euo pipefail

TARGET="local"
SEED_MODE="basic"
START_APP="false"

usage() {
  cat <<USAGE
ShopApp1 one-step installer

Usage:
  bash scripts/install.sh [--target local|docker] [--seed basic|demo] [--start]

Options:
  --target   Install target. "local" uses npm + Prisma directly, "docker" builds/runs container stack.
  --seed     Seed profile. "basic" = functionality-only baseline data, "demo" = populated showcase data.
  --start    For local target, also start dev server after installation.
  --help     Show this help message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --seed)
      SEED_MODE="${2:-}"
      shift 2
      ;;
    --start)
      START_APP="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "$TARGET" != "local" && "$TARGET" != "docker" ]]; then
  echo "Invalid --target '$TARGET'. Expected local|docker."
  exit 1
fi

if [[ "$SEED_MODE" != "basic" && "$SEED_MODE" != "demo" ]]; then
  echo "Invalid --seed '$SEED_MODE'. Expected basic|demo."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "No .env found. Creating from .env.example..."
  cp .env.example .env
fi

if [[ "$TARGET" == "local" ]]; then
  echo "Installing local dependencies..."
  npm ci

  echo "Generating Prisma client..."
  npx prisma generate

  echo "Applying migrations..."
  npx prisma migrate deploy

  if [[ "$SEED_MODE" == "demo" ]]; then
    echo "Running demo seed + demo passwords..."
    npm run seed:demo
    npm run set-demo-passwords
  else
    echo "Running basic seed..."
    npm run seed:basic
  fi

  if [[ "$START_APP" == "true" ]]; then
    echo "Starting development server..."
    npm run dev
  else
    echo "Local install complete. Run 'npm run dev' to start the app."
  fi
  exit 0
fi

echo "Building Docker image..."
docker build -t shopapp1:latest .

echo "Starting docker stack (sqlite profile)..."
docker compose --profile sqlite up -d

if [[ "$SEED_MODE" == "demo" ]]; then
  echo "Running demo seed + demo passwords inside container..."
  docker compose exec -T shopapp1 npm run seed:demo
  docker compose exec -T shopapp1 npm run set-demo-passwords
else
  echo "Running basic seed inside container..."
  docker compose exec -T shopapp1 npm run seed:basic
fi

echo "Docker install complete. App should be available on http://localhost:3000"
