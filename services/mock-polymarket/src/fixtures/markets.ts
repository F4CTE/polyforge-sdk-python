/**
 * 10 fixture markets for mock-polymarket
 * All are binary (YES/NO) markets aligned with the Prisma seed data.
 */

export interface MockToken {
  tokenId: string;
  outcome: "YES" | "NO";
  price: string; // 0-1 decimal
  liquidity: string; // USD
}

export interface FeeSchedule {
  makerFeeRate: string;
  takerFeeRate: string;
  category: string;
}

export interface MockMarket {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  seriesSlug?: string;
  tokens: [MockToken, MockToken]; // [YES, NO]
  volume24h: string;
  liquidityTotal: string;
  endDate: string;
  closed: boolean;
  active: boolean;
  tickSize: string;
  negRisk: boolean;
  feeSchedule: FeeSchedule;
}

// ─── Static fixture markets ──────────────────────────────────────────────────

export const FIXTURE_MARKETS: MockMarket[] = [
  {
    id: "mkt-001",
    slug: "republicans-control-senate-2026",
    title: "Will Republicans control the Senate after the 2026 midterms?",
    description:
      "Resolves YES if the Republican Party holds majority control of the US Senate after the November 2026 midterm elections.",
    category: "Politics",
    seriesSlug: "us-midterms-2026",
    tokens: [
      {
        tokenId: "tok-001-yes",
        outcome: "YES",
        price: "0.62",
        liquidity: "120000",
      },
      {
        tokenId: "tok-001-no",
        outcome: "NO",
        price: "0.38",
        liquidity: "119500",
      },
    ],
    volume24h: "28500",
    liquidityTotal: "239500",
    endDate: "2026-11-10T00:00:00Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "politics" },
  },
  {
    id: "mkt-002",
    slug: "bitcoin-150k-2026",
    title: "Will Bitcoin reach $150,000 before January 1, 2027?",
    description:
      "Resolves YES if Bitcoin (BTC) trades at or above $150,000 USD on any major exchange before 2027.",
    category: "Crypto",
    tokens: [
      {
        tokenId: "tok-002-yes",
        outcome: "YES",
        price: "0.41",
        liquidity: "85000",
      },
      {
        tokenId: "tok-002-no",
        outcome: "NO",
        price: "0.59",
        liquidity: "84000",
      },
    ],
    volume24h: "41200",
    liquidityTotal: "169000",
    endDate: "2026-12-31T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "crypto" },
  },
  {
    id: "mkt-003",
    slug: "fed-rate-cut-june-2026",
    title: "Will the Fed cut rates at or before the June 2026 FOMC meeting?",
    description:
      "Resolves YES if the Federal Reserve reduces the federal funds rate target at the June 2026 FOMC meeting or any meeting before it.",
    category: "Economics",
    tokens: [
      {
        tokenId: "tok-003-yes",
        outcome: "YES",
        price: "0.73",
        liquidity: "55000",
      },
      {
        tokenId: "tok-003-no",
        outcome: "NO",
        price: "0.27",
        liquidity: "54500",
      },
    ],
    volume24h: "15800",
    liquidityTotal: "109500",
    endDate: "2026-06-17T18:00:00Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "economics" },
  },
  {
    id: "mkt-004",
    slug: "superbowl-lxi-chiefs",
    title: "Will the Kansas City Chiefs win Super Bowl LXI?",
    description:
      "Resolves YES if the Kansas City Chiefs win Super Bowl LXI in February 2027.",
    category: "Sports",
    seriesSlug: "nfl-2026",
    tokens: [
      {
        tokenId: "tok-004-yes",
        outcome: "YES",
        price: "0.19",
        liquidity: "200000",
      },
      {
        tokenId: "tok-004-no",
        outcome: "NO",
        price: "0.81",
        liquidity: "198000",
      },
    ],
    volume24h: "62000",
    liquidityTotal: "398000",
    endDate: "2027-02-08T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "sports" },
  },
  {
    id: "mkt-005",
    slug: "tesla-500-2026",
    title: "Will Tesla stock close above $500 by December 31, 2026?",
    description:
      "Resolves YES if TSLA closing price on NASDAQ is ≥ $500 on any trading day before year-end 2026.",
    category: "Finance",
    tokens: [
      {
        tokenId: "tok-005-yes",
        outcome: "YES",
        price: "0.55",
        liquidity: "45000",
      },
      {
        tokenId: "tok-005-no",
        outcome: "NO",
        price: "0.45",
        liquidity: "44500",
      },
    ],
    volume24h: "9800",
    liquidityTotal: "89500",
    endDate: "2026-12-31T21:00:00Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "finance" },
  },
  {
    id: "mkt-006",
    slug: "ethereum-etf-10b-2026",
    title: "Will Ethereum ETF total AUM exceed $10B by end of 2026?",
    description:
      "Resolves YES if the combined AUM of all US spot Ethereum ETFs exceeds $10 billion USD by December 31, 2026.",
    category: "Crypto",
    tokens: [
      {
        tokenId: "tok-006-yes",
        outcome: "YES",
        price: "0.48",
        liquidity: "38000",
      },
      {
        tokenId: "tok-006-no",
        outcome: "NO",
        price: "0.52",
        liquidity: "37500",
      },
    ],
    volume24h: "7200",
    liquidityTotal: "75500",
    endDate: "2026-12-31T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "crypto" },
  },
  {
    id: "mkt-007",
    slug: "us-recession-2026",
    title: "Will the US enter a recession in 2026?",
    description:
      "Resolves YES if the NBER officially declares a US recession with a start date in calendar year 2026.",
    category: "Economics",
    tokens: [
      {
        tokenId: "tok-007-yes",
        outcome: "YES",
        price: "0.31",
        liquidity: "70000",
      },
      {
        tokenId: "tok-007-no",
        outcome: "NO",
        price: "0.69",
        liquidity: "69500",
      },
    ],
    volume24h: "18500",
    liquidityTotal: "139500",
    endDate: "2026-12-31T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "economics" },
  },
  {
    id: "mkt-008",
    slug: "apple-vision-pro-2-2026",
    title: "Will Apple announce Vision Pro 2 in 2026?",
    description:
      "Resolves YES if Apple officially announces a second-generation Vision Pro headset during a keynote or press release in calendar year 2026.",
    category: "Technology",
    tokens: [
      {
        tokenId: "tok-008-yes",
        outcome: "YES",
        price: "0.67",
        liquidity: "28000",
      },
      {
        tokenId: "tok-008-no",
        outcome: "NO",
        price: "0.33",
        liquidity: "27500",
      },
    ],
    volume24h: "5400",
    liquidityTotal: "55500",
    endDate: "2026-12-31T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "technology" },
  },
  {
    id: "mkt-009",
    slug: "polymarket-10b-volume-2026",
    title: "Will Polymarket reach $10B cumulative volume in 2026?",
    description:
      "Resolves YES if Polymarket reports $10 billion or more in cumulative trading volume for calendar year 2026.",
    category: "Crypto",
    tokens: [
      {
        tokenId: "tok-009-yes",
        outcome: "YES",
        price: "0.82",
        liquidity: "15000",
      },
      {
        tokenId: "tok-009-no",
        outcome: "NO",
        price: "0.18",
        liquidity: "14500",
      },
    ],
    volume24h: "3200",
    liquidityTotal: "29500",
    endDate: "2026-12-31T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "crypto" },
  },
  {
    id: "mkt-010",
    slug: "trump-approval-50-q3-2026",
    title: "Will Trump's approval rating exceed 50% in Q3 2026?",
    description:
      "Resolves YES if any major national poll (Gallup, Reuters, or AP-NORC) shows Donald Trump's approval rating above 50% at any point during Q3 2026 (July 1 – September 30).",
    category: "Politics",
    tokens: [
      {
        tokenId: "tok-010-yes",
        outcome: "YES",
        price: "0.24",
        liquidity: "92000",
      },
      {
        tokenId: "tok-010-no",
        outcome: "NO",
        price: "0.76",
        liquidity: "91500",
      },
    ],
    volume24h: "24000",
    liquidityTotal: "183500",
    endDate: "2026-09-30T23:59:59Z",
    closed: false,
    active: true,
    tickSize: "0.01",
    negRisk: false,
    feeSchedule: { makerFeeRate: "0", takerFeeRate: "0.02", category: "politics" },
  },
];

/** Lookup maps */
export const MARKETS_BY_ID = new Map(FIXTURE_MARKETS.map((m) => [m.id, m]));
export const MARKETS_BY_SLUG = new Map(FIXTURE_MARKETS.map((m) => [m.slug, m]));
export const TOKENS_BY_ID = new Map(
  FIXTURE_MARKETS.flatMap((m) =>
    m.tokens.map((t) => [t.tokenId, { ...t, marketId: m.id }]),
  ),
);
