# PolyForge Frontend QA Bug Report

**Date:** March 28, 2026
**Tester:** PolyForge CEO Agent (browser walkthrough)
**Environment:** http://127.0.0.1 (Docker dev, nginx gateway)
**Auth user:** alice@dev.local (CONNECTED, admin seed)
**Browser:** Chrome (desktop, 1920×1080)

---

## Summary

| Severity | Count |
|----------|-------|
| **Critical (P0)** | 3 |
| **High (P1)** | 7 |
| **Medium (P2)** | 6 |
| **Low (P3)** | 4 |
| **Total** | **20** |

**Pages tested:** 17 (Markets, Market Detail, Strategy Builder, Strategy List, Portfolio, Orders, Conditional Orders, Backtesting, Copy Trading, Discover, News, Whales, Leaderboard, Settings ×6 tabs, Profile, Support, API Docs, Navigation/Layout)

**Pages passing QA:** Strategy List, Backtesting, Discover, Profile, Support (FAQ + ticket form), Portfolio (Live tab)

---

## Critical (P0) — Blocks core functionality

### BUG-001: Auth session expires during normal browsing
- **Page:** Global (all authenticated pages)
- **Steps:** Login → navigate between pages → after 3-5 page transitions, redirected to /login
- **Expected:** Session persists for reasonable duration (hours)
- **Actual:** Cookie expires or gets cleared within minutes during normal navigation
- **Impact:** Users cannot complete any multi-page workflow without re-authenticating
- **Root cause hypothesis:** Cookie TTL is too short, or the cookie domain is scoped incorrectly for 127.0.0.1 vs localhost

### BUG-002: Strategy builder "Create Strategy" silently fails
- **Page:** /strategies/new
- **Steps:** Fill out strategy name, add blocks (trigger + action + safety), click "Create Strategy"
- **Expected:** Strategy saved, redirect to strategy detail or list with success toast
- **Actual:** Nothing happens — no redirect, no toast, no error message. Page stays on /strategies/new
- **Impact:** Users cannot create strategies through the UI
- **Root cause:** Frontend sends `blocks` property in POST payload; API rejects with 400 "property blocks should not exist". API expects `triggers`, `conditions`, `actions`, `safety` arrays. No error toast displayed on API failure.

### BUG-003: Market detail page renders empty
- **Page:** /markets/:id (tested /markets/1688392)
- **Steps:** Click any market card from the Markets list
- **Expected:** Full market detail with title, description, outcomes, order book, trade panel
- **Actual:** Only "Markets" heading renders — no content, no loading spinner, no error
- **Impact:** Users cannot view market details or place trades on individual markets
- **API check:** GET /api/v1/markets/1688392 returns 200 with full data — frontend rendering issue

---

## High (P1) — Major feature broken

### BUG-004: Markets — category filter doesn't filter results
- **Page:** /markets
- **Steps:** Click "Crypto" category button
- **Expected:** Only crypto markets shown, count updates to reflect filtered results
- **Actual:** URL updates to ?cat=Crypto but still shows "37,635 markets" with sports/politics results (Michigan State, Netanyahu, etc.)
- **Impact:** Category browsing is broken — all 7 categories non-functional

### BUG-005: Markets — sort/view changes cause empty render
- **Page:** /markets
- **Steps:** Change sort to "Newest" or switch to "Table view"
- **Expected:** Market grid re-renders with new sort order or table layout
- **Actual:** Market cards disappear, only "1 / 1506" pagination text remains. No cards, no table.
- **Impact:** Sort and view toggle features completely broken. Only default view (Card + Volume sort) works.

### BUG-006: Leaderboard table shows blank rows
- **Page:** /leaderboard
- **Steps:** Navigate to /leaderboard, observe table
- **Expected:** Rows populated with rank, trader name, score, P&L, win rate, trades
- **Actual:** 10 empty rows with no data in any column, despite API returning valid data (Alice at rank 1, P&L $471.13)
- **Impact:** Leaderboard is non-functional — key social/competitive feature invisible

### BUG-007: Orders table — market names missing
- **Page:** /orders
- **Steps:** View orders list
- **Expected:** Market column shows human-readable market titles
- **Actual:** Market column shows "—" for all 9 orders
- **Impact:** Users cannot identify which market an order belongs to without clicking into it

### BUG-008: Copy Trading "New Copy Config" button broken
- **Page:** /copy
- **Steps:** Click "New Copy Config" button
- **Expected:** Navigate to /copy/new wizard or open modal
- **Actual:** Nothing happens — button click has no effect
- **Impact:** Users cannot create copy trading configs through the main CTA. Workaround: manually navigate to /copy/new (wizard works fine there)

### BUG-009: API Docs page renders empty
- **Page:** /api-docs
- **Steps:** Navigate via sidebar link
- **Expected:** API documentation with endpoints, parameters, examples
- **Actual:** Completely empty page — no content in main area
- **Impact:** Developer-facing documentation inaccessible

### BUG-010: Sidebar toggle button doesn't collapse sidebar
- **Page:** Global (all pages)
- **Steps:** Click "Toggle sidebar" button
- **Expected:** Sidebar collapses to icon-only mode or hides
- **Actual:** Sidebar width stays at 240px — no visual change
- **Impact:** Users cannot reclaim screen space on smaller monitors

---

## Medium (P2) — Feature degraded

### BUG-011: Markets — pagination text inconsistent
- **Page:** /markets
- **Steps:** Search for "bitcoin", observe pagination
- **Expected:** Consistent format like "Showing 1–25 of 1,506 markets"
- **Actual:** Shows "1 / 1506" (compact format) after search, vs "Showing 1–25 of 37,635 markets" on initial load
- **Impact:** Minor UX inconsistency in pagination display

