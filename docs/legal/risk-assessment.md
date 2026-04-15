<!-- Last reviewed: 2026-04-15 -->

# PolyForge Legal Risk Assessment

**Prepared by:** Lex — Chief Legal & Compliance Officer  
**Date:** April 15, 2026  
**Classification:** Internal — Confidential  
**Scope:** Regulatory exposure for PolyForge as a SaaS strategy automation platform for Polymarket prediction markets.

> **Note:** This document constitutes internal legal analysis only and does not constitute legal advice. PolyForge should engage licensed legal counsel in relevant jurisdictions before making material business decisions based on this assessment.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CFTC Jurisdiction](#2-cftc-jurisdiction-over-prediction-markets)
3. [State-Level Gambling Law](#3-state-level-gambling-law-exposure)
4. [Money Transmitter Classification](#4-money-transmitter--msb-analysis)
5. [Investment Adviser & CTA Registration](#5-investment-adviser--commodity-trading-adviser-cta-analysis)
6. [Recommended Geo-Restrictions](#6-recommended-geo-restrictions)
7. [Required Disclaimers](#7-required-disclaimers)
8. [Risk Matrix](#8-risk-matrix)
9. [Recommended Mitigations](#9-recommended-mitigations)
10. [Review Schedule](#10-review-schedule)

---

## 1. Executive Summary

PolyForge operates as a strategy automation SaaS layer on top of Polymarket — a prediction market exchange. This placement creates a distinctive regulatory profile: PolyForge is not itself an exchange, does not hold user funds, and does not directly trade. However, it does automate decisions on a CFTC-regulated platform, creating exposure under four distinct regulatory regimes.

**Highest risks, in priority order:**

1. **State gambling law** — 11+ states have issued cease-and-desist orders against Polymarket/Kalshi. PolyForge as an automation tool could be classified as a "gambling facilitator" in states that refuse to recognise CFTC preemption. Active litigation in Nevada, Tennessee, and Massachusetts; outcome uncertain.

2. **CFTC Commodity Trading Adviser (CTA) classification** — If PolyForge's strategy engine exercises any autonomous discretion over trades (rather than mechanically executing user-defined rules), it likely qualifies as an unregistered CTA under CEA § 4m. Registration or a qualifying exemption is required.

3. **International sanctions and geo-restrictions** — Operating without OFAC-compliant geo-blocks exposes PolyForge to Treasury sanctions violations. Several jurisdictions (France, Germany, Australia, Argentina) have blocked or restricted Polymarket entirely; serving users there creates direct regulatory risk.

4. **Investment Adviser Act (SEC)** — Lower probability risk than CTA but non-zero if PolyForge ever introduces personalised strategy recommendations or AI-driven suggestions. Current product (user-defined rule blocks) is likely outside SEC IA scope.

5. **Money transmitter / MSB** — Low direct risk because PolyForge does not custody or transfer funds. Risk could increase if PolyForge adds fiat on/off ramp, fee-from-winnings, or escrow functionality.

---

## 2. CFTC Jurisdiction Over Prediction Markets

### 2.1 Current Legal Landscape

Polymarket operates under CFTC oversight following its November 2025 designation as an amended Designated Contract Market (DCM), enabled by its July 2025 acquisition of QCEX (a CFTC-licensed exchange and clearinghouse). Polymarket relaunched in the US on December 2, 2025.

Key regulatory developments:

- **CFTC ANPRM (2026):** The CFTC published an Advance Notice of Proposed Rulemaking soliciting broad comment on event contracts and prediction market regulation, with comments due April 30, 2026. A comprehensive regulatory framework is forthcoming but not yet final.
- **No-action relief (December 2025):** The CFTC issued no-action letters to Polymarket and other platforms on certain data/recordkeeping requirements.
- **January 2026 CFTC leadership:** Chairman Selig withdrew the proposed ban on political/sports event contracts and announced intent to draft clear standards.
- **Trump administration support:** The executive branch has signalled support for federally regulated prediction markets as a category.

### 2.2 PolyForge's Position Under CFTC Framework

PolyForge is **not** a DCM, a futures commission merchant (FCM), or an introducing broker (IB). It is software that communicates with Polymarket's CLOB API to place orders on behalf of users. This places it in the category of **order management system / trading software**, not an exchange participant in its own right.

**Key distinction:** The Commodity Exchange Act imposes specific registration and compliance requirements on entities that:
- Operate exchanges (DCMs) — *Polymarket, not PolyForge*
- Execute orders for compensation (FCMs / IBs) — *Potentially PolyForge, see §5*
- Advise others on commodity trading for compensation (CTAs) — *Potentially PolyForge, see §5*

**CFTC Ruling Risk:** Low-to-medium. PolyForge does not operate an exchange and does not custody client funds. However, if the strategy engine is characterised as providing automated commodity trading advice, CTA registration may be required.

### 2.3 Preemption Analysis

Under the Commodity Exchange Act (CEA), federal regulation of commodity derivatives preempts state law in most cases. The CFTC's jurisdiction over prediction markets as event contracts (under CEA § 2(c)(5)(C)) is the dominant regulatory framework at the federal level. However, state gambling regulators contest this preemption in active litigation — the outcome of Nevada Gaming Control Board v. Polymarket and related cases will be decisive.

---

## 3. State-Level Gambling Law Exposure

### 3.1 Active Enforcement Actions Against Prediction Markets

As of April 2026, at least **11 states** have issued cease-and-desist orders or filed civil complaints against Polymarket, Kalshi, or both. States taking formal action include:

| State | Action | Status |
|-------|--------|--------|
| Nevada | Civil complaint by Nevada Gaming Control Board | Active litigation |
| Tennessee | Cease-and-desist by Sports Wagering Council | C&D issued January 2026 |
| Massachusetts | Preliminary injunction barring new sports contracts | Active injunction |
| Maryland | Formal concerns raised, proceedings initiated | Under review |
| New Jersey | Explicit challenges, proceedings underway | Under review |
| New York | Concerns raised | Under review |
| Connecticut | Concerns raised | Under review |
| Indiana, Louisiana, Wisconsin, Alabama | C&D orders or restrictions | Issued 2025-2026 |

### 3.2 PolyForge's Exposure as Automation Software

PolyForge does not operate the prediction market. However, state AGs pursuing "gambling facilitator" theories could target automation tools on the following basis:

- **Facilitating unlicensed gambling:** If a state holds that prediction market activity constitutes gambling without a state license, software that automates that gambling could be classified as facilitating unlicensed gambling activity.
- **Aiding and abetting:** State law theories of aiding and abetting gambling are broad in several jurisdictions.
- **Advertising / promotion exposure:** Any marketing directed at residents of states with active enforcement creates discovery risk.

**Risk level: HIGH** in Nevada, Tennessee, Massachusetts, Maryland, New Jersey. **MEDIUM** in New York, Connecticut, and states with active regulatory review.

### 3.3 Federal Preemption as Defence

PolyForge's strongest defence is that CFTC regulation of Polymarket as a DCM preempts state gambling law as applied to software tools that interface with that exchange. This argument has not yet been ruled on in any court with respect to third-party automation software. It is a viable argument but **not a settled defence**.

**Recommendation:** Do not rely on preemption as the only safeguard. Implement geo-blocking for all states with active enforcement actions (see §6).

---

## 4. Money Transmitter / MSB Analysis

### 4.1 Current Product Assessment

PolyForge in its current form does **not**:
- Hold, receive, or transmit user funds
- Custody digital assets or USDC
- Process fiat payments on behalf of users
- Provide an escrow function

Users connect their own Polymarket-linked wallets (self-custodied). PolyForge signs and submits orders via EIP-712 on behalf of users using credential keys stored in the signer service.

**Conclusion:** PolyForge does **not** currently qualify as a money services business (MSB) or money transmitter under FinCEN regulations or state money transmitter licensing requirements.

### 4.2 Future Risk Scenarios

The following product changes would trigger MSB analysis and likely require FinCEN registration and state money transmitter licences (currently required in 48 states):

| Scenario | MSB Trigger |
|----------|------------|
| Fiat on-ramp / off-ramp | Almost certain MSB |
| Taking a performance fee from user winnings | Possible — depends on structure |
| Pooling user funds for a strategy fund | Certain — CPO registration required |
| P2P strategy copying with profit share | High probability MSB / broker-dealer |

**Recommendation:** Before building any of these features, commission a targeted legal analysis. Do not launch without FinCEN registration and state licences if any of these scenarios are implemented.

### 4.3 FinCEN AML Rule (Investment Advisers)

FinCEN's 2024 final rule extending AML/CFT obligations to investment advisers has been postponed to January 1, 2028. This rule will not affect PolyForge in the near term, but should be monitored as the product evolves.

---

## 5. Investment Adviser / Commodity Trading Adviser (CTA) Analysis

### 5.1 Investment Adviser Act (SEC)

The Investment Advisers Act of 1940 defines an investment adviser as any person who, for compensation, engages in the business of advising others on the value of securities or on investing in, purchasing, or selling securities.

**PolyForge does not deal in securities.** Polymarket event contracts are CFTC-regulated commodity contracts, not securities. Therefore, the Investment Advisers Act **does not directly apply** to PolyForge's current product.

**Edge case — AI-generated strategy suggestions:** If PolyForge introduces a feature that recommends specific strategies to users based on their profile or goals (i.e., personalised advice), SEC interpretation of "investment advice" delivered via algorithm may still be asserted even in a commodities context, given the SEC's 2025 focus on AI-driven financial tools. Risk: LOW currently, MEDIUM if AI recommendations are added.

### 5.2 Commodity Trading Adviser (CTA) Analysis

**This is PolyForge's highest-probability registration risk under federal law.**

Under CEA § 1a(12), a Commodity Trading Adviser (CTA) is any person who, for compensation or profit, advises others (directly or via publication) as to the value of commodity contracts or the advisability of trading in commodity contracts.

**Critical test:** Does PolyForge exercise *discretion* over trading decisions, or does it merely *execute* user-defined instructions?

| PolyForge Mode | CTA Classification Likelihood |
|----------------|------------------------------|
| User builds strategy blocks → PolyForge executes mechanically | **Low** — closer to order-execution software |
| PolyForge suggests strategies or adjusts parameters autonomously | **High** — likely CTA |
| PolyForge uses AI to make trade decisions with minimal user input | **Very high** — almost certain CTA |
| Copy-trading: users replicate another user's live strategy | **Medium-High** — CTA or IB analysis required |

**Available exemptions:**
- **§ 4m(1) de minimis exemption:** Available to persons who have not advised more than 15 persons in the preceding 12 months and do not hold themselves out as CTAs. **Not applicable** to PolyForge — it is a public SaaS with unlimited users.
- **§ 4m(3) SEC-registered IA exemption:** Requires SEC IA registration. Not applicable in current product.
- **Solely incidental exemption:** Available when commodity trading advice is solely incidental to the advisor's primary business. Potentially applicable if PolyForge's primary product is "strategy automation software" and trading advice is incidental — but this is a grey area given the product's core value proposition.

**Recommendation:** PolyForge should seek a formal legal opinion from a CFTC-specialist firm on whether the current strategy engine requires CTA registration. If the copy-trading feature is launched, CTA/IB analysis is mandatory before launch.

### 5.3 NFA Membership

If CTA registration is required, PolyForge must also register with the National Futures Association (NFA). NFA membership entails ongoing compliance obligations including disclosure documents, annual financial reports, and supervision requirements.

---

## 6. Recommended Geo-Restrictions

### 6.1 Mandatory Blocks (OFAC Sanctions — Zero Tolerance)

Block all access and account creation from the following countries in compliance with US Treasury OFAC sanctions. Non-compliance carries criminal liability:

| Country | Sanctions Programme |
|---------|-------------------|
| Cuba | Cuba Sanctions (31 CFR 515) |
| Iran | Iran Sanctions (31 CFR 560) |
| North Korea | DPRK Sanctions (31 CFR 510) |
| Russia | Russia/Ukraine-EO Sanctions |
| Syria | Syria Sanctions (31 CFR 542) |
| Belarus | Belarus Sanctions |
| Myanmar | Burma Sanctions |
| Venezuela | Venezuela Sanctions |
| Central African Republic, DRC, Iraq, Lebanon, Libya, Nicaragua, Somalia, South Sudan, Sudan, Yemen, Zimbabwe | Various OFAC programmes |

**Implementation:** IP-based geofencing at the CDN/edge layer (Cloudflare or equivalent). Block at account registration and on each API request. Log blocked attempts for compliance records.

### 6.2 High-Risk Blocks (Regulatory + Enforcement Risk)

Block access from the following jurisdictions due to active legal proceedings against Polymarket or explicit platform bans:

| Jurisdiction | Reason | Block Type |
|-------------|--------|-----------|
| Nevada, USA | Active civil complaint by Gaming Control Board | Block |
| Tennessee, USA | Cease-and-desist order issued | Block |
| Massachusetts, USA | Active court injunction | Block |
| France | Polymarket explicitly blocked; AMF gambling regulations | Block |
| Germany | GlüStV gambling treaty; no prediction market licence | Block |
| Australia | ACMA gambling regulations; platform blocked | Block |
| Poland | Ministry of Finance banned Polymarket (Jan 2025) | Block |
| Ukraine | ISP-level ban enacted Dec 2025 | Block |
| Argentina | Nationwide block ordered Mar 2026 | Block |

### 6.3 Close-Only / Monitor States

Do not allow new account creation from the following; existing users may be allowed to view but not trade:

| Jurisdiction | Status |
|-------------|--------|
| Maryland, USA | Active regulatory proceedings |
| New Jersey, USA | Proceedings underway |
| New York, USA | Concerns raised; monitor |
| Connecticut, USA | Concerns raised; monitor |
| Indiana, USA | C&D issued |
| Louisiana, USA | C&D issued |
| Singapore | Polymarket close-only; parallel restriction recommended |
| Taiwan | Polymarket close-only; parallel restriction recommended |
| Thailand | Polymarket close-only; parallel restriction recommended |

### 6.4 US State Eligibility Approach

**Recommended approach:** For remaining US states, implement age verification (18+) and explicit acknowledgement of risk warnings at sign-up. Require users to confirm they are not residents of any listed Restricted State. Maintain a dynamic Restricted Jurisdiction list that can be updated in real time as the state litigation landscape evolves.

### 6.5 Geo-Restriction Technical Requirements

- Use IP geolocation at the CDN layer (primary) and confirmed at application layer (secondary)
- Collect user-declared country/state at registration; cross-reference with IP
- Add VPN/proxy detection — do not rely solely on IP geolocation
- Maintain audit log of all blocked access attempts (retain 3 years)
- Review and update restricted jurisdiction list monthly

---

## 7. Required Disclaimers

The following disclaimer language is legally required and must appear in specified locations. All language is already substantially incorporated in the Terms of Service but must also appear contextually in the product UI.

### 7.1 Primary Risk Warning (Required on Every Page with Trading Interface)

> **Risk Warning:** Trading on prediction markets involves significant risk of financial loss. You may lose some or all of the funds you trade with. Past performance of any strategy — including backtested or simulated results — does not predict or guarantee future results. Do not trade with funds you cannot afford to lose.

### 7.2 Not Financial Advice Disclaimer

> PolyForge is a software automation tool, not a broker, financial adviser, investment manager, or commodity trading adviser. Nothing on this platform constitutes financial, investment, legal, or tax advice. All trading decisions are made by you alone, using your own judgment and risk tolerance. PolyForge does not recommend specific markets, positions, or trade sizes.

### 7.3 Simulated / Backtested Results Disclaimer

> **Backtested and paper trading results are hypothetical and simulated.** They do not represent actual trading and may not reflect real market conditions, liquidity constraints, or execution slippage. Simulated results have inherent limitations and may over-state actual performance. Past simulated performance is not indicative of future live trading results.

### 7.4 Jurisdictional Disclaimer

> PolyForge is not available in all jurisdictions. Access from certain countries and US states is restricted due to local laws and regulations. By accessing this platform, you confirm that you are not located in, and are not a citizen or resident of, any Restricted Jurisdiction as defined in our Terms of Service.

### 7.5 Placement Requirements

| Disclaimer | Required Location |
|-----------|------------------|
| Risk Warning (7.1) | Login page, dashboard header, strategy builder, order confirmation |
| Not Financial Advice (7.2) | Footer (all pages), Terms of Service, strategy builder |
| Simulated Results (7.3) | Backtest results page, paper trading UI, all performance metrics |
| Jurisdictional (7.4) | Sign-up flow (checkbox acknowledgement), login page |

---

## 8. Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation Priority |
|------|-----------|--------|----------|-------------------|
| State gambling enforcement (Nevada, TN, MA) | **High** | **Critical** | 🔴 Critical | P0 — Geo-block immediately |
| CTA registration required for strategy engine | **Medium** | **High** | 🟠 High | P0 — Legal opinion required |
| OFAC sanctions violation | **Low** | **Critical** | 🔴 Critical | P0 — Geo-block all OFAC countries |
| Broader state enforcement spillover (11+ states) | **Medium** | **High** | 🟠 High | P1 — Monitor + rapid block capability |
| CTA required for copy-trading feature | **High** | **High** | 🔴 Critical | P0 — Do not launch copy-trading without legal opinion |
| Class action: inadequate risk disclosures | **Medium** | **High** | 🟠 High | P1 — Implement all §7 disclaimers |
| Class action: backtested results misleading | **Medium** | **Medium** | 🟡 Medium | P1 — Implement 7.3 disclaimer |
| Money transmitter if profit-sharing added | **Low (current)** | **High** | 🟡 Medium | P2 — Gate on legal review |
| Investment Adviser Act (SEC) — AI suggestions | **Low (current)** | **Medium** | 🟡 Medium | P2 — Trigger review if AI recs added |
| GDPR violation (EU data) | **Medium** | **Medium** | 🟡 Medium | P1 — Privacy policy + DPA compliance |
| FinCEN AML (post-2028 if IA rule applies) | **Low (2028)** | **Medium** | 🟢 Low | P3 — Monitor |
| Federal preemption challenge loss | **Medium** | **High** | 🟠 High | Contingency planning only |

**Severity key:**
- 🔴 Critical — Potential criminal liability, injunctions, platform shutdown
- 🟠 High — Civil penalties, regulatory sanctions, significant litigation exposure
- 🟡 Medium — Compliance obligations, moderate litigation risk
- 🟢 Low — Monitoring required; low near-term probability

---

## 9. Recommended Mitigations

### Immediate (P0 — Before Next Public Release)

1. **Geo-block OFAC countries** at Cloudflare edge — zero tolerance; implement before any US relaunch.
2. **Geo-block active enforcement states** (Nevada, Tennessee, Massachusetts) — block at account creation and API level.
3. **Implement all §7 disclaimers** in product UI — risk warnings on trading interfaces are mandatory.
4. **Engage CFTC-specialist outside counsel** for formal CTA classification opinion on the current strategy engine.
5. **Do not launch copy-trading** without a CTA/IB legal opinion — this feature has the highest single-feature registration risk.

### Short-Term (P1 — Within 30 Days)

6. **Build a dynamic geo-restriction management system** — ability to add jurisdictions to the block list within 24 hours as new C&D orders or court orders emerge.
7. **Add VPN/proxy detection** to the geo-block stack — IP-only geofencing is insufficient.
8. **Establish a monthly legal monitoring review** — track state litigation outcomes and CFTC rulemaking (ANPRM comment period closes April 30, 2026).
9. **User declaration at sign-up** — checkbox + written acknowledgement of restricted jurisdiction list; store with timestamp for compliance records.
10. **Audit backtest/paper trading UI** to ensure simulated results are clearly labelled everywhere.

### Medium-Term (P2 — Within 90 Days)

11. **Prepare CTA disclosure document** in case registration is required — NFA Form 7-R and Disclosure Document preparation lead time is 60–90 days.
12. **AML/KYC assessment** — even without MSB registration, basic KYC (name, country, date of birth) at sign-up provides a compliance defence and is best practice.
13. **Legal review gate for monetisation features** — any feature involving performance fees, profit sharing, or fund pooling must be reviewed before development begins, not before launch.
14. **GDPR Data Protection Agreement** — for any EU users who access the platform (even from permitted jurisdictions), a DPA and privacy-compliant data architecture is required.

---

## 10. Review Schedule

| Review Item | Frequency | Trigger |
|------------|-----------|---------|
| Geo-restriction list | Monthly | New C&D orders, court rulings, regulatory changes |
| CTA classification status | Quarterly | CFTC rulemaking developments; product feature changes |
| Disclaimer language | Semi-annually | Regulatory changes, significant litigation outcomes |
| OFAC sanctions list | Monthly | US Treasury updates |
| State litigation tracker | Weekly | Ongoing state v. prediction market cases |
| This full document | Quarterly | Or immediately on material regulatory change |

**Next scheduled review:** July 15, 2026

---

*Prepared by Lex — Chief Legal & Compliance Officer @ PolyForge*  
*Sign-off required from CEO (R0b1n) before distribution outside the company.*
