#!/usr/bin/env bash
set -euo pipefail

STANDALONE_DIR=".next/standalone"

if [ ! -d ".next" ]; then
  echo "Missing .next build output. Run next build first." >&2
  exit 1
fi

mkdir -p "$STANDALONE_DIR/.next"

if [ -d ".next/static" ]; then
  rm -rf "$STANDALONE_DIR/.next/static"
  cp -R ".next/static" "$STANDALONE_DIR/.next/static"
fi

if [ -d "public" ]; then
  rm -rf "$STANDALONE_DIR/public"
  cp -R "public" "$STANDALONE_DIR/public"
fi

echo "Standalone assets copied."
