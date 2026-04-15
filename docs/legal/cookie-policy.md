<!-- Last reviewed: 2026-04-15 -->

# PolyForge Cookie Policy

**Effective Date:** April 15, 2026
**Last Updated:** April 15, 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [What Are Cookies and Similar Technologies?](#2-what-are-cookies-and-similar-technologies)
3. [Cookie Audit — What We Set and Why](#3-cookie-audit--what-we-set-and-why)
4. [Local Storage and Session Storage](#4-local-storage-and-session-storage)
5. [Third-Party Cookies](#5-third-party-cookies)
6. [Legal Basis for Cookie Use](#6-legal-basis-for-cookie-use)
7. [Cookie Consent Banner Specification](#7-cookie-consent-banner-specification)
8. [Your Controls and How to Manage Cookies](#8-your-controls-and-how-to-manage-cookies)
9. [Jurisdiction-Specific Notes](#9-jurisdiction-specific-notes)
10. [Changes to This Policy](#10-changes-to-this-policy)
11. [Contact Us](#11-contact-us)

---

## 1. Introduction

PolyForge ("we," "us," or "our") operates a SaaS strategy automation platform for algorithmic trading on Polymarket prediction markets. This Cookie Policy explains what cookies and similar browser-storage technologies we use across our web properties — the marketing site (`polyforge.app`), the user trading application (`app.polyforge.app`), and the admin panel — why we use them, and how you can control them.

This policy is incorporated by reference into our [Privacy Policy](./privacy-policy.md) and should be read alongside it.

> **Bottom line:** PolyForge sets **strictly necessary authentication cookies only**. We do not use tracking cookies, advertising cookies, or third-party analytics cookies. No data is shared with ad networks.

---

## 2. What Are Cookies and Similar Technologies?

**Cookies** are small text files that a website places on your browser or device. They allow the website to remember information about your visit across requests and sessions.

**Local Storage** and **Session Storage** are browser-based key/value stores that persist data on your device. They are not transmitted to the server automatically (unlike cookies) but are governed by the same legal frameworks in most jurisdictions.

Cookies are characterised by:

| Property | Description |
|----------|-------------|
| **Name** | The cookie identifier |
| **Value** | The data stored (typically an opaque token) |
| **Domain** | Which domain can read the cookie |
| **Path** | Which URL path the cookie is scoped to |
| **Expiry** | When the cookie is deleted |
| **HttpOnly** | If set, the cookie cannot be read by JavaScript — only transmitted in HTTP headers |
| **Secure** | If set, the cookie is only sent over HTTPS |
| **SameSite** | Controls cross-site transmission (`Strict`, `Lax`, or `None`) |

---

## 3. Cookie Audit — What We Set and Why

### 3.1 Authentication Cookies (Strictly Necessary)

These cookies are set by our backend authentication service when you log in. They are **HttpOnly** (invisible to JavaScript), **Secure** (HTTPS only), **SameSite=Strict** (never sent on cross-origin requests), and **first-party** (set on the same domain). You cannot opt out of these cookies while using a logged-in account — without them, authentication does not function.

| Cookie Name | Service | Purpose | Duration | HttpOnly | Secure | SameSite |
|-------------|---------|---------|----------|----------|--------|----------|
| `pf_token` | User Auth Service | Holds your JWT access token; proves you are authenticated on every API request | 15 minutes | ✅ Yes | ✅ Yes | Strict |
| `pf_refresh` | User Auth Service | Holds your JWT refresh token; used to silently renew `pf_token` when it expires, keeping you logged in without re-entering your password | 7 days | ✅ Yes | ✅ Yes | Strict |
| `pf_admin_token` | Admin Auth Service | Holds the admin JWT session token; scoped exclusively to the admin panel at `admin.polyforge.app` | 1 hour | ✅ Yes | ✅ Yes | Strict |

**Security note:** `pf_token` expires after 15 minutes. When it expires, the frontend calls `/auth/v1/refresh` to issue a new pair of tokens using `pf_refresh`. If `pf_refresh` is also expired or invalid, you are redirected to the login page. This short-lived access token design limits the window of exposure if a token is ever compromised.

**What these cookies contain:** Each cookie stores a signed, opaque JWT (JSON Web Token). They contain a user identifier, expiry timestamp, and cryptographic signature. They do not contain passwords, private keys, Polymarket credentials, or financial data.

### 3.2 No Analytics, Advertising, or Tracking Cookies

PolyForge does **not** set any of the following:

- Google Analytics (`_ga`, `_gid`, `_gat_*`)
- Google Ads or remarketing cookies
- Facebook Pixel (`_fbp`, `_fbc`)
- Hotjar, Clarity, FullStory, or session-recording cookies
- Any advertising network cookies
- Any cross-site tracking technologies

This is by design. We track platform performance through our own server-side logging and do not sell or share user data with advertising networks.

---

## 4. Local Storage and Session Storage

Local Storage and Session Storage are browser-side key/value stores. Unlike cookies, they are never automatically sent to servers; they are read exclusively by our JavaScript running in your browser. However, under the GDPR ePrivacy Directive and interpretations by EU/UK data protection authorities, local storage is treated equivalently to cookies for consent purposes when it stores personal or identifying information.

### 4.1 Local Storage (persistent — survives browser close)

| Key | Application | Purpose | Category |
|-----|-------------|---------|----------|
| `pf-theme` | User App, Landing | Stores your light/dark mode preference so it persists across sessions | Functional |
| `pf-markets-view` | User App | Stores your preferred market list view (cards vs. list) | Functional |
| `pf-portfolio-goals` | User App | Stores your locally-set portfolio goals | Functional |
| `pf-dismissed-suggestions` | User App | Stores IDs of portfolio suggestions you've dismissed so they don't reappear | Functional |
| `pf-onboarding-complete` | User App | Boolean flag indicating you've completed onboarding setup | Functional |
| `pf-onboarding-dismissed` | User App | Boolean flag indicating you've dismissed the onboarding checklist | Functional |
| `pf-onboarding-completed` | User App | JSON array of completed onboarding step IDs | Functional |
| `pf-onboarding-alert-visited` | User App | Flag indicating you've visited the alerts page during onboarding | Functional |
| `polyforge:builder-tutorial:seen` | User App | Boolean flag indicating you've seen the strategy builder tutorial | Functional |
| `polyforge:onboarding:completed` | User App | JSON array of completed onboarding checklist steps | Functional |
| `polyforge:onboarding:dismissed` | User App | Boolean flag indicating you've dismissed the onboarding checklist widget | Functional |
| `polyforge:tour:seen` | User App | Boolean flag indicating you've completed the UI tooltip tour | Functional |

**None of these local storage keys contain personal data.** They hold UI state and preference booleans/arrays to persist your interface customisations across sessions. They are not transmitted to PolyForge servers and are not used for tracking or profiling.

### 4.2 Session Storage (temporary — cleared when the tab or browser closes)

| Key | Application | Purpose | Category |
|-----|-------------|---------|----------|
| `session_expired` | User App | Temporary flag set when your session token expires; used to show a "session expired" banner on the login page; cleared immediately after it is read | Strictly Necessary |

---

## 5. Third-Party Cookies

**PolyForge sets no third-party cookies.** Our authentication is entirely first-party.

The landing page (`polyforge.app`) uses **Google Fonts** via Next.js's built-in font optimization. When fonts are loaded, Next.js fetches them from Google's servers during the build process and serves them from our own domain — meaning **no requests are made to Google's servers** from your browser, and Google does not set any cookies in connection with font delivery on our site.

The landing page embeds **JSON-LD structured data** (for search engine rich results). This is inert JavaScript data — it does not load third-party scripts and sets no cookies.

If this policy changes and third-party cookies are introduced in the future, this section will be updated and a new effective date will be published before those cookies are set.

---

## 6. Legal Basis for Cookie Use

### 6.1 EU/UK GDPR and ePrivacy Directive

| Cookie / Storage | Legal Basis | Reasoning |
|------------------|-------------|-----------|
| `pf_token`, `pf_refresh`, `pf_admin_token` | **Strictly Necessary** (no consent required) | These cookies are technically required to provide the service you have contracted for. Without them, login, session management, and authenticated API access cannot function. Article 5(3) of the ePrivacy Directive exempts strictly necessary cookies from the consent requirement. |
| Local Storage (all functional keys) | **Legitimate Interests** (Art. 6(1)(f) GDPR) | These store UI preferences you actively set (e.g., choosing dark mode) purely for your benefit. They contain no personal data, are not shared, and are not used for profiling. A reasonable user expects their preference settings to be remembered. No consent banner is required under the ePrivacy Directive for storage that is "strictly necessary to provide an information society service explicitly requested by the subscriber or user" — functional preferences reasonably fall under this exemption. However, we disclose them here for full transparency. |
| `session_expired` (session storage) | **Strictly Necessary** | Temporary signal used exclusively to show an informational banner on the login page. Cleared immediately on use. |

### 6.2 CCPA (California)

PolyForge does not "sell" or "share" personal information through cookies or any other mechanism, as defined under the California Privacy Rights Act (CPRA). We do not use cookies for cross-context behavioral advertising. California residents have no additional cookie-specific rights beyond what is described in our [Privacy Policy](./privacy-policy.md).

### 6.3 Canada (PIPEDA)

PolyForge's use of strictly necessary cookies for authentication aligns with PIPEDA's consent and purpose limitation principles. Functional local storage items do not require express consent under PIPEDA where use is limited to the purpose for which it was collected (delivering the service).

---

## 7. Cookie Consent Banner Specification

This section defines the required consent banner behavior for PolyForge's web properties. It is intended for product and engineering implementation.

### 7.1 Current Requirement

Because PolyForge currently sets **only strictly necessary cookies and functional local storage**, a full consent banner with accept/reject options is **not legally mandated** under the EU ePrivacy Directive or UK PECR. Strictly necessary cookies are explicitly exempt from the consent requirement.

However, a **cookie notice** (informational, not a consent gate) is **recommended** as best practice for:
- Building user trust
- Pre-emptive compliance if analytics or advertising cookies are added in future
- Alignment with guidance from the French CNIL, German DPA, and UK ICO

### 7.2 Recommended Banner (Informational Notice)

**Trigger:** Show once per browser session to first-time visitors and to returning visitors who have not seen it in the last 180 days.

**Placement:** Bottom of the viewport (fixed banner), non-blocking.

**Required content:**

```
PolyForge uses strictly necessary cookies to keep you logged in and to
remember your preferences. We do not use tracking or advertising cookies.
[Learn more] [Got it]
```

- **"Learn more"** links to `/legal/cookies` (this document).
- **"Got it"** dismisses the banner and sets a localStorage key `pf-cookie-notice-dismissed` with the current timestamp.
- The banner must be **accessible**: keyboard-focusable, dismissable with Enter/Space, ARIA `role="dialog"` or `role="alertdialog"`, `aria-label="Cookie notice"`.

**Do not:**
- Block page content behind a cookie wall
- Use a dark pattern that makes rejection more difficult than acceptance
- Use pre-ticked boxes for optional cookies (not applicable currently, but important for future)

### 7.3 Future Cookie Categories (If Implemented)

If PolyForge introduces analytics or advertising cookies in the future, the consent banner **must** be upgraded to:

| Jurisdiction | Requirement |
|---|---|
| EU/EEA | Opt-in consent via granular toggles before non-essential cookies are set; must be as easy to withdraw as to give (GDPR Art. 7(3)) |
| UK | Opt-in for analytics and advertising cookies (UK PECR, updated ICO guidance post-2023) |
| California | Opt-out mechanism ("Do Not Sell or Share My Personal Information") |
| Canada | Express consent before setting tracking cookies |
| Brazil (LGPD) | Express consent before setting cookies that process personal data |

**Banner must include:**
1. Plain-language description of each cookie category
2. Named third parties receiving data
3. Granular category toggles (Strictly Necessary always on; Analytics, Advertising, Social toggleable)
4. Reject All button as prominent as Accept All
5. Link to full Cookie Policy
6. Preference centre accessible from footer at all times

### 7.4 Jurisdictions Requiring Special Treatment

| Jurisdiction | Note |
|---|---|
| **France (CNIL)** | "Accept all" and "Refuse all" buttons must be equally prominent. Cookie lifetime display required. |
| **Germany** | Consent must be freely given, specific, informed; pre-consent storage prohibited; re-consent required if purposes change. |
| **Spain (AEPD)** | Same as EU baseline; AEPD enforces actively. |
| **Italy (Garante)** | Scroll-as-consent is prohibited; affirmative action required. |
| **US (state laws)** | Connecticut, Colorado, Virginia, Texas, Oregon have opt-out rights for targeted advertising. |

### 7.5 Geo-Block Consideration

PolyForge already implements geo-blocking for jurisdictions where prediction market trading is restricted. The cookie notice and consent banner should render even in geo-blocked jurisdictions — it applies to the landing page visit, which precedes any trading activity.

---

## 8. Your Controls and How to Manage Cookies

### 8.1 Deleting Authentication Cookies

You can delete PolyForge authentication cookies by:

1. **Logging out**: clicking "Log out" in the PolyForge application sends a `POST /auth/v1/logout` request that clears `pf_token` and `pf_refresh` from your browser and revokes the refresh token server-side.
2. **Clearing browser storage**: most browsers allow you to clear cookies for a specific site via developer tools or settings.
3. **Browser privacy mode**: using incognito/private browsing creates a temporary cookie store that is deleted when the window closes.

**Note:** Because `pf_token` and `pf_refresh` are `HttpOnly`, they cannot be read or deleted by JavaScript — only the server logout endpoint or direct browser clearing can remove them.

### 8.2 Managing Local Storage

You can clear local storage data using your browser's developer tools:

- **Chrome/Edge:** DevTools → Application → Storage → Local Storage → right-click domain → Clear
- **Firefox:** DevTools → Storage → Local Storage → right-click domain → Delete All
- **Safari:** Develop → Web Inspector → Storage → Local Storage

Clearing local storage will reset your theme preference, view preferences, and onboarding state. It will not log you out — authentication is cookie-based, not local-storage-based.

### 8.3 Browser Cookie Settings

All major browsers allow you to manage cookies via settings:

- **Chrome:** `chrome://settings/cookies`
- **Firefox:** `about:preferences#privacy`
- **Safari:** Preferences → Privacy → Manage Website Data
- **Edge:** `edge://settings/cookies`

Setting your browser to block all cookies will prevent PolyForge from functioning, as authentication cookies are strictly necessary.

### 8.4 Do Not Track

PolyForge does not respond to browser "Do Not Track" (DNT) signals, as we do not engage in cross-site tracking regardless of this signal. Our cookie use is limited to strictly necessary session management and functional preferences, neither of which constitutes cross-site tracking.

---

## 9. Jurisdiction-Specific Notes

### European Union / EEA

This policy is designed to comply with the GDPR (Regulation 2016/679) and the ePrivacy Directive (2002/58/EC as amended by 2009/136/EC). We rely on the strictly necessary exemption for authentication cookies and legitimate interests for functional local storage. If the European Commission issues new guidance or if we introduce non-essential cookies, we will update this policy and implement the required consent mechanisms.

### United Kingdom

This policy is designed to comply with UK GDPR and PECR (Privacy and Electronic Communications Regulations 2003). The UK ICO's guidance on cookies and similar technologies is applied. Strictly necessary cookies do not require consent under PECR Regulation 6(4).

### California (CPRA/CCPA)

PolyForge does not sell or share personal information as defined under the CPRA. We do not use cookies for cross-context behavioral advertising. California residents may contact us at [legal@polyforge.app](mailto:legal@polyforge.app) with any privacy questions.

### Canada (PIPEDA)

PolyForge's cookie use is limited to service delivery. Implied consent is sufficient for strictly necessary cookies under PIPEDA. Our functional local storage items do not constitute collection of personal information within PIPEDA's scope.

---

## 10. Changes to This Policy

We will update this policy if:

- New cookies or storage keys are introduced
- Existing cookies change in purpose, duration, or scope
- Third-party cookies are added
- Applicable law changes

Material changes will be communicated via an in-app notice or email before they take effect. The "Last Updated" date at the top of this document reflects the most recent change.

---

## 11. Contact Us

If you have questions about this Cookie Policy or wish to exercise any data rights:

**Email:** [legal@polyforge.app](mailto:legal@polyforge.app)
**Subject line:** Cookie Policy Inquiry

For EU/UK GDPR-specific requests, please state your jurisdiction in your message so we can apply the correct response timeframe.

---

*Lex (Legal & Compliance @ PolyForge)*
*This document reflects a codebase audit conducted on April 15, 2026.*

---

### Appendix A — Full Cookie and Storage Inventory

| Identifier | Type | Set By | Duration | Transmitted to Server | Contains Personal Data | Category |
|------------|------|--------|----------|-----------------------|----------------------|----------|
| `pf_token` | HTTP Cookie | Auth Service | 15 min | Yes (automatic) | Yes (user ID in JWT) | Strictly Necessary |
| `pf_refresh` | HTTP Cookie | Auth Service | 7 days | Yes (on /auth/v1/refresh) | Yes (user ID in JWT) | Strictly Necessary |
| `pf_admin_token` | HTTP Cookie | Admin Auth Service | 1 hour | Yes (automatic) | Yes (admin ID in JWT) | Strictly Necessary |
| `pf-theme` | Local Storage | User App, Landing | Persistent | No | No | Functional |
| `pf-markets-view` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-portfolio-goals` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-dismissed-suggestions` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-onboarding-complete` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-onboarding-dismissed` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-onboarding-completed` | Local Storage | User App | Persistent | No | No | Functional |
| `pf-onboarding-alert-visited` | Local Storage | User App | Persistent | No | No | Functional |
| `polyforge:builder-tutorial:seen` | Local Storage | User App | Persistent | No | No | Functional |
| `polyforge:onboarding:completed` | Local Storage | User App | Persistent | No | No | Functional |
| `polyforge:onboarding:dismissed` | Local Storage | User App | Persistent | No | No | Functional |
| `polyforge:tour:seen` | Local Storage | User App | Persistent | No | No | Functional |
| `session_expired` | Session Storage | User App | Tab session | No | No | Strictly Necessary |
