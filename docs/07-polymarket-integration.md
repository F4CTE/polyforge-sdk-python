# Polyforge — Polymarket Builder Program Guide

> How to register for the Builder Program, obtain credentials, and verify attribution is working.

---

## What is the Builder Program?

Polymarket rewards developers who build on top of their platform. By including builder attribution headers on every order, Polyforge earns **USDC weekly rewards** proportional to the total trading volume it generates.

**How the rewards work:**
- Every order placed through Polyforge includes HMAC headers identifying us as the originating builder
- Polymarket tracks attributed volume weekly
- At the end of each week, USDC rewards are distributed to our Safe wallet
- Higher tiers = higher reward multipliers (volume-based tier progression)

---

## Step 1 — Create a Builder Polymarket Account

> This is a **separate** account from any personal trading account. It is the platform's identity with Polymarket.

1. Go to https://polymarket.com
2. Connect with a dedicated wallet (create a new MetaMask wallet for this — not a personal one)
3. Complete KYC if required for your jurisdiction
4. Go to https://polymarket.com/settings → API Keys
5. Create a new API key set:
   - Copy: `apiKey`, `apiSecret`, `apiPassphrase`
   - These become `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE`

> **Important:** Use a fresh, dedicated wallet. This wallet will receive weekly USDC reward payouts. Keep the private key extremely secure — this is platform funds, not user funds.

---

## Step 2 — Register for the Builder Program

1. Go to https://polymarket.com/builders (or email builders@polymarket.com)
2. Fill in the registration form:
   - **Project name:** Polyforge
   - **Website:** https://polyforge.app
   - **Description:** Automated trading strategy builder for Polymarket. Users build drag-and-drop strategies using 36 block types, backtest against historical data, and deploy live strategies with full risk controls.
   - **Expected monthly volume:** Your estimate (be realistic)
   - **API key:** The apiKey from Step 1
3. Submit and wait for approval (typically 1–5 business days)

On approval, you receive:
- Confirmation your API key is registered as a builder
- Your initial tier assignment
- Documentation on attribution header format

---

## Step 3 — Store Credentials in AWS Secrets Manager

```bash
# Store the three Builder Program credentials
aws secretsmanager put-secret-value \
  --secret-id polyforge/POLY_BUILDER_API_KEY \
  --secret-string "your-builder-api-key"

aws secretsmanager put-secret-value \
  --secret-id polyforge/POLY_BUILDER_SECRET \
  --secret-string "your-builder-secret"

aws secretsmanager put-secret-value \
  --secret-id polyforge/POLY_BUILDER_PASSPHRASE \
  --secret-string "your-builder-passphrase"
```

signer-service fetches these automatically at boot via the EC2 IAM role.

---

## Step 4 — How Attribution Works in the Code

Every order placed through Polyforge includes four extra headers:

```
POLY_BUILDER_API_KEY:   your-builder-api-key
POLY_BUILDER_TIMESTAMP: 1234567890123
POLY_BUILDER_PASSPHRASE: your-passphrase
POLY_BUILDER_SIGNATURE: hmac-sha256-of-request
```

In signer-service, this is handled by `@polymarket/clob-client`:

```typescript
// services/signer-service/src/signing/clob.service.ts
const client = new ClobClient(
  CLOB_URL,
  CHAIN_ID,
  new ethers.Wallet(userPrivateKey),
  {
    key:        userApiKey,
    secret:     userApiSecret,
    passphrase: userApiPassphrase,
  },
  userSigType,
  userSafeAddress,
  undefined,
  false,
  {
    // Builder Program attribution — added to EVERY order
    apiKey:     POLY_BUILDER_API_KEY,
    secret:     POLY_BUILDER_SECRET,
    passphrase: POLY_BUILDER_PASSPHRASE,
  }
);

// This order will carry builder attribution headers automatically
const signedOrder = await client.createOrder(orderPayload);
```

The `builderConfig` parameter ensures all orders are attributed, regardless of which user placed them.

---

## Step 5 — Verify Attribution is Working

### Check via Polymarket API

```bash
# Get your builder stats
curl -X GET "https://clob.polymarket.com/builder/trades" \
  -H "POLY_ADDRESS: your-builder-wallet-address" \
  -H "POLY_SIGNATURE: ..." \
  -H "POLY_TIMESTAMP: ..." \
  -H "POLY_PASSPHRASE: your-passphrase"
```

