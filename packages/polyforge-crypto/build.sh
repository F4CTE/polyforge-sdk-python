#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Skip build if wasm-pack is not installed (e.g. CI without Rust toolchain)
if ! command -v wasm-pack &>/dev/null; then
  echo "⚠ wasm-pack not found — skipping WASM crypto build"
  # Ensure pre-built pkg/ artifacts are present
  if [ -d "pkg" ]; then
    echo "Using pre-built WASM artifacts from pkg/"
    exit 0
  else
    echo "ERROR: No pre-built WASM artifacts and no wasm-pack. Run 'cargo install wasm-pack' first."
    exit 1
  fi
fi

echo "Building polyforge-crypto WASM module..."
wasm-pack build --target nodejs --release
# Copy to a predictable location
cp -r pkg/ ../../node_modules/polyforge-crypto/ 2>/dev/null || true
echo "WASM crypto module built successfully"
