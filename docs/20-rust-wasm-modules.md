# Rust WASM Modules

Polyforge uses Rust compiled to WebAssembly for CPU-intensive operations that benefit from zero GC pauses, deterministic performance, and near-native speed. All WASM modules live under `packages/` and follow the same conventions.

## Build Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (`cargo install wasm-pack`)

---

## Module: `polyforge-crypto`

**Package:** `@polyforge/crypto` (`packages/polyforge-crypto/`)

---

## Why Rust WASM for Cryptography

Polyforge handles sensitive operations — HMAC signature verification for webhooks, AES encryption for stored credentials, password hashing, and token comparison. Rust provides:

- **Memory safety without garbage collection** — secrets are never left in heap fragments after use
- **No timing side-channels** — Rust's type system and explicit control over memory layout prevent common timing attack vectors
- **Constant-time comparison** — implemented at the byte level without optimizer interference
- **Deterministic resource cleanup** — RAII ensures key material is dropped predictably

The WASM module compiles with `opt-level = "z"` and LTO for minimal binary size while retaining all safety guarantees.

---

## Module Architecture

```
packages/polyforge-crypto/
├── Cargo.toml              # Rust dependencies (aes-gcm, sha2, hmac, rand)
├── src/lib.rs              # Rust WASM functions (wasm-bindgen exports)
├── build.sh                # Build script (wasm-pack)
├── index.ts                # TypeScript wrapper with Node.js crypto fallback
├── package.json            # @polyforge/crypto package config
├── tsconfig.json           # TypeScript compilation config
├── crypto.spec.ts          # Vitest test suite
└── pkg/                    # Generated WASM output (after build)
```

### Dual-mode operation

The TypeScript wrapper (`index.ts`) attempts to load the compiled WASM module at startup. If the WASM binary is not available (e.g., Rust toolchain not installed), it falls back to Node.js `crypto` module equivalents. This ensures the package works in all environments:

| Environment | Backend | Performance |
|---|---|---|
| WASM built | Rust (aes-gcm, sha2, hmac) | Optimal — memory-safe crypto |
| WASM not built | Node.js crypto (OpenSSL) | Good — standard Node.js performance |

---

## Available Functions

| Function | Signature | Description |
|---|---|---|
| `aesEncrypt` | `(plaintext: string, keyHex: string) => { ciphertext, iv, tag }` | AES-256-GCM encryption with random 12-byte IV |
| `aesDecrypt` | `(ciphertextHex, ivHex, tagHex, keyHex) => string` | AES-256-GCM authenticated decryption |
| `sha256` | `(input: string) => string` | SHA-256 hash (hex output) |
| `hmacSha256` | `(message: string, secret: string) => string` | HMAC-SHA256 signature (hex output) |
| `hmacVerify` | `(message, secret, expectedHex) => boolean` | Constant-time HMAC verification |
| `randomBytes` | `(length: number) => string` | CSPRNG random bytes (hex output) |
| `constantTimeEq` | `(a: string, b: string) => boolean` | Constant-time string comparison |

---

## Build Instructions

### Prerequisites