A successful response contains your attributed trades. An empty array means attribution isn't working yet.

### Check in the admin app

Go to https://admin.polyforge.app → `/builder`

The Builder Program dashboard shows:
- Weekly attributed volume (USDC)
- Total attributed orders
- Current tier and reward multiplier
- Next tier threshold
- Historical weekly rewards

### Manual verification (test order)

After your first live order is placed through the platform:

1. Note the `clob_order_id` from the orders table
2. Query Polymarket:
   ```bash
   curl "https://data-api.polymarket.com/orders?id=<clob_order_id>"
   ```
3. In the response, check `makerAddress` matches your builder wallet

---

## Builder Tier System

Polymarket uses a tiered reward system based on monthly attributed volume. Higher tiers earn more per dollar of volume.

| Tier | Monthly Volume | Reward Multiplier |
|---|---|---|
| Starter | $0 – $100K | 1x base rate |
| Bronze | $100K – $1M | 1.5x |
| Silver | $1M – $5M | 2x |
| Gold | $5M – $20M | 3x |
| Platinum | $20M+ | Custom (negotiate with Polymarket) |

> These numbers are approximate — the actual tier thresholds are determined by Polymarket and may change. Check https://polymarket.com/builders for current rates.

**Important:** The rewards are paid to the builder wallet (the dedicated wallet from Step 1), not to users. Polyforge earns the rewards as platform revenue. The admin app `/builder` page tracks this.

---

## Rate Limits by Tier

Different tiers have different API rate limits:

| Tier | Requests/minute | Batch size |
|---|---|---|
| Starter | 200 | 10 |
| Bronze | 500 | 15 |
| Silver | 1000 | 20 |
| Gold | 2000 | 30 |

Update `POLY_RATE_LIMIT_PER_MIN` in your environment config when you advance tiers. The current default is `500` (Bronze tier — the target for launch).

---

## Withdrawing Builder Rewards

Rewards accumulate in the builder wallet each week. To withdraw:

1. Connect the builder wallet to Polymarket
2. Go to Portfolio → Builder Rewards
3. Click Withdraw → confirm transaction

Or programmatically:
```bash
# The rewards are claimable via the Polymarket contracts
# See Polymarket documentation for the current contract address and ABI
```

> Set up a weekly reminder to withdraw rewards. They don't expire, but it's good practice to move them out of the hot wallet.

---

## Troubleshooting

### "Builder attribution not found on order"

Check that signer-service is loading the builder credentials correctly:

```bash
# Check signer-service logs for startup
docker compose -f docker-compose.prod.yml logs signer-service | grep -i builder
# Should see: "Builder Program credentials loaded ✓"
# If you see: "Builder credentials not configured" — secrets are missing
```

Verify secrets exist:
```bash
aws secretsmanager get-secret-value \
  --secret-id polyforge/POLY_BUILDER_API_KEY \
  --query SecretString --output text
# Should print the key value, not an error
```

### "Invalid signature" on builder API requests

The HMAC signature uses the request body + timestamp. Make sure:
- Server time is accurate (NTP sync): `timedatectl status`
- POLY_BUILDER_SECRET matches what's registered with Polymarket
- You're using the correct signing algorithm from `@polymarket/clob-client`

### "Builder account not approved"

Polymarket approval takes 1–5 business days. Orders still work — they just won't be attributed yet. Once approved, attribution applies to all subsequent orders automatically.

---

*Previous: [Deployment](./ops/02-deployment-aws.md)

---

## Development Mode

In development, Polyforge uses **real Polymarket endpoints** for all APIs:

| API | Endpoint |
|-----|---------|
| Gamma API (markets) | `https://gamma-api.polymarket.com` |
| WebSocket (prices) | `wss://ws-subscriptions-clob.polymarket.com/ws/market` |
| CLOB API (orders) | `https://clob.polymarket.com` |
| Data API (positions) | `https://data-api.polymarket.com` |

All environments require `CLOB_API_URL` to be set explicitly (no fallback).

### Rate Limits

Polymarket per-endpoint limits (we use 50% conservative):
- Gamma `/markets`: 300 req/10s → we use 15/s
- CLOB `/book`: 1,500 req/10s → we use 75/s
- Data `/trades`: 200 req/10s → we use 10/s
- WebSocket: PING every 9s (Polymarket requires every 10s)