### BUG-012: Portfolio Paper tab shows raw token IDs
- **Page:** /portfolio (Paper tab)
- **Steps:** Switch to Paper tab, view positions table
- **Expected:** Human-readable market names (like Live tab shows)
- **Actual:** TOKEN column shows `token_superbowl_chiefs_no` instead of "Will the Kansas City Chiefs win Super Bowl LXI?"
- **Impact:** Paper traders can't identify their positions by market name

### BUG-013: Settings — profile form doesn't pre-populate
- **Page:** /settings (Profile tab)
- **Steps:** Navigate to Settings, observe Profile form fields
- **Expected:** Display Name, Bio, Avatar URL pre-filled with existing data ("Alice Martin", "Momentum trader...")
- **Actual:** All three fields are empty
- **Impact:** Users must re-enter all profile data even for minor edits; risk of accidental data loss on save

### BUG-014: Settings — Delete Account danger zone on every tab
- **Page:** /settings (all 6 tabs)
- **Steps:** Click through Notifications, Password, 2FA, API Keys, Gas Usage tabs
- **Expected:** Danger Zone (Delete Account) only on Profile tab
- **Actual:** Delete Account section appears at the bottom of every settings tab
- **Impact:** UX clutter; increased risk of accidental account deletion from unexpected locations

### BUG-015: Theme toggle inconsistent behavior
- **Page:** Global (topbar)
- **Steps:** Click "Switch to light mode" → works. Then click "Switch to dark mode"
- **Expected:** Toggles between light and dark consistently
- **Actual:** First toggle works (dark→light), but toggling back may not apply immediately
- **Impact:** Users may get stuck in light mode

### BUG-016: News page has no seed data
- **Page:** /news
- **Steps:** Navigate to News page
- **Expected:** Sample news articles for dev/demo environment
- **Actual:** "No news articles found" — API returns empty array
- **Impact:** Feature cannot be evaluated or demoed without manual data seeding

---

## Low (P3) — Minor / cosmetic

### BUG-017: Whale Tracker has no seed data
- **Page:** /whales
- **Steps:** Navigate to Whales page
- **Expected:** Sample whale trades for dev/demo
- **Actual:** "No whale trades detected yet"
- **Impact:** Feature cannot be demoed; empty state UX is fine

### BUG-018: Market cards missing price/probability data
- **Page:** /markets (card view)
- **Steps:** Observe market cards
- **Expected:** Each card shows current Yes/No prices or probability
- **Actual:** Cards show "—" where price should be, though volume and time data are present
- **Impact:** Users can't see prices without clicking into market detail

### BUG-019: Backtest page — no "New Backtest" button label
- **Page:** /backtest
- **Steps:** Observe the page — the run form is inline rather than behind a CTA
- **Expected:** Clear "New Backtest" action button (consistent with other pages)
- **Actual:** Form is always visible inline, which is actually fine — just inconsistent with "New Copy Config" and "New Ticket" pattern
- **Impact:** Minor inconsistency, no functional issue

### BUG-020: Notifications bell — untested due to session expiry
- **Page:** Global (topbar)
- **Steps:** Could not test — session expired before reaching this feature
- **Expected:** Notification panel/dropdown with recent alerts
- **Actual:** Unknown — needs testing
- **Impact:** Feature coverage gap in this QA round

---

## Positive Findings (Working Well)

| Feature | Status | Notes |
|---------|--------|-------|
| Login/Register forms | ✅ | Validation, error messages, password toggle all work |
| Strategy List | ✅ | All 5 status filters work correctly, cards well-formatted |
| Strategy Builder canvas | ✅ | Block categories, click-to-add, node rendering on canvas |
| Strategy unsaved changes guard | ✅ | "Leave site?" dialog fires when navigating away with changes |
| Portfolio (Live tab) | ✅ | P&L chart, summary cards, positions table with Close actions |
| Orders table | ✅ | Status filters, conditional order dialog with all 5 types |
| Backtesting | ✅ | Strategy dropdown, date pickers, run history with metrics |
| Copy Trading wizard (/copy/new) | ✅ | 5-step wizard renders correctly with Target, Mode, Size, Risk, Review |
| Discover | ✅ | 8 strategies, sort tabs, author info, tags, fork/like counts |
| Profile | ✅ | Edge Rating, badges, verification badges, bio, quick links |
| Support | ✅ | FAQ accordion, ticket form with categories and priority |
| Settings — all 6 tabs | ✅ | Notifications toggles, password change, 2FA, API keys with scopes, gas usage |
| Gasless badge | ✅ | Visible on portfolio, indicates sponsored transactions active |

---

## Recommendations (Priority Order)

1. **Fix auth session persistence (BUG-001)** — this blocks all user testing and will cause immediate churn. Check cookie TTL, domain scope, and httpOnly settings.

2. **Fix strategy creation payload (BUG-002)** — map canvas blocks to the correct API schema (`triggers`/`conditions`/`actions`/`safety` arrays). Add error toast on API failure.

3. **Fix market detail rendering (BUG-003)** — the API data is there, the component just isn't consuming it. Check the detail page's data fetching hook.

4. **Fix markets filter/sort/view (BUG-004, 005)** — likely a single root cause: the grid component re-renders empty when query params change. Check the useEffect dependency array or the query key in React Query.

5. **Fix leaderboard data mapping (BUG-006)** — API returns data but table cells are empty. Check the field names in the table column definition vs API response shape.

6. **Fix orders market name resolution (BUG-007)** — orders likely store a `conditionId` or `tokenId` that needs to be joined/looked up to get the market title.

7. **Wire up Copy Trading CTA (BUG-008)** — add `onClick={() => navigate('/copy/new')}` or make it an `<a href="/copy/new">`.

---

*Past performance does not guarantee future results. Trading on prediction markets involves risk of loss.*
