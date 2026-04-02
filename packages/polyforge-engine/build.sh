#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Skip build if wasm-pack is not installed (e.g. CI without Rust toolchain)
if ! command -v wasm-pack &>/dev/null; then
  echo "⚠ wasm-pack not found — skipping WASM engine build"
  exit 0
fi

echo "Building polyforge-engine WASM module..."
wasm-pack build --target nodejs --release

# Copy to a predictable location for the monorepo
cp -r pkg/ ../../node_modules/@polyforge/engine/pkg/ 2>/dev/null || true

echo "WASM engine module built successfully"