- Rust toolchain (`rustup` — https://rustup.rs)
- `wasm-pack` (`cargo install wasm-pack`)

### Building the WASM module

```bash
cd packages/polyforge-crypto
bash build.sh
```

This produces the `pkg/` directory containing the compiled WASM binary and JavaScript glue code.

### Without Rust toolchain

If the Rust toolchain is not installed, the module automatically falls back to Node.js `crypto`. No build step is required for the fallback path.

---

## Usage from NestJS Services

```typescript
import { aesEncrypt, aesDecrypt, hmacSha256, hmacVerify, sha256 } from '@polyforge/crypto';

// Encrypt a credential before storing in database
const key = process.env.ENCRYPTION_KEY; // 64-char hex string (256 bits)
const encrypted = aesEncrypt(sensitiveData, key);
// Store encrypted.ciphertext, encrypted.iv, encrypted.tag in DB

// Verify webhook signature
const signature = request.headers['x-polyforge-signature'];
const isValid = hmacVerify(requestBody, webhookSecret, signature);

// Hash for cache keys or deduplication
const hash = sha256(JSON.stringify(payload));
```

---

## Performance Notes

The WASM backend provides equivalent cryptographic strength to Node.js crypto (both use AES-256-GCM, SHA-256, HMAC-SHA256). The primary advantage is memory safety:

- **Node.js crypto** — OpenSSL-backed, battle-tested, but key material may persist in V8 heap after use
- **Rust WASM** — key material is dropped deterministically when it goes out of scope; no GC-dependent cleanup

For high-throughput scenarios (e.g., webhook signature verification under load), both backends perform comparably since the underlying algorithms are identical.

---

## Module: `polyforge-engine`

**Package:** `@polyforge/engine` (`packages/polyforge-engine/`)

Strategy tick evaluation engine. Evaluates a strategy's block pipeline (safety, triggers, conditions, actions) against the current market state on every tick. Designed for the hot loop where zero GC pauses and deterministic latency are critical.

### Why Rust WASM for Tick Evaluation

The strategy engine evaluates blocks every 200ms per active strategy. With hundreds of concurrent strategies, the evaluation loop must be:

- **Zero GC pauses** — V8 garbage collection can introduce 5-50ms stalls, unacceptable for time-sensitive trading
- **Deterministic latency** — Rust evaluates in constant time regardless of heap state
- **CPU-efficient** — compiled to native WASM instructions, no interpreter overhead

### Evaluation Pipeline

```
FOR EACH TICK:
  1. Safety blocks   → any fail → STOP strategy immediately
  2. Trigger blocks  → none fire → skip this tick
  3. Condition blocks → any fail → skip this tick
  4. Action blocks   → build ActionIntent[]
```

### Module Architecture

```
packages/polyforge-engine/
├── Cargo.toml              # Rust dependencies (wasm-bindgen, serde)
├── src/lib.rs              # Rust WASM evaluator (wasm-bindgen exports)
├── build.sh                # Build script (wasm-pack)
├── index.ts                # TypeScript wrapper with fallback
├── package.json            # @polyforge/engine package config
├── tsconfig.json           # TypeScript compilation config
├── engine.spec.ts          # Vitest test suite
└── pkg/                    # Generated WASM output (after build)
```

### Exported Function

```typescript
import { evaluateTick } from '@polyforge/engine';

const result = evaluateTick(safetyBlocks, triggerBlocks, conditionBlocks, actionBlocks, context);
// result: { safety_passed, safety_reason, triggered, conditions_met, actions[] }
```

### Supported Block Types

**Safety:** `STOP_IF_DAILY_LOSS`, `MAX_ORDERS_TOTAL`, `STOP_IF_CONSECUTIVE_LOSS`, `STOP_IF_EXPOSURE_EXCEEDS`, `MAX_BETS_PER_DAY`, `MAX_DRAWDOWN`

**Triggers:** `EVERY_TICK`, `PRICE_ABOVE`, `PRICE_BELOW`, `PRICE_CROSSES_UP`, `PRICE_CROSSES_DOWN`, `SPREAD_BELOW`, `PRICE_IN_RANGE`

**Conditions:** `LIQUIDITY_ABOVE`, `SPREAD_BELOW_CONDITION`, `MAX_POSITION`, `NO_EXISTING_POSITION`, `DAILY_LOSS_LIMIT`

**Actions:** `BUY_YES`, `BUY_NO`, `SELL_YES`, `SELL_NO`

### Variable Resolution

Thresholds support `$varName` references that resolve from `context.variables` at evaluation time, enabling dynamic threshold strategies.

### Build

```bash
cd packages/polyforge-engine && bash build.sh
```

### Tests

```bash
npx vitest run packages/polyforge-engine/engine.spec.ts
```

**Fallback:** TypeScript no-op stub when WASM is unavailable (delegates to existing strategy-runner logic).

---

## Conventions

| Concern | Convention |
|---|---|
| Crate type | `cdylib` for WASM target |
| Build tool | `wasm-pack build --target nodejs --release` |
| TS wrapper | `index.ts` with `try/catch` WASM load and fallback |
| Package name | `@polyforge/<module>` |
| Tests | `<module>.spec.ts` using vitest |
| Profile | `opt-level = 3` (engine) or `opt-level = "z"` (crypto) with `lto = true` |
