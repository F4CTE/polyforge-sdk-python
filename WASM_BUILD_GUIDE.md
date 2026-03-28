# WASM & Native Module Build Guide

This document explains the WASM and native module build configuration for polyForge after M11 fixes.

## Overview

polyForge includes three performance-critical modules written in Rust:

1. **@polyforge/crypto** - WebAssembly cryptographic operations
2. **@polyforge/engine** - WebAssembly trading engine evaluation
3. **@polyforge/crypto-native** - Node.js native addon (NAPI) for cryptography

## Build System Changes (M11 Fixes)

### Issue 1: Missing wasm-pack Dependency

**Problem**: `wasm-pack` was not listed in devDependencies, causing build failures.

**Solution**: Added `wasm-pack@^1.3.4` and `@napi-rs/cli@^2.18.0` to root `package.json` devDependencies.

### Issue 2: Incorrect Package.json Exports

**Problem**: WASM packages had `"main": "index.ts"` and `"build": "tsc"`, but:
- These packages don't produce `.ts` files for consumers
- TypeScript compilation isn't the build step for WASM modules
- Exports pointed to non-existent main entry points

**Solution**: Updated both packages to:
- Point `main` to the actual WASM output: `./pkg/polyforge_crypto.js`
- Added proper `types` and `exports` fields for proper module resolution
- Changed `build` script to run `bash build.sh` (wasm-pack) instead of `tsc`

### Issue 3: WASM Packages in Turbo Pipeline

**Problem**: turbo.json's `build` task ran against WASM packages expecting `dist/**` output, but they produce `pkg/**` instead.

**Solution**:
- Added `"excludePaths"` to the `build` task to skip WASM packages
- Created dedicated `build:wasm` task with correct outputs (`pkg/**`, `*.node`)
- Added `globalDependencies` declaration for `wasm-pack` and `cargo` to ensure they're available

## Building Locally

### Prerequisites

- Node.js >= 20.0.0
- Rust toolchain with `cargo`
- wasm-pack installed (via `pnpm install` in root)

### Build WASM Modules

```bash
# Option 1: From package directory
cd packages/polyforge-crypto
bash build.sh

# Option 2: Using npm
cd packages/polyforge-crypto
npm run build:wasm

# Option 3: From root (manual)
pnpm install
cargo install wasm-pack  # if not already installed
cd packages/polyforge-crypto
wasm-pack build --target nodejs --release
```

Similarly for `@polyforge/engine`:

```bash
cd packages/polyforge-engine
npm run build:wasm
```

### Build Native Module

```bash
cd packages/polyforge-crypto-native
npm run build        # release build
npm run build:debug  # debug build
```

## Package Configuration

### @polyforge/crypto

- **Source**: `src/lib.rs` (Rust)
- **Build**: `wasm-pack build --target nodejs --release`
- **Output**: `pkg/polyforge_crypto.js` + `polyforge_crypto_bg.wasm`
- **Main entry**: `./pkg/polyforge_crypto.js`
- **Function**: AES-256-GCM, SHA-256, HMAC-SHA256, random bytes, constant-time comparison

### @polyforge/engine

- **Source**: `src/lib.rs` (Rust)
- **Build**: `wasm-pack build --target nodejs --release`
- **Output**: `pkg/polyforge_engine.js` + `polyforge_engine_bg.wasm`
- **Main entry**: `./pkg/polyforge_engine.js`
- **Function**: Multi-stage trading rule evaluation (safety → triggers → conditions → actions)

### @polyforge/crypto-native

- **Source**: `src/lib.rs` (Rust with NAPI bindings)
- **Build**: `napi build --platform --release`
- **Output**: Platform-specific `.node` file
- **Main entry**: `./index.js` (which loads the correct `.node` for current platform)

## Import Usage

After building:

```typescript
// @polyforge/crypto (WASM)
import { aesEncrypt, sha256, hmacSha256 } from '@polyforge/crypto';

// @polyforge/engine (WASM)
import { evaluateTick } from '@polyforge/engine';

// @polyforge/crypto-native (Native addon)
const nativeModule = require('@polyforge/crypto-native');
```

## CI/CD Integration

For CI/CD pipelines:

1. **Ensure Rust is installed** in the CI environment
2. **Run WASM builds before standard builds**:
   ```bash
   cd packages/polyforge-crypto && npm run build:wasm
   cd packages/polyforge-engine && npm run build:wasm
   cd packages/polyforge-crypto-native && npm run build
   ```
3. **Then run normal build**: `pnpm run build` (which now excludes WASM packages)

Or in turbo: `turbo run build:wasm build`

## Troubleshooting

### "wasm-pack not found"
- Ensure root `pnpm install` completed successfully
- Run `cargo install wasm-pack` if needed

### "Rust toolchain not found"
- Install from https://rustup.rs/

### WASM module failing to load at runtime
- Verify `pkg/polyforge_crypto.js` and `.wasm` file exist
- Check that module was built with matching target (`--target nodejs`)

### Native module build fails
- Ensure Rust can build for your platform: `rustup target add x86_64-unknown-linux-gnu` (or appropriate target)
- Check NAPI CLI version matches: `@napi-rs/cli@^2.18.0`

## See Also

- `/packages/polyforge-crypto/README.md` - Crypto module docs
- `/packages/polyforge-engine/README.md` - Engine module docs
- `/packages/polyforge-crypto-native/README.md` - Native module docs
