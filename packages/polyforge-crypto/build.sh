#!/bin/bash
cd "$(dirname "$0")"
wasm-pack build --target nodejs --release
# Copy to a predictable location
cp -r pkg/ ../../node_modules/polyforge-crypto/ 2>/dev/null || true
echo "WASM crypto module built successfully"
