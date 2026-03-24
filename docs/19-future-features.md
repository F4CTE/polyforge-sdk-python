# Polyforge — Future Features

> These features are documented for planning purposes. **None are currently being implemented.**
> They represent potential directions based on competitive analysis, user feedback, and platform evolution.

---

## Arbitrage Scanner

Cross-platform price comparison engine that identifies and optionally auto-executes arbitrage opportunities between prediction market platforms.

### Scope

- **Cross-platform price comparison** -- real-time price feeds from Polymarket and Kalshi displayed side-by-side for equivalent markets
- **Arbitrage opportunity detection** -- automated scanning for price discrepancies that exceed a configurable threshold (e.g., 2%+ spread)
- **Auto-execution** -- optional automated placement of offsetting positions across platforms when profitable arbitrage is detected
- **Risk dashboard** -- track open arbitrage positions, net exposure, and P&L across platforms
- **Settlement risk monitoring** -- alert when correlated markets have different resolution timelines or criteria

### Requirements

- Kalshi API integration (REST + WebSocket)
- Market mapping layer to match equivalent markets across platforms
- Sub-second execution latency for competitive arbitrage
- Position reconciliation across platforms

---

## Multi-Platform Aggregation

Unified trading interface spanning multiple prediction market platforms from a single Polyforge session.

### Scope

- **Trade Polymarket + Kalshi from one UI** -- unified order entry that routes to the correct platform
- **Unified portfolio view** -- consolidated positions, P&L, and exposure across all connected platforms
- **Cross-platform order book** -- combined liquidity display for equivalent markets
- **Platform comparison** -- side-by-side fee structures, settlement rules, and market availability
- **Single authentication** -- connect platform accounts once, trade across all from Polyforge

### Requirements

- Kalshi authentication (OAuth or API key)
- Kalshi order placement API integration
- Unified data model abstracting platform-specific order formats
- Platform-specific fee calculation and display

---

## Browser Extension

Chrome and Firefox extension that overlays Polyforge functionality directly on polymarket.com.

### Scope

- **Chrome + Firefox extension** -- standard WebExtension API for cross-browser support
- **Polyforge overlay on polymarket.com** -- inject strategy controls, scores, and analytics directly into the Polymarket UI
- **Quick strategy deployment** -- one-click strategy attachment from any market page on polymarket.com
- **Real-time score overlay** -- display Polyforge trader scores and analytics on Polymarket trader profiles
- **Trade history enrichment** -- augment Polymarket trade history with Polyforge analytics (win rate, P&L attribution)

### Requirements

- Content script injection on polymarket.com domain
- Background service worker for real-time data sync
- Secure authentication bridge between extension and Polyforge backend
- Polymarket DOM structure analysis and stable selector strategy

---

## Mobile App (React Native)

Native iOS and Android applications providing full Polyforge functionality on mobile devices.

### Scope

- **iOS + Android native apps** -- React Native with platform-specific optimizations
- **Shared business logic** -- reuse core trading logic, state management, and API clients from the web app
- **Push notifications** -- native push alerts for order fills, strategy events, price alerts, and market resolutions
- **Biometric authentication** -- Face ID, Touch ID, and fingerprint login
- **Offline portfolio view** -- cached positions and P&L accessible without network connectivity
- **Quick trade flow** -- simplified mobile-optimized order entry

### Requirements

- React Native (or Capacitor) project setup with shared TypeScript packages
- APNs (iOS) and FCM (Android) push notification integration
- Secure keychain storage for authentication tokens
- App Store and Google Play submission pipeline

---

## Fund Management

Pooled capital structures enabling transparent, on-chain fund governance for group trading.

### Scope

- **Pooled capital structures** -- create and manage shared trading funds with multiple investors
- **Transparent on-chain governance** -- fund rules, allocations, and withdrawals governed by smart contracts
- **Performance-based fee distribution** -- automated management and performance fee calculation (e.g., 2/20 structure)
- **Investor reporting dashboard** -- real-time and historical fund performance, attribution, and risk metrics
- **Deposit/withdrawal management** -- epoch-based or real-time capital flows with watermark tracking
- **NAV calculation** -- net asset value computed from open positions and cash balances

### Requirements

- Smart contract development (Solidity) for fund governance
- On-chain accounting and audit trail
- Regulatory compliance review (may vary by jurisdiction)
- Multi-signature wallet integration for fund operations

---

## UMA Oracle Dashboard

Monitoring and analytics for UMA oracle disputes that affect Polymarket market resolutions.

### Scope

- **Track disputed Polymarket resolutions** -- real-time monitoring of markets entering the UMA dispute process
- **Vote monitoring** -- display UMA governance votes related to Polymarket market resolutions
- **Early warning system** -- alert users holding positions in markets with active or pending disputes
- **Dispute history** -- historical record of past disputes, outcomes, and resolution timelines
- **Position impact analysis** -- calculate potential P&L impact of dispute outcomes on user portfolios

### Requirements

- UMA protocol API or on-chain event monitoring
- Polymarket resolution event correlation
- Historical dispute data ingestion
- Real-time WebSocket events for dispute state changes

---

## LP / Market Making

Automated liquidity provision and spread management tools for users acting as market makers.

### Scope

- **Automated liquidity provision** -- place and maintain two-sided quotes (bid/ask) on selected markets
- **Spread management tools** -- configurable target spread, minimum spread, and spread adjustment based on volatility
- **Risk-adjusted position sizing** -- dynamic quote sizing based on inventory, exposure limits, and market conditions
- **Inventory management** -- auto-rebalancing to maintain neutral inventory with configurable drift tolerance
- **Market making analytics** -- P&L attribution (spread capture vs. inventory P&L), fill rates, and market share
- **Multi-market support** -- run market making strategies across multiple markets simultaneously

### Requirements

- High-frequency order management (sub-second quote updates)
- Real-time order book depth analysis
- Position and inventory tracking at the token level
- Configurable risk parameters per market

---

*This document is maintained alongside the [Roadmap](./11-roadmap.md). Features may be reprioritized based on user demand and competitive landscape changes.*
