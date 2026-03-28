# @polyforge/engine

Rust-based WebAssembly trading engine evaluation module.

## Overview

This package provides performance-critical trading block evaluation logic compiled to WebAssembly from Rust using `wasm-pack`. It runs in Node.js environments (not browsers).

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

The module exports the main evaluation function:

- `evaluate_tick(safety_json, triggers_json, conditions_json, actions_json, context_json)` - Core trading engine evaluation

This function implements a multi-stage evaluation pipeline:
1. **Safety checks** - Verify stop-loss, max exposure, and other safety limits
2. **Trigger evaluation** - Determine if the rule should fire (price levels, spreads, etc.)
3. **Condition checks** - Verify prerequisites are met (liquidity, spread constraints, position limits)
4. **Action building** - Generate the list of trading actions if all checks pass

## Build Configuration

- **Source**: `src/lib.rs` (Rust source)
- **Manifest**: `Cargo.toml` (Rust dependencies and build config)
- **Output**: `pkg/` (wasm-pack generated JavaScript bindings and WASM binary)
- **crate-type**: `cdylib` (dynamic library for WASM)
- **Release profile**: Optimized for performance (`opt-level = 3`, LTO enabled)
