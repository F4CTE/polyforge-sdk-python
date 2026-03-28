# @polyforge/crypto-native

Node.js native addon for cryptographic operations via NAPI.

## Overview

This package provides platform-specific native modules for cryptographic operations using Node API (NAPI). Unlike the WebAssembly-based `@polyforge/crypto`, this module compiles to `.node` binaries for direct execution and may offer platform-specific optimizations.

## Building

Build the native module with:

```bash
npm run build
```

For debug builds:

```bash
npm run build:debug
```

The build produces platform-specific `.node` files (e.g., `crypto-native.win32-x64-msvc.node` on Windows).

## Dependencies

- **@napi-rs/cli** (required): Installed in the root workspace `devDependencies`
- **Rust/Cargo**: Must be installed on your system
- Node.js >= 20.0.0

## Build Configuration

- **Source**: `src/lib.rs` (Rust source with NAPI bindings)
- **Build script**: `build.rs` (build.rs for custom compilation steps)
- **Manifest**: `Cargo.toml` (Rust dependencies)
- **NAPI module name**: `crypto-native`
- **Platform targets**: Configured in `napi.triples` (currently empty — add specific targets as needed)

## Export

- `index.js` - JavaScript loader for the native module
- `index.d.ts` - TypeScript type definitions

The module automatically selects the correct `.node` file for the current platform at runtime.

## Adding Platform Targets

To support multiple platforms (Windows, Linux, macOS with various architectures), update `package.json`:

```json
"napi": {
  "name": "crypto-native",
  "triples": {
    "defaults": true,
    "additional": ["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc", "aarch64-apple-darwin"]
  }
}
```

Then rebuild with `npm run build --release`.
