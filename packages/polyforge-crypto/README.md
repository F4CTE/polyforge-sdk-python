# @polyforge/crypto

Rust-based WebAssembly cryptographic operations module.

## Overview

This package provides high-performance cryptographic operations compiled to WebAssembly from Rust using `wasm-pack`. It is designed to run in Node.js environments (not browsers).

Security note: There is no JavaScript fallback. If the WASM module fails to load, the process will crash. This is intentional—it ensures we never silently degrade to less secure implementations.

## Building

Build the WASM module with:

```bash
bash build.sh
```

Or use npm:

```bash
npm run build:wasm
```

This runs `wasm-pack build --target nodejs --release` and produces bindings in the `pkg/` directory.

## Dependencies

- **wasm-pack** (required): Installed in the root workspace `devDependencies`
- **Rust/Cargo**: Must be installed on your system
- Node.js >= 20.0.0

## Exports

The module exports the following cryptographic functions:

- `aes_encrypt(plaintext, keyHex)` - AES-256-GCM encryption
- `aes_decrypt(ciphertext, iv, tag, keyHex)` - AES-256-GCM decryption
- `sha256(input)` - SHA-256 hashing
- `hmac_sha256(message, secret)` - HMAC-SHA256 signing
- `hmac_verify(message, secret, expected)` - Constant-time HMAC verification
- `random_bytes(length)` - Cryptographically secure random bytes
- `constant_time_eq(a, b)` - Constant-time string comparison

See `index.ts` for the JavaScript wrapper and TypeScript types.

## Build Configuration

- **Source**: `src/lib.rs` (Rust source)
- **Manifest**: `Cargo.toml` (Rust dependencies and build config)
- **Output**: `pkg/` (wasm-pack generated JavaScript bindings and WASM binary)
- **crate-type**: `cdylib` (dynamic library for WASM)
- **Release profile**: Optimized for size (`opt-level = "z"`, LTO enabled, stripped)
