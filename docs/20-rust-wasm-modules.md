# Rust Security Modules

Polyforge uses Rust for all security-critical cryptographic operations. Three Rust modules handle key management, expression evaluation, and hashing:

| Module | Type | Purpose |
|--------|------|---------|
| `polyforge-crypto-native` | **NAPI-RS native addon** | AES-256-GCM envelope encryption with `Zeroize` memory safety — private keys never enter V8 heap |
| `polyforge-engine` | **WASM** | Sandboxed strategy rule evaluation — eliminates expression injection |
| `polyforge-crypto` | **WASM** | AES-GCM, HMAC-SHA256, SHA256 hashing |

> **SECURITY: Rust is MANDATORY — no fallback.** The signer-service and strategy-engine **refuse to start** if their Rust modules are not available. There is no JavaScript fallback. This prevents silent degradation to less secure implementations.

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

### No fallback — Rust only

The signer-service uses `@polyforge/crypto-native` (NAPI-RS) exclusively. If the addon is not available, the service crashes on startup with:
```
SECURITY: @polyforge/crypto-native NAPI addon is REQUIRED but not available
```

The Docker build includes a dedicated Rust build stage (`rust:1-slim`) that compiles the NAPI addon. The signer-service runtime uses `node:24-slim` (Debian, not Alpine) for glibc compatibility.

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

The Rust toolchain is **required** for building. There is no fallback. Install with:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

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

**No fallback.** The strategy-engine crashes on startup if `@polyforge/engine` WASM is not available. The Docker build includes a dedicated Rust WASM build stage.

---

## Conventions

| Concern | Convention |
|---|---|
| Crate type | `cdylib` for WASM target |
| Build tool | `wasm-pack build --target nodejs --release` |
| TS wrapper | `index.ts` — loads WASM, crashes if not available (no fallback) |
| Package name | `@polyforge/<module>` |
| Tests | `<module>.spec.ts` using vitest |
| Profile | `opt-level = 3` (engine) or `opt-level = "z"` (crypto) with `lto = true` |
