#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Building polyforge-engine WASM module..."
wasm-pack build --target nodejs --release

# Copy to a predictable location for the monorepo
cp -r pkg/ ../../node_modules/@polyforge/engine/pkg/ 2>/dev/null || true

echo "WASM engine module built successfully"
