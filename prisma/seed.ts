/**
 * Polyforge — User Database Seed
 * File: prisma/seed.ts
 *
 * Creates realistic dev data:
 *   - 3 users (alice, bob, charlie)
 *   - Strategies with various statuses
 *   - Orders and positions
 *   - Social interactions (follows, likes, comments)
 *   - Notification preferences
 *   - User limits
 *   - A backtest run
 *   - Price alerts
 *
 * Run: pnpm seed
 * Reset: pnpm reset (drops DB and re-runs migrations + seed)
 */

import { randomBytes } from 'crypto';

if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
  console.error('ERROR: Seed scripts must only run in development environment');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
import { Prisma, PrismaClient } from '.prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt');

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const BCRYPT_COST = 12;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

function generateSeedPassword(): string {
  return randomBytes(16).toString('base64url');
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED SEED UUIDs — deterministic so upserts are idempotent
// ─────────────────────────────────────────────────────────────────────────────

const IDS = {
  // Strategies
  stratMomentum:   'a1b2c3d4-0001-4000-8000-000000000001',
  stratCrossDown:  'a1b2c3d4-0001-4000-8000-000000000002',
  stratScalper:    'a1b2c3d4-0001-4000-8000-000000000003',
  stratForked:     'a1b2c3d4-0001-4000-8000-000000000004',
  // Orders
  order1:  'b2c3d4e5-0002-4000-8000-000000000001',
  order2:  'b2c3d4e5-0002-4000-8000-000000000002',
  order3:  'b2c3d4e5-0002-4000-8000-000000000003',
  order4:  'b2c3d4e5-0002-4000-8000-000000000004',
  order5:  'b2c3d4e5-0002-4000-8000-000000000005',
  order6:  'b2c3d4e5-0002-4000-8000-000000000006',
  order7:  'b2c3d4e5-0002-4000-8000-000000000007',
  order8:  'b2c3d4e5-0002-4000-8000-000000000008',
  order9:  'b2c3d4e5-0002-4000-8000-000000000009',
  // Paper orders
  paperOrder1:      'c3d4e5f6-0003-4000-8000-000000000001',
  paperOrderAlice1: 'c3d4e5f6-0003-4000-8000-000000000002',
  // Backtest runs
  backtest1: 'd4e5f6a7-0004-4000-8000-000000000001',
  backtest2: 'd4e5f6a7-0004-4000-8000-000000000002',
  backtest3: 'd4e5f6a7-0004-4000-8000-000000000003',
  // Backtest orders
  btOrder1: 'e5f6a7b8-0005-4000-8000-000000000001',
  btOrder2: 'e5f6a7b8-0005-4000-8000-000000000002',
  btOrder3: 'e5f6a7b8-0005-4000-8000-000000000003',
  btOrder4: 'e5f6a7b8-0005-4000-8000-000000000004',
  btOrder5: 'e5f6a7b8-0005-4000-8000-000000000005',
  // Comments
  comment1: 'f6a7b8c9-0006-4000-8000-000000000001',
  comment2: 'f6a7b8c9-0006-4000-8000-000000000002',
  comment3: 'f6a7b8c9-0006-4000-8000-000000000003',
  // Fork record
  forkCharlie: 'a7b8c9d0-0007-4000-8000-000000000001',
  // Price alerts
  alert1: 'b8c9d0e1-0008-4000-8000-000000000001',
  alert2: 'b8c9d0e1-0008-4000-8000-000000000002',
  // Strategy templates
  templateMomentum:    'c9d0e1f2-0009-4000-8000-000000000001',
  templateMeanRev:     'c9d0e1f2-0009-4000-8000-000000000002',
  templateNewsReact:   'c9d0e1f2-0009-4000-8000-000000000003',
  templateRiskMgr:     'c9d0e1f2-0009-4000-8000-000000000004',
  templateWhaleFollow: 'c9d0e1f2-0009-4000-8000-000000000005',
  // Login history
  login1: 'd0e1f2a3-0010-4000-8000-000000000001',
  login2: 'd0e1f2a3-0010-4000-8000-000000000002',
  login3: 'd0e1f2a3-0010-4000-8000-000000000003',
  login4: 'd0e1f2a3-0010-4000-8000-000000000004',
  login5: 'd0e1f2a3-0010-4000-8000-000000000005',
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK MARKET / TOKEN IDs (matches mock-polymarket)
// ─────────────────────────────────────────────────────────────────────────────

const MARKETS = {
  usElections: {
    id: 'market_us_elections_2026',
    tokenYes: 'token_us_elections_yes',
    tokenNo: 'token_us_elections_no',
  },
  cryptoEtf: {
    id: 'market_crypto_etf_approval',
    tokenYes: 'token_crypto_etf_yes',
    tokenNo: 'token_crypto_etf_no',
  },
  superbowl: {
    id: 'market_superbowl_2027',
    tokenYes: 'token_superbowl_chiefs_yes',
    tokenNo: 'token_superbowl_chiefs_no',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY BLOCK EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

const momentumTrigger = [
  {
    id: 'trigger_1',
    type: 'PRICE_CROSSES_UP',
    params: { tokenId: MARKETS.usElections.tokenYes, threshold: '0.60' },
  },
];

const momentumConditions = [
  {
    id: 'cond_1',
    type: 'PRICE_ABOVE',
    params: { tokenId: MARKETS.usElections.tokenYes, value: '0.55' },
  },
  {
    id: 'cond_2',
    type: 'BETS_TODAY_LESS_THAN',
    params: { max: 5 },
  },
];

const momentumActions = [
  {
    id: 'action_1',
    type: 'BUY',
    params: {
      tokenId: MARKETS.usElections.tokenYes,
      size: '50',
      orderType: 'GTC',
    },
  },
];

const momentumSafety = [
  {
    id: 'safety_1',
    type: 'DAILY_LOSS_LIMIT',
    params: { maxLossUsdc: '200' },
  },
  {
    id: 'safety_2',
    type: 'MAX_POSITION_SIZE',
    params: { maxSizeUsdc: '500' },
  },
];

const crossDownTrigger = [
  {
    id: 'trigger_1',
    type: 'PRICE_CROSSES_DOWN',
    params: { tokenId: MARKETS.cryptoEtf.tokenYes, threshold: '0.40' },
  },
];

const crossDownActions = [
  {
    id: 'action_1',
    type: 'SELL',
    params: {
      tokenId: MARKETS.cryptoEtf.tokenYes,
      size: '100%',
      orderType: 'GTC',
    },
  },
];

const scalperTrigger = [
  {
    id: 'trigger_1',
    type: 'TICK',
    params: { intervalMs: 1000 },
  },
];

const scalperConditions = [
  {
    id: 'cond_1',
    type: 'SPREAD_ABOVE',
    params: { tokenId: MARKETS.superbowl.tokenYes, minSpread: '0.02' },
  },
];

const scalperActions = [
  {
    id: 'action_1',
    type: 'BUY',
    params: {
      tokenId: MARKETS.superbowl.tokenYes,
      size: '25',
      orderType: 'FOK',
    },
  },
  {
    id: 'action_2',
    type: 'WAIT',
    params: { ms: 5000 },
  },
  {
    id: 'action_3',
    type: 'SELL',
    params: {
      tokenId: MARKETS.superbowl.tokenYes,
      size: '100%',
      orderType: 'GTC',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding user database...\n');

  const seedPassword = generateSeedPassword();
  console.log(`🔑 Generated seed password for all users: ${seedPassword}\n`);

  // ───────────────────────────────────────────────
  // USERS
  // ───────────────────────────────────────────────

  console.log('👤 Creating users...');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@dev.local' },
    update: {},
    create: {
      email: 'alice@dev.local',
      passwordHash: await hashPassword(seedPassword),
      username: 'alice',
      displayName: 'Alice Martin',
      bio: 'Momentum trader. Focused on political markets.',
      showPnl: true,
      showWinrate: true,
      emailVerified: true,
      emailVerifiedAt: daysAgo(30),
      tosAcceptedAt: daysAgo(30),
      polymarketConnected: true,
      polymarketSigType: 1,
      polymarketAddress: '0xAliceDevAddress000000000000000000000001',
      createdAt: daysAgo(60),
      lastSeen: hoursAgo(1),
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@dev.local' },
    update: {},
    create: {
      email: 'bob@dev.local',
      passwordHash: await hashPassword(seedPassword),
      username: 'bob',
      displayName: 'Bob Chen',
      bio: 'Quant background. I backtest everything.',
      showPnl: false,
      showWinrate: true,
      emailVerified: true,
      emailVerifiedAt: daysAgo(20),
      tosAcceptedAt: daysAgo(20),
      createdAt: daysAgo(45),
      lastSeen: hoursAgo(3),
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@dev.local' },
    update: {},
    create: {
      email: 'charlie@dev.local',
      passwordHash: await hashPassword(seedPassword),
      username: 'charlie',
      displayName: 'Charlie Dev',
      bio: 'Just getting started with prediction markets.',
      emailVerified: true,
      emailVerifiedAt: daysAgo(5),
      tosAcceptedAt: daysAgo(5),
      createdAt: daysAgo(5),
      lastSeen: hoursAgo(12),
    },
  });

  // carol — VERIFIED, paper trading only (no polymarket connection)
  const carol = await prisma.user.upsert({
    where: { email: 'carol@dev.local' },
    update: {},
    create: {
      email: 'carol@dev.local',
      passwordHash: await hashPassword(seedPassword),
      username: 'carol',
      displayName: 'Carol Paper',
      bio: 'Paper trading while I learn the ropes.',
      emailVerified: true,
      emailVerifiedAt: daysAgo(7),
      tosAcceptedAt: daysAgo(7),
      createdAt: daysAgo(7),
      lastSeen: hoursAgo(6),
    },
  });

  // dave — VERIFIED but SUSPENDED
  const dave = await prisma.user.upsert({
    where: { email: 'dave@dev.local' },
    update: {},
    create: {
      email: 'dave@dev.local',
      passwordHash: await hashPassword(seedPassword),
      username: 'dave',
      displayName: 'Dave Suspended',
      emailVerified: true,
      emailVerifiedAt: daysAgo(14),
      tosAcceptedAt: daysAgo(14),
      suspended: true,
      suspendedReason: 'Violation of terms of service (dev seed)',
      createdAt: daysAgo(14),
      lastSeen: daysAgo(3),
    },
  });

  console.log(`  ✓ alice   (id: ${alice.id})`);
  console.log(`  ✓ bob     (id: ${bob.id})`);
  console.log(`  ✓ charlie (id: ${charlie.id})`);
  console.log(`  ✓ carol   (id: ${carol.id}) — verified, paper only`);
  console.log(`  ✓ dave    (id: ${dave.id}) — suspended`);

  // ───────────────────────────────────────────────
  // USER LIMITS
  // ───────────────────────────────────────────────

  console.log('\n⚙️  Setting user limits...');

  await prisma.userLimit.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
      maxRunningStrategies: 5,
      maxOrdersPerDay: 500,
      maxOrderSizeUsdc: 1000,
      maxBacktestRunsPerDay: 10,
      circuitBreakerErrors: 5,
    },
  });

  await prisma.userLimit.upsert({
    where: { userId: bob.id },
    update: {},
    create: {
      userId: bob.id,
      maxRunningStrategies: 3,
      maxOrdersPerDay: 200,
      maxOrderSizeUsdc: 500,
      maxBacktestRunsPerDay: 20,
      circuitBreakerErrors: 5,
    },
  });

  await prisma.userLimit.upsert({
    where: { userId: charlie.id },
    update: {},
    create: {
      userId: charlie.id,
      maxRunningStrategies: 2,
      maxOrdersPerDay: 50,
      maxOrderSizeUsdc: 100,
      maxBacktestRunsPerDay: 5,
      circuitBreakerErrors: 3,
    },
  });

  await prisma.userLimit.upsert({
    where: { userId: carol.id },
    update: {},
    create: {
      userId: carol.id,
      maxRunningStrategies: 2,
      maxOrdersPerDay: 50,
      maxOrderSizeUsdc: 100,
      maxBacktestRunsPerDay: 5,
      circuitBreakerErrors: 3,
    },
  });

  await prisma.userLimit.upsert({
    where: { userId: dave.id },
    update: {},
    create: {
      userId: dave.id,
      maxRunningStrategies: 0,
      maxOrdersPerDay: 0,
      maxOrderSizeUsdc: 0,
      maxBacktestRunsPerDay: 0,
      circuitBreakerErrors: 0,
    },
  });

  console.log('  ✓ limits set for all users');

  // ───────────────────────────────────────────────
  // NOTIFICATION PREFERENCES
  // ───────────────────────────────────────────────

  console.log('\n🔔 Setting notification preferences...');

  for (const user of [alice, bob, charlie, carol, dave]) {
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        emailEnabled: true,
        telegramEnabled: false,
        discordEnabled: false,
        onStrategyError: true,
        onOrderFilled: true,
        onDailyLossLimit: true,
        onBacktestComplete: true,
        onMarketResolved: true,
        onSomeoneFelked: false,
        onSomeoneFollowed: true,
        onSomeoneLiked: false,
        onSomeoneCommented: true,
        minFillNotifyUsdc: 10,
        notificationFreq: 'IMMEDIATE',
      },
    });
  }

  console.log('  ✓ notification preferences set for all users');

  // ───────────────────────────────────────────────
  // MARKETS & TOKENS
  // ───────────────────────────────────────────────

  console.log('\n📈 Creating markets & tokens...');

  const marketSeeds = [
    {
      id: MARKETS.usElections.id,
      slug: 'us-elections-2026',
      title: 'Will the Democrats win the 2026 US midterm elections?',
      description: 'Resolves YES if the Democratic Party wins a majority in the House of Representatives in the 2026 midterm elections.',
      category: 'Politics',
      image: 'https://picsum.photos/seed/us-elections/400/200',
      endDate: new Date('2026-11-04'),
      closed: false,
      negRisk: false,
      volume24h: 125000,
      tokens: [
        { id: MARKETS.usElections.tokenYes, outcome: 'YES', price: 0.58, liquidity: 42000 },
        { id: MARKETS.usElections.tokenNo, outcome: 'NO', price: 0.42, liquidity: 38000 },
      ],
    },
    {
      id: MARKETS.cryptoEtf.id,
      slug: 'crypto-etf-approval',
      title: 'Will the SEC approve a spot Ethereum ETF by end of 2026?',
      description: 'Resolves YES if the SEC approves at least one spot Ethereum ETF before January 1, 2027.',
      category: 'Crypto',
      image: 'https://picsum.photos/seed/crypto-etf/400/200',
      endDate: new Date('2026-12-31'),
      closed: false,
      negRisk: false,
      volume24h: 89000,
      tokens: [
        { id: MARKETS.cryptoEtf.tokenYes, outcome: 'YES', price: 0.40, liquidity: 31000 },
        { id: MARKETS.cryptoEtf.tokenNo, outcome: 'NO', price: 0.60, liquidity: 29000 },
      ],
    },
    {
      id: MARKETS.superbowl.id,
      slug: 'superbowl-2027',
      title: 'Will the Kansas City Chiefs win Super Bowl LXI?',
      description: 'Resolves YES if the Kansas City Chiefs win Super Bowl LXI in February 2027.',
      category: 'Sports',
      image: 'https://picsum.photos/seed/superbowl/400/200',
      endDate: new Date('2027-02-14'),
      closed: false,
      negRisk: false,
      volume24h: 210000,
      tokens: [
        { id: MARKETS.superbowl.tokenYes, outcome: 'YES', price: 0.25, liquidity: 55000 },
        { id: MARKETS.superbowl.tokenNo, outcome: 'NO', price: 0.75, liquidity: 51000 },
      ],
    },
  ];

  for (const m of marketSeeds) {
    await prisma.market.upsert({
      where: { id: m.id },
      update: { image: m.image },
      create: {
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description,
        category: m.category,
        image: m.image,
        endDate: m.endDate,
        closed: m.closed,
        negRisk: m.negRisk,
        volume24h: m.volume24h,
      },
    });

    for (const t of m.tokens) {
      await prisma.token.upsert({
        where: { id: t.id },
        update: { price: t.price, liquidity: t.liquidity },
        create: {
          id: t.id,
          marketId: m.id,
          outcome: t.outcome,
          price: t.price,
          liquidity: t.liquidity,
        },
      });
    }
  }

  console.log('  ✓ 3 markets with tokens seeded');

  // ───────────────────────────────────────────────
  // SOCIAL FOLLOWS
  // ───────────────────────────────────────────────

  console.log('\n👥 Creating follows...');

  const follows = [
    { followerId: bob.id, followingId: alice.id },
    { followerId: charlie.id, followingId: alice.id },
    { followerId: charlie.id, followingId: bob.id },
  ];

  for (const f of follows) {
    await prisma.follow.upsert({
      where: { followerId_followingId: f },
      update: {},
      create: { ...f, createdAt: daysAgo(10) },
    });
  }

  console.log('  ✓ bob → alice, charlie → alice, charlie → bob');

  // ───────────────────────────────────────────────
  // STRATEGIES — ALICE
  // ───────────────────────────────────────────────

  console.log('\n♟️  Creating strategies...');

  const stratMomentum = await prisma.strategy.upsert({
    where: { id: IDS.stratMomentum },
    update: {},
    create: {
      id: IDS.stratMomentum,
      userId: alice.id,
      name: 'Momentum Blitz',
      description: 'Buys YES tokens when price crosses above 0.60. Designed for high-volume political markets.',
      visibility: 'PUBLIC',
      execMode: 'EVENT',
      triggers: momentumTrigger,
      conditions: momentumConditions,
      actions: momentumActions,
      safety: momentumSafety,
      status: 'RUNNING',
      tags: ['momentum', 'political', 'yes-bias'],
      forkCount: 3,
      likeCount: 12,
      version: 2,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(2),
    },
  });

  const stratCrossDown = await prisma.strategy.upsert({
    where: { id: IDS.stratCrossDown },
    update: {},
    create: {
      id: IDS.stratCrossDown,
      userId: alice.id,
      name: 'Cross Down Guard',
      description: 'Sells everything when price drops below 0.40.',
      visibility: 'PUBLIC',
      execMode: 'EVENT',
      triggers: crossDownTrigger,
      conditions: [],
      actions: crossDownActions,
      safety: momentumSafety,
      status: 'PAUSED',
      tags: ['defensive', 'sell'],
      forkCount: 1,
      likeCount: 5,
      version: 1,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(5),
    },
  });

  // BOB'S strategy — paper trading
  const stratScalper = await prisma.strategy.upsert({
    where: { id: IDS.stratScalper },
    update: {},
    create: {
      id: IDS.stratScalper,
      userId: bob.id,
      name: 'Safe Scalper v2',
      description: 'High-frequency scalping on spread. Paper trading while I tune the params.',
      visibility: 'UNLISTED',
      execMode: 'TICK',
      tickMs: 1000,
      triggers: scalperTrigger,
      conditions: scalperConditions,
      actions: scalperActions,
      safety: momentumSafety,
      status: 'PAPER',
      tags: ['scalping', 'high-freq', 'wip'],
      forkCount: 0,
      likeCount: 0,
      version: 3,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1),
    },
  });

  // CHARLIE forked from alice
  const stratForked = await prisma.strategy.upsert({
    where: { id: IDS.stratForked },
    update: {},
    create: {
      id: IDS.stratForked,
      userId: charlie.id,
      name: 'Momentum Blitz (fork)',
      description: 'Forked from alice. Lowered threshold to 0.55.',
      visibility: 'PRIVATE',
      execMode: 'EVENT',
      triggers: momentumTrigger,
      conditions: momentumConditions,
      actions: momentumActions,
      safety: momentumSafety,
      status: 'IDLE',
      forkedFromId: stratMomentum.id,
      forkedFromUserId: alice.id,
      tags: ['momentum', 'fork'],
      version: 1,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
  });

  console.log(`  ✓ alice: Momentum Blitz (RUNNING), Cross Down Guard (PAUSED)`);
  console.log(`  ✓ bob:   Safe Scalper v2 (PAPER)`);
  console.log(`  ✓ charlie: Momentum Blitz fork (IDLE)`);

  // ───────────────────────────────────────────────
  // STRATEGY FORK RECORD
  // ───────────────────────────────────────────────

  await prisma.strategyFork.upsert({
    where: { id: IDS.forkCharlie },
    update: {},
    create: {
      id: IDS.forkCharlie,
      originalId: stratMomentum.id,
      forkId: stratForked.id,
      forkedById: charlie.id,
      createdAt: daysAgo(3),
    },
  });

  // ───────────────────────────────────────────────
  // STRATEGY LIKES & COMMENTS
  // ───────────────────────────────────────────────

  console.log('\n❤️  Creating likes and comments...');

  for (const [userId, strategyId] of [
    [bob.id, stratMomentum.id],
    [charlie.id, stratMomentum.id],
    [charlie.id, stratCrossDown.id],
  ]) {
    await prisma.strategyLike.upsert({
      where: { userId_strategyId: { userId, strategyId } },
      update: {},
      create: { userId, strategyId, createdAt: daysAgo(5) },
    });
  }

  const comment1 = await prisma.strategyComment.upsert({
    where: { id: IDS.comment1 },
    update: {},
    create: {
      id: IDS.comment1,
      strategyId: stratMomentum.id,
      userId: bob.id,
      content: 'Really solid strategy. Have you tried a 0.55 threshold instead of 0.60?',
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
  });

  await prisma.strategyComment.upsert({
    where: { id: IDS.comment2 },
    update: {},
    create: {
      id: IDS.comment2,
      strategyId: stratMomentum.id,
      userId: alice.id,
      parentId: comment1.id,
      content: 'Yes I tried it — more trades but lower avg fill quality. 0.60 works better for me.',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
  });

  await prisma.strategyComment.upsert({
    where: { id: IDS.comment3 },
    update: {},
    create: {
      id: IDS.comment3,
      strategyId: stratMomentum.id,
      userId: charlie.id,
      content: 'Just forked this, excited to try it out!',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
  });

  console.log('  ✓ 3 likes, 3 comments (with 1 reply thread)');

  // ───────────────────────────────────────────────
  // ORDERS — ALICE (real, confirmed)
  // ───────────────────────────────────────────────

  console.log('\n📋 Creating orders...');

  const orders = [
    {
      id: IDS.order1,
      intentId: 'intent-seed-order-1',
      clobOrderId: 'clob-order-abc001',
      clobStatus: 'MATCHED',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '50.000000',
      price: '0.620000',
      orderType: 'GTC' as const,
      status: 'CONFIRMED' as const,
      fillSize: '50.000000',
      fillPrice: '0.621000',
      fee: '0.025000',
      placedAt: hoursAgo(48),
      filledAt: hoursAgo(48),
      createdAt: hoursAgo(48),
    },
    {
      id: IDS.order2,
      intentId: 'intent-seed-order-2',
      clobOrderId: 'clob-order-abc002',
      clobStatus: 'MATCHED',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '75.000000',
      price: '0.650000',
      orderType: 'GTC' as const,
      status: 'CONFIRMED' as const,
      fillSize: '75.000000',
      fillPrice: '0.652000',
      fee: '0.037500',
      placedAt: hoursAgo(24),
      filledAt: hoursAgo(24),
      createdAt: hoursAgo(24),
    },
    {
      id: IDS.order3,
      intentId: 'intent-seed-order-3',
      clobOrderId: 'clob-order-abc003',
      clobStatus: 'LIVE',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '50.000000',
      price: '0.680000',
      orderType: 'GTC' as const,
      status: 'LIVE' as const,
      placedAt: hoursAgo(1),
      createdAt: hoursAgo(1),
    },
  ];

  for (const order of orders) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: order as any,
    });
  }

  // Additional orders with varied statuses
  const additionalOrders = [
    {
      id: IDS.order4,
      intentId: 'intent-seed-order-4',
      clobOrderId: 'clob-order-abc004',
      clobStatus: 'CANCELLED',
      userId: alice.id,
      strategyId: stratCrossDown.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '200.000000',
      price: '0.420000',
      orderType: 'GTC' as const,
      status: 'CANCELLED' as const,
      placedAt: daysAgo(5),
      createdAt: daysAgo(5),
    },
    {
      id: IDS.order5,
      intentId: 'intent-seed-order-5',
      clobOrderId: 'clob-order-abc005',
      clobStatus: 'MATCHED',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '200.000000',
      price: '0.415000',
      orderType: 'GTC' as const,
      status: 'CONFIRMED' as const,
      fillSize: '200.000000',
      fillPrice: '0.418000',
      fee: '0.100000',
      placedAt: daysAgo(4),
      filledAt: daysAgo(4),
      createdAt: daysAgo(4),
    },
    {
      id: IDS.order6,
      intentId: 'intent-seed-order-6',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenYes,
      side: 'BUY' as const,
      outcome: 'YES' as const,
      size: '50.000000',
      price: '0.510000',
      orderType: 'FOK' as const,
      status: 'CONFIRMED' as const,
      fillSize: '50.000000',
      fillPrice: '0.510000',
      fee: '0.025000',
      placedAt: daysAgo(3),
      filledAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
    {
      id: IDS.order7,
      intentId: 'intent-seed-order-7',
      userId: alice.id,
      strategyId: stratCrossDown.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenNo,
      side: 'BUY' as const,
      outcome: 'NO' as const,
      size: '60.000000',
      price: '0.380000',
      orderType: 'GTC' as const,
      status: 'CONFIRMED' as const,
      fillSize: '60.000000',
      fillPrice: '0.380000',
      fee: '0.030000',
      placedAt: daysAgo(7),
      filledAt: daysAgo(7),
      createdAt: daysAgo(7),
    },
    {
      id: IDS.order8,
      intentId: 'intent-seed-order-8',
      userId: alice.id,
      strategyId: stratMomentum.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenNo,
      side: 'BUY' as const,
      outcome: 'NO' as const,
      size: '80.000000',
      price: '0.575000',
      orderType: 'GTC' as const,
      status: 'FAILED' as const,
      errorMessage: 'Insufficient balance for order',
      placedAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
    {
      id: IDS.order9,
      intentId: 'intent-seed-order-9',
      clobOrderId: 'clob-order-abc009',
      clobStatus: 'MATCHED',
      userId: alice.id,
      strategyId: stratCrossDown.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenNo,
      side: 'BUY' as const,
      outcome: 'NO' as const,
      size: '80.000000',
      price: '0.580000',
      orderType: 'GTC' as const,
      status: 'CONFIRMED' as const,
      fillSize: '80.000000',
      fillPrice: '0.580000',
      fee: '0.040000',
      placedAt: daysAgo(2),
      filledAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
  ];

  for (const order of additionalOrders) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: order as any,
    });
  }

  console.log('  ✓ 9 orders for alice (5 confirmed, 1 live, 1 cancelled, 1 failed, 1 matched)');

  // ───────────────────────────────────────────────
  // POSITIONS — ALICE
  // ───────────────────────────────────────────────

  console.log('\n📊 Creating positions...');

  await prisma.position.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.usElections.tokenYes } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenYes,
      outcome: 'YES',
      size: '125.000000',
      avgPrice: '0.638000',
      currentPrice: '0.710000',
      unrealizedPnl: '9.000000',
      realizedPnl: '0.000000',
      resolutionStatus: 'UNRESOLVED',
    },
  });

  // Alice — Crypto ETF YES position (in profit)
  await prisma.position.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.cryptoEtf.tokenYes } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenYes,
      outcome: 'YES',
      size: '200.000000',
      avgPrice: '0.420000',
      currentPrice: '0.485000',
      unrealizedPnl: '13.000000',
      realizedPnl: '5.200000',
      resolutionStatus: 'UNRESOLVED',
    },
  });

  // Alice — Crypto ETF NO position (small loss)
  await prisma.position.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.cryptoEtf.tokenNo } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.cryptoEtf.id,
      tokenId: MARKETS.cryptoEtf.tokenNo,
      outcome: 'NO',
      size: '80.000000',
      avgPrice: '0.580000',
      currentPrice: '0.515000',
      unrealizedPnl: '-5.200000',
      realizedPnl: '0.000000',
      resolutionStatus: 'UNRESOLVED',
    },
  });

  // Alice — Superbowl YES position (small position)
  await prisma.position.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.superbowl.tokenYes } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenYes,
      outcome: 'YES',
      size: '50.000000',
      avgPrice: '0.510000',
      currentPrice: '0.550000',
      unrealizedPnl: '2.000000',
      realizedPnl: '0.000000',
      resolutionStatus: 'UNRESOLVED',
    },
  });

  // Alice — US Elections NO position (underwater)
  await prisma.position.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.usElections.tokenNo } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.usElections.id,
      tokenId: MARKETS.usElections.tokenNo,
      outcome: 'NO',
      size: '60.000000',
      avgPrice: '0.380000',
      currentPrice: '0.290000',
      unrealizedPnl: '-5.400000',
      realizedPnl: '0.000000',
      resolutionStatus: 'UNRESOLVED',
    },
  });

  console.log('  ✓ 5 open positions for alice (US Elections YES/NO, Crypto ETF YES/NO, Superbowl YES)');

  // ───────────────────────────────────────────────
  // PAPER POSITIONS — ALICE (paper trading)
  // ───────────────────────────────────────────────

  await prisma.paperPosition.upsert({
    where: { userId_tokenId: { userId: alice.id, tokenId: MARKETS.superbowl.tokenNo } },
    update: {},
    create: {
      userId: alice.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenNo,
      outcome: 'NO',
      size: '100.000000',
      avgPrice: '0.480000',
      currentPrice: '0.450000',
      unrealizedPnl: '-3.000000',
      realizedPnl: '0.000000',
    },
  });

  await prisma.paperOrder.upsert({
    where: { id: IDS.paperOrderAlice1 },
    update: {},
    create: {
      id: IDS.paperOrderAlice1,
      userId: alice.id,
      strategyId: stratCrossDown.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenNo,
      side: 'BUY',
      outcome: 'NO',
      size: '100.000000',
      price: '0.480000',
      orderType: 'GTC',
      status: 'CONFIRMED',
      fillSize: '100.000000',
      fillPrice: '0.480000',
      createdAt: hoursAgo(36),
    },
  });

  console.log('  ✓ 1 paper position + 1 paper order for alice');

  // ───────────────────────────────────────────────
  // PAPER ORDERS & POSITIONS — BOB
  // ───────────────────────────────────────────────

  console.log('\n📝 Creating paper orders and positions...');

  await prisma.paperOrder.upsert({
    where: { id: IDS.paperOrder1 },
    update: {},
    create: {
      id: IDS.paperOrder1,
      userId: bob.id,
      strategyId: stratScalper.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenYes,
      side: 'BUY',
      outcome: 'YES',
      size: '25.000000',
      price: '0.520000',
      orderType: 'FOK',
      status: 'CONFIRMED',
      fillSize: '25.000000',
      fillPrice: '0.522000',
      createdAt: hoursAgo(6),
    },
  });

  await prisma.paperPosition.upsert({
    where: { userId_tokenId: { userId: bob.id, tokenId: MARKETS.superbowl.tokenYes } },
    update: {},
    create: {
      userId: bob.id,
      marketId: MARKETS.superbowl.id,
      tokenId: MARKETS.superbowl.tokenYes,
      outcome: 'YES',
      size: '25.000000',
      avgPrice: '0.522000',
      currentPrice: '0.545000',
      unrealizedPnl: '0.575000',
      realizedPnl: '1.200000',
    },
  });

  console.log('  ✓ 1 paper order + 1 paper position for bob (Superbowl YES)');

  // ───────────────────────────────────────────────
  // BACKTEST RUN — BOB
  // ───────────────────────────────────────────────

  console.log('\n🔬 Creating backtest run...');

  await prisma.backtestRun.upsert({
    where: { id: IDS.backtest1 },
    update: {},
    create: {
      id: IDS.backtest1,
      userId: bob.id,
      strategyId: stratScalper.id,
      dateRangeStart: daysAgo(90),
      dateRangeEnd: daysAgo(1),
      status: 'COMPLETED',
      progress: 100,
      totalOrders: 847,
      filledOrders: 712,
      totalPnl: '124.500000',
      winRate: '0.6740',
      maxDrawdown: '-42.200000',
      sharpeRatio: '1.8400',
      hasDataGaps: false,
      createdAt: daysAgo(2),
      completedAt: daysAgo(2),
    },
  });

  console.log('  ✓ 1 completed backtest for bob (84.1% fill rate, +$124.50)');

  // Additional backtest — alice, completed
  await prisma.backtestRun.upsert({
    where: { id: IDS.backtest2 },
    update: {},
    create: {
      id: IDS.backtest2,
      userId: alice.id,
      strategyId: stratMomentum.id,
      dateRangeStart: daysAgo(60),
      dateRangeEnd: daysAgo(1),
      status: 'COMPLETED',
      progress: 100,
      totalOrders: 312,
      filledOrders: 278,
      totalPnl: '287.350000',
      winRate: '0.7120',
      maxDrawdown: '-58.900000',
      sharpeRatio: '2.1300',
      hasDataGaps: false,
      createdAt: daysAgo(1),
      completedAt: daysAgo(1),
    },
  });

  // Additional backtest — alice, different strategy
  await prisma.backtestRun.upsert({
    where: { id: IDS.backtest3 },
    update: {},
    create: {
      id: IDS.backtest3,
      userId: alice.id,
      strategyId: stratCrossDown.id,
      dateRangeStart: daysAgo(45),
      dateRangeEnd: daysAgo(1),
      status: 'COMPLETED',
      progress: 100,
      totalOrders: 156,
      filledOrders: 134,
      totalPnl: '-42.100000',
      winRate: '0.4480',
      maxDrawdown: '-95.600000',
      sharpeRatio: '0.6200',
      hasDataGaps: true,
      createdAt: daysAgo(3),
      completedAt: daysAgo(3),
    },
  });

  // Backtest orders for alice momentum backtest (sample equity curve)
  const backtestOrdersData = [
    { id: IDS.btOrder1, runId: IDS.backtest2, tokenId: MARKETS.usElections.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '50.000000', price: '0.580000', fillPrice: '0.582000', pnl: '12.500000', equityCurve: '12.500000', simulatedAt: daysAgo(55) },
    { id: IDS.btOrder2, runId: IDS.backtest2, tokenId: MARKETS.usElections.tokenYes, side: 'SELL' as const, outcome: 'YES' as const, size: '50.000000', price: '0.620000', fillPrice: '0.618000', pnl: '18.000000', equityCurve: '30.500000', simulatedAt: daysAgo(50) },
    { id: IDS.btOrder3, runId: IDS.backtest2, tokenId: MARKETS.cryptoEtf.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '100.000000', price: '0.400000', fillPrice: '0.402000', pnl: '-8.200000', equityCurve: '22.300000', simulatedAt: daysAgo(45) },
    { id: IDS.btOrder4, runId: IDS.backtest2, tokenId: MARKETS.usElections.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '75.000000', price: '0.650000', fillPrice: '0.652000', pnl: '35.100000', equityCurve: '57.400000', simulatedAt: daysAgo(40) },
    { id: IDS.btOrder5, runId: IDS.backtest2, tokenId: MARKETS.cryptoEtf.tokenYes, side: 'SELL' as const, outcome: 'YES' as const, size: '100.000000', price: '0.450000', fillPrice: '0.448000', pnl: '44.600000', equityCurve: '102.000000', simulatedAt: daysAgo(30) },
  ];

  for (const btOrder of backtestOrdersData) {
    await prisma.backtestOrder.upsert({
      where: { id: btOrder.id },
      update: {},
      create: btOrder,
    });
  }

  console.log('  ✓ 2 additional backtests (alice momentum +$287.35, alice cross-down -$42.10)');
  console.log('  ✓ 5 backtest orders for alice momentum backtest');

  // ───────────────────────────────────────────────
  // PNL SNAPSHOTS — ALICE (30 days)
  // ───────────────────────────────────────────────

  console.log('\n📈 Creating P&L snapshots...');

  // Generate 30 days of daily P&L snapshots for alice with realistic volatility
  // Start at 0, random walk with slight upward drift
  {
    let cumulativePnl = 0;
    let realizedPnl = 0;
    const pnlSnapshots: { time: Date; userId: string; strategyId: string | null; pnl: string; realizedPnl: string; positionCount: number }[] = [];

    // Seed a simple pseudo-random sequence for reproducibility
    const dailyChanges = [
      12.5, -3.2, 8.7, -1.5, 15.3, -7.8, 4.2, 22.1, -11.4, 6.8,
      -2.1, 9.5, 3.3, -8.9, 18.2, -4.6, 7.1, -15.3, 11.8, 5.4,
      -6.7, 20.5, -9.1, 3.8, 14.2, -2.8, 8.9, -5.1, 16.7, 10.3,
    ];

    for (let i = 30; i >= 1; i--) {
      const change = dailyChanges[30 - i];
      cumulativePnl += change;
      if (change > 0) realizedPnl += change * 0.3; // 30% of gains are realized

      const snapshotTime = new Date(daysAgo(i));
      snapshotTime.setHours(23, 59, 0, 0); // end of day

      pnlSnapshots.push({
        time: snapshotTime,
        userId: alice.id,
        strategyId: null, // portfolio-level snapshot
        pnl: cumulativePnl.toFixed(6),
        realizedPnl: realizedPnl.toFixed(6),
        positionCount: Math.floor(Math.random() * 3) + 3, // 3-5 positions
      });
    }

    // Also generate strategy-level snapshots for alice's momentum strategy
    // Use 23:58 to avoid composite PK collision with portfolio-level (23:59)
    let stratPnl = 0;
    let stratRealizedPnl = 0;
    const stratChanges = [
      8.2, -2.1, 5.5, -0.8, 11.2, -5.3, 3.1, 16.4, -8.2, 4.5,
      -1.3, 6.8, 2.2, -6.1, 13.5, -3.2, 5.0, -10.8, 8.4, 3.7,
      -4.5, 14.8, -6.3, 2.6, 10.1, -1.9, 6.2, -3.5, 12.1, 7.4,
    ];

    for (let i = 30; i >= 1; i--) {
      const change = stratChanges[30 - i];
      stratPnl += change;
      if (change > 0) stratRealizedPnl += change * 0.25;

      const snapshotTime = new Date(daysAgo(i));
      snapshotTime.setHours(23, 58, 0, 0); // 23:58 to avoid PK collision with portfolio-level 23:59

      pnlSnapshots.push({
        time: snapshotTime,
        userId: alice.id,
        strategyId: stratMomentum.id,
        pnl: stratPnl.toFixed(6),
        realizedPnl: stratRealizedPnl.toFixed(6),
        positionCount: Math.floor(Math.random() * 2) + 1,
      });
    }

    // Use createMany for efficiency (PnlSnapshot has composite PK on [time, userId])
    // Since composite PK includes time and userId, and strategy-level snapshots share
    // the same time+userId, we need to insert them individually with raw SQL
    for (const snap of pnlSnapshots) {
      await prisma.$executeRaw(
        Prisma.sql`INSERT INTO pnl_snapshots (time, "userId", "strategyId", pnl, "realizedPnl", "positionCount")
         VALUES (${snap.time}, ${snap.userId}, ${snap.strategyId}, ${snap.pnl}, ${snap.realizedPnl}, ${snap.positionCount})
         ON CONFLICT DO NOTHING`,
      );
    }

    console.log(`  ✓ ${pnlSnapshots.length} P&L snapshots for alice (30 days portfolio + 30 days momentum strategy)`);
  }

  // ───────────────────────────────────────────────
  // PRICE ALERTS — ALICE
  // ───────────────────────────────────────────────

  console.log('\n🔔 Creating price alerts...');

  await prisma.priceAlert.upsert({
    where: { id: IDS.alert1 },
    update: {},
    create: {
      id: IDS.alert1,
      userId: alice.id,
      tokenId: MARKETS.usElections.tokenYes,
      direction: 'above',
      price: '0.750000',
      persistent: false,
      triggered: false,
      createdAt: daysAgo(1),
    },
  });

  await prisma.priceAlert.upsert({
    where: { id: IDS.alert2 },
    update: {},
    create: {
      id: IDS.alert2,
      userId: alice.id,
      tokenId: MARKETS.cryptoEtf.tokenYes,
      direction: 'below',
      price: '0.350000',
      persistent: true,
      triggered: false,
      createdAt: daysAgo(3),
    },
  });

  console.log('  ✓ 2 price alerts for alice');

  // ───────────────────────────────────────────────
  // LOGIN HISTORY
  // ───────────────────────────────────────────────

  console.log('\n🔑 Creating login history...');

  const loginHistory = [
    { id: IDS.login1, userId: alice.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(1) },
    { id: IDS.login2, userId: alice.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: daysAgo(1) },
    { id: IDS.login3, userId: bob.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(3) },
    { id: IDS.login4, userId: charlie.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: false, createdAt: hoursAgo(12) },
    { id: IDS.login5, userId: charlie.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(11) },
  ];

  for (const entry of loginHistory) {
    await prisma.userLoginHistory.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }

  console.log('  ✓ 5 login history entries');

  // ───────────────────────────────────────────────
  // STRATEGY TEMPLATES (for educational onboarding)
  // ───────────────────────────────────────────────

  console.log('\n📋 Creating strategy templates...');

  const templates = [
    {
      id: IDS.templateMomentum,
      name: 'Simple Momentum',
      description: 'Buys YES when price crosses above 0.6 — a straightforward trend-following template for beginners.',
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      userId: alice.id,
      execMode: 'EVENT',
      tickMs: 5000,
      blocks: JSON.stringify({
        triggers: [{ id: 't1', type: 'PRICE_CROSSES_UP', params: { threshold: '0.60' } }],
        conditions: [{ id: 'c1', type: 'MAX_POSITION_SIZE', params: { maxSizeUsdc: '200' } }],
        actions: [{ id: 'a1', type: 'BUY', params: { side: 'YES', size: '50', orderType: 'GTC' } }],
        safety: [{ id: 's1', type: 'DAILY_LOSS_LIMIT', params: { maxLossUsdc: '100' } }],
      }),
      createdAt: daysAgo(30),
    },
    {
      id: IDS.templateMeanRev,
      name: 'Mean Reversion',
      description: 'Buys when price drops below the recent average — capitalizes on temporary dips that tend to revert.',
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      userId: alice.id,
      execMode: 'TICK',
      tickMs: 10000,
      blocks: JSON.stringify({
        triggers: [{ id: 't1', type: 'PRICE_BELOW_TICK', params: { threshold: '0.40' } }],
        conditions: [
          { id: 'c1', type: 'NO_EXISTING_POSITION', params: {} },
          { id: 'c2', type: 'MIN_LIQUIDITY', params: { minLiquidity: '1000' } },
        ],
        actions: [{ id: 'a1', type: 'BUY', params: { side: 'YES', size: '100', orderType: 'GTC' } }],
        safety: [
          { id: 's1', type: 'DAILY_LOSS_LIMIT', params: { maxLossUsdc: '150' } },
          { id: 's2', type: 'MAX_ORDERS_TOTAL', params: { max: 10 } },
        ],
      }),
      createdAt: daysAgo(28),
    },
    {
      id: IDS.templateNewsReact,
      name: 'News Reactive',
      description: 'Uses AI news signals to trigger trades — buys when high-confidence bullish signals are detected.',
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      userId: bob.id,
      execMode: 'EVENT',
      tickMs: 5000,
      blocks: JSON.stringify({
        triggers: [{ id: 't1', type: 'PRICE_CROSSES_UP', params: { threshold: '0.55' } }],
        conditions: [
          { id: 'c1', type: 'BETS_TODAY_LESS_THAN', params: { max: 3 } },
          { id: 'c2', type: 'COOLDOWN_AFTER_TRADE', params: { cooldownMs: 60000 } },
        ],
        actions: [{ id: 'a1', type: 'BUY', params: { side: 'YES', size: '75', orderType: 'GTC' } }],
        safety: [{ id: 's1', type: 'DAILY_LOSS_LIMIT', params: { maxLossUsdc: '200' } }],
      }),
      createdAt: daysAgo(25),
    },
    {
      id: IDS.templateRiskMgr,
      name: 'Risk Manager',
      description: 'Stop-loss and take-profit wrapper — automatically exits positions when price targets are hit.',
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      userId: bob.id,
      execMode: 'TICK',
      tickMs: 2000,
      blocks: JSON.stringify({
        triggers: [{ id: 't1', type: 'EVERY_TICK', params: {} }],
        conditions: [{ id: 'c1', type: 'PRICE_IN_RANGE', params: { min: '0.10', max: '0.90' } }],
        actions: [
          { id: 'a1', type: 'SET_STOP_LOSS', params: { pct: '10' } },
          { id: 'a2', type: 'TAKE_PROFIT', params: { pct: '20' } },
        ],
        safety: [
          { id: 's1', type: 'DAILY_LOSS_LIMIT', params: { maxLossUsdc: '100' } },
          { id: 's2', type: 'CONSECUTIVE_LOSS_STOP', params: { maxConsecutive: 3 } },
        ],
      }),
      createdAt: daysAgo(22),
    },
    {
      id: IDS.templateWhaleFollow,
      name: 'Whale Follower',
      description: 'Copies whale trades with size and risk filters — follows smart money while managing your exposure.',
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      userId: alice.id,
      execMode: 'EVENT',
      tickMs: 5000,
      blocks: JSON.stringify({
        triggers: [{ id: 't1', type: 'PRICE_CROSSES_UP', params: { threshold: '0.50' } }],
        conditions: [
          { id: 'c1', type: 'MAX_POSITION_SIZE', params: { maxSizeUsdc: '500' } },
          { id: 'c2', type: 'MIN_LIQUIDITY', params: { minLiquidity: '5000' } },
        ],
        actions: [{ id: 'a1', type: 'BUY', params: { side: 'YES', size: '100', orderType: 'GTC' } }],
        safety: [
          { id: 's1', type: 'DAILY_LOSS_LIMIT', params: { maxLossUsdc: '250' } },
          { id: 's2', type: 'MAX_POSITION_SIZE', params: { maxSizeUsdc: '500' } },
        ],
      }),
      createdAt: daysAgo(20),
    },
  ];

  for (const tmpl of templates) {
    await prisma.strategy.upsert({
      where: { id: tmpl.id },
      update: {},
      create: {
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        template: (tmpl as any).isTemplate ?? (tmpl as any).template ?? false,
        visibility: tmpl.visibility as any,
        userId: tmpl.userId,
        execMode: tmpl.execMode as any,
        tickMs: tmpl.tickMs,
        safety: (tmpl as any).blocks ? JSON.parse((tmpl as any).blocks).safety ?? [] : [],
        triggers: (tmpl as any).blocks ? JSON.parse((tmpl as any).blocks).triggers ?? [] : [],
        conditions: (tmpl as any).blocks ? JSON.parse((tmpl as any).blocks).conditions ?? [] : [],
        actions: (tmpl as any).blocks ? JSON.parse((tmpl as any).blocks).actions ?? [] : [],
        status: 'IDLE',
        version: 1,
        createdAt: tmpl.createdAt,
      },
    });
  }

  console.log('  ✓ 5 strategy templates (Simple Momentum, Mean Reversion, News Reactive, Risk Manager, Whale Follower)');

  // ───────────────────────────────────────────────
  // APPROVE ALL USERS (fix INVITE_ONLY login block)
  // ───────────────────────────────────────────────

  console.log('🔓 Approving all seed users...');
  await prisma.user.updateMany({
    where: { approved: false },
    data: { approved: true, approvedAt: new Date() },
  });
  console.log('  ✓ All users approved');

  // ───────────────────────────────────────────────
  // NEWS ARTICLES & SIGNALS
  // ───────────────────────────────────────────────

  console.log('📰 Seeding news articles & signals...');

  // Grab real market IDs from synced Polymarket data
  const realMarkets = await prisma.market.findMany({
    where: { closed: false },
    orderBy: { volume24h: 'desc' },
    take: 8,
    select: { id: true, title: true },
  });

  // Also grab tokens for those markets
  const realTokens = realMarkets.length > 0
    ? await prisma.token.findMany({
        where: { marketId: { in: realMarkets.map((m) => m.id) } },
        select: { id: true, marketId: true, outcome: true },
      })
    : [];

  const tokenForMarket = (mktId: string, outcome = 'YES') =>
    realTokens.find((t) => t.marketId === mktId && t.outcome === outcome)?.id ?? 'token_placeholder';

  const newsArticles = [
    {
      id: 'news-seed-001',
      source: 'Reuters',
      title: 'Netanyahu faces mounting pressure as ceasefire deadline looms',
      summary:
        'Israeli PM Netanyahu is under increasing domestic and international pressure to finalize a ceasefire agreement before the March 31 deadline. Analysts say the outcome could shift prediction market odds significantly, with current YES prices hovering around 65 cents.',
      url: 'https://reuters.com/seed/netanyahu-ceasefire-2026',
      sentiment: 'NEGATIVE' as const,
      publishedAt: hoursAgo(2),
    },
    {
      id: 'news-seed-002',
      source: 'CoinDesk',
      title: 'Bitcoin surges past $92K as institutional inflows hit record',
      summary:
        'Bitcoin climbed above $92,000 for the first time in three weeks, driven by record-breaking institutional ETF inflows of $1.2 billion in a single day. Polymarket traders are repricing crypto-related contracts as momentum builds toward the $100K barrier.',
      url: 'https://coindesk.com/seed/bitcoin-92k-surge-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(4),
    },
    {
      id: 'news-seed-003',
      source: 'ESPN',
      title: 'March Madness upsets reshape bracket odds heading into Elite Eight',
      summary:
        'A string of upsets in the Sweet Sixteen has dramatically shifted the NCAA tournament landscape. No. 11 seed VCU stunned top-seeded Duke, while No. 7 Clemson knocked off No. 2 Arizona. Prediction markets are repricing championship futures across the board.',
      url: 'https://espn.com/seed/march-madness-elite-eight-2026',
      sentiment: 'NEUTRAL' as const,
      publishedAt: hoursAgo(6),
    },
    {
      id: 'news-seed-004',
      source: 'Bloomberg',
      title: 'Fed signals potential rate cut as PCE inflation undershoots forecast',
      summary:
        'The Federal Reserve\'s preferred inflation gauge, core PCE, came in at 2.1% year-over-year — below the 2.3% consensus. Multiple Fed governors have signaled openness to a June rate cut. Bond markets rallied immediately on the news.',
      url: 'https://bloomberg.com/seed/fed-pce-rate-cut-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(8),
    },
    {
      id: 'news-seed-005',
      source: 'TechCrunch',
      title: 'OpenAI launches GPT-5 with real-time reasoning capabilities',
      summary:
        'OpenAI unveiled GPT-5 today, featuring what the company calls "continuous reasoning." The launch sent prediction market contracts on AI milestones surging, with "AGI by 2027" jumping 12 percentage points.',
      url: 'https://techcrunch.com/seed/openai-gpt-5-launch-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(10),
    },
    {
      id: 'news-seed-006',
      source: 'AP News',
      title: 'US forces positioning near Iranian border raises tension',
      summary:
        'US military assets have been repositioned in the Persian Gulf region amid heightened tensions with Iran. The Pentagon described the move as "routine readiness adjustments" but prediction market odds on military action have ticked upward by 8 points.',
      url: 'https://apnews.com/seed/us-forces-iran-2026',
      sentiment: 'NEGATIVE' as const,
      publishedAt: hoursAgo(12),
    },
    {
      id: 'news-seed-007',
      source: 'CNBC',
      title: 'S&P 500 hits all-time high as tech earnings beat expectations',
      summary:
        'The S&P 500 closed at a record 5,847, boosted by better-than-expected earnings from Nvidia, Microsoft, and Amazon. Prediction market contracts on "S&P above 6000 by June" moved to 72 cents.',
      url: 'https://cnbc.com/seed/sp500-record-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(14),
    },
    {
      id: 'news-seed-008',
      source: 'The Block',
      title: 'Ethereum layer-2 transactions surpass mainnet for the first time',
      summary:
        'Combined transaction volume across Ethereum L2 networks (Arbitrum, Optimism, Base, zkSync) has officially exceeded Ethereum mainnet daily throughput. This milestone reignites the debate around ETH value accrual.',
      url: 'https://theblock.co/seed/eth-l2-surpass-mainnet-2026',
      sentiment: 'NEUTRAL' as const,
      publishedAt: hoursAgo(18),
    },
    {
      id: 'news-seed-009',
      source: 'ESPN',
      title: 'Clippers acquire key piece at trade deadline, championship odds shift',
      summary:
        'The LA Clippers completed a blockbuster deal acquiring a top defensive wing. Sportsbooks and prediction markets alike have adjusted — Clippers championship futures moved from +2200 to +1400 overnight.',
      url: 'https://espn.com/seed/clippers-trade-deadline-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(22),
    },
    {
      id: 'news-seed-010',
      source: 'CNN',
      title: 'Senate passes bipartisan crypto regulation bill in landmark vote',
      summary:
        'The US Senate voted 68-32 to pass the Digital Asset Market Structure Act, providing the first comprehensive regulatory framework for cryptocurrencies. The bill now heads to the House. Crypto markets rallied on the news.',
      url: 'https://cnn.com/seed/senate-crypto-regulation-2026',
      sentiment: 'POSITIVE' as const,
      publishedAt: hoursAgo(26),
    },
  ];

  for (const article of newsArticles) {
    await prisma.newsArticle.upsert({
      where: { url: article.url },
      update: {},
      create: {
        id: article.id,
        source: article.source,
        title: article.title,
        summary: article.summary,
        url: article.url,
        sentiment: article.sentiment,
        publishedAt: article.publishedAt,
      },
    });
  }

  // Create signals referencing real markets (if any synced markets exist)
  if (realMarkets.length >= 2) {
    const signalData = [
      { articleId: 'news-seed-001', marketId: realMarkets[0].id, direction: 'BUY', outcome: 'YES', confidence: 82, reasoning: 'Ceasefire deadline pressure increases probability of resolution. Market underpricing based on diplomatic sources.' },
      { articleId: 'news-seed-001', marketId: realMarkets[1].id, direction: 'SELL', outcome: 'NO', confidence: 65, reasoning: 'Geopolitical uncertainty causes correlated moves across political markets. Hedging recommended.' },
      { articleId: 'news-seed-002', marketId: realMarkets[Math.min(2, realMarkets.length - 1)].id, direction: 'BUY', outcome: 'YES', confidence: 88, reasoning: 'Record ETF inflows are a strong leading indicator. Institutional momentum typically sustains for 2-3 weeks.' },
      { articleId: 'news-seed-003', marketId: realMarkets[Math.min(3, realMarkets.length - 1)].id, direction: 'SELL', outcome: 'YES', confidence: 71, reasoning: 'Bracket chaos creates mispricing opportunities. Historical upset patterns suggest further volatility.' },
      { articleId: 'news-seed-004', marketId: realMarkets[0].id, direction: 'BUY', outcome: 'YES', confidence: 91, reasoning: 'PCE undershoot + Fed commentary strongly suggest June cut. Market is lagging behind the signal.' },
      { articleId: 'news-seed-005', marketId: realMarkets[Math.min(5, realMarkets.length - 1)].id, direction: 'BUY', outcome: 'YES', confidence: 78, reasoning: 'GPT-5 capabilities exceed expectations. AI milestone contracts are repricing but still behind the curve.' },
      { articleId: 'news-seed-006', marketId: realMarkets[1].id, direction: 'SELL', outcome: 'YES', confidence: 73, reasoning: 'Military positioning increases tail risk. Geopolitical markets should price in higher uncertainty.' },
      { articleId: 'news-seed-007', marketId: realMarkets[Math.min(6, realMarkets.length - 1)].id, direction: 'BUY', outcome: 'YES', confidence: 85, reasoning: 'Tech earnings momentum and rate cut expectations create strong bullish confluence for equity index targets.' },
      { articleId: 'news-seed-009', marketId: realMarkets[Math.min(7, realMarkets.length - 1)].id, direction: 'BUY', outcome: 'YES', confidence: 69, reasoning: 'Roster upgrade shifts championship probability. Market odds haven\'t fully adjusted to the new lineup strength.' },
      { articleId: 'news-seed-010', marketId: realMarkets[Math.min(2, realMarkets.length - 1)].id, direction: 'BUY', outcome: 'YES', confidence: 93, reasoning: 'Regulatory clarity is the biggest catalyst for institutional crypto adoption. Landmark event.' },
    ];

    for (const sig of signalData) {
      try {
        await prisma.newsSignal.create({
          data: {
            articleId: sig.articleId,
            marketId: sig.marketId,
            direction: sig.direction,
            outcome: sig.outcome,
            confidence: sig.confidence,
            reasoning: sig.reasoning,
          },
        });
      } catch { /* skip duplicates or FK errors */ }
    }
  }

  console.log(`  ✓ ${newsArticles.length} news articles + signals (linked to ${realMarkets.length} real markets)`);

  // ───────────────────────────────────────────────
  // WHALE PROFILES & ALERTS
  // ───────────────────────────────────────────────

  console.log('🐋 Seeding whale profiles & alerts...');

  const whaleProfiles = [
    { walletAddress: '0x1234567890abcdef1234567890abcdef12345678', totalVolume: 2850000, totalPnl: 342000, tradeCount: 847, winRate: 67.3, lastTradeAt: hoursAgo(0.5) },
    { walletAddress: '0xdeadbeef00000000000000000000000000000001', totalVolume: 1420000, totalPnl: -89000, tradeCount: 523, winRate: 48.2, lastTradeAt: hoursAgo(2) },
    { walletAddress: '0xWhaleAlpha000000000000000000000000000001', totalVolume: 980000, totalPnl: 215000, tradeCount: 312, winRate: 72.1, lastTradeAt: hoursAgo(1) },
    { walletAddress: '0xBigFish00000000000000000000000000000001', totalVolume: 750000, totalPnl: 167000, tradeCount: 198, winRate: 63.5, lastTradeAt: hoursAgo(4) },
    { walletAddress: '0xMobyDick0000000000000000000000000000001', totalVolume: 3200000, totalPnl: 890000, tradeCount: 1204, winRate: 71.8, lastTradeAt: hoursAgo(0.25) },
    { walletAddress: '0xKrakenWallet000000000000000000000000001', totalVolume: 560000, totalPnl: 45000, tradeCount: 156, winRate: 55.8, lastTradeAt: hoursAgo(6) },
    { walletAddress: '0xDeepBlue0000000000000000000000000000001', totalVolume: 1100000, totalPnl: 298000, tradeCount: 445, winRate: 68.9, lastTradeAt: hoursAgo(3) },
    { walletAddress: '0xLeviathan000000000000000000000000000001', totalVolume: 480000, totalPnl: -23000, tradeCount: 134, winRate: 44.7, lastTradeAt: hoursAgo(8) },
  ];

  for (const wp of whaleProfiles) {
    await prisma.whaleProfile.upsert({
      where: { walletAddress: wp.walletAddress },
      update: {},
      create: {
        walletAddress: wp.walletAddress,
        totalVolume: wp.totalVolume,
        totalPnl: wp.totalPnl,
        tradeCount: wp.tradeCount,
        winRate: wp.winRate,
        lastTradeAt: wp.lastTradeAt,
      },
    });
  }

  // Create whale alerts linked to real markets
  if (realMarkets.length >= 4) {
    const whaleAlerts = [
      { walletAddress: '0x1234567890abcdef1234567890abcdef12345678', marketId: realMarkets[0].id, tokenId: tokenForMarket(realMarkets[0].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 85000, price: 0.65, notional: 55250, detectedAt: hoursAgo(0.5) },
      { walletAddress: '0x1234567890abcdef1234567890abcdef12345678', marketId: realMarkets[1].id, tokenId: tokenForMarket(realMarkets[1].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 120000, price: 0.42, notional: 50400, detectedAt: hoursAgo(2) },
      { walletAddress: '0xdeadbeef00000000000000000000000000000001', marketId: realMarkets[2].id, tokenId: tokenForMarket(realMarkets[2].id, 'NO'), side: 'SELL' as const, outcome: 'NO' as const, size: 200000, price: 0.35, notional: 70000, detectedAt: hoursAgo(1) },
      { walletAddress: '0xdeadbeef00000000000000000000000000000001', marketId: realMarkets[0].id, tokenId: tokenForMarket(realMarkets[0].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 50000, price: 0.67, notional: 33500, detectedAt: hoursAgo(4) },
      { walletAddress: '0xWhaleAlpha000000000000000000000000000001', marketId: realMarkets[3].id, tokenId: tokenForMarket(realMarkets[3].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 75000, price: 0.55, notional: 41250, detectedAt: hoursAgo(0.75) },
      { walletAddress: '0xWhaleAlpha000000000000000000000000000001', marketId: realMarkets[Math.min(4, realMarkets.length - 1)].id, tokenId: tokenForMarket(realMarkets[Math.min(4, realMarkets.length - 1)].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 60000, price: 0.72, notional: 43200, detectedAt: hoursAgo(3) },
      { walletAddress: '0xMobyDick0000000000000000000000000000001', marketId: realMarkets[0].id, tokenId: tokenForMarket(realMarkets[0].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 300000, price: 0.65, notional: 195000, detectedAt: hoursAgo(0.25) },
      { walletAddress: '0xMobyDick0000000000000000000000000000001', marketId: realMarkets[1].id, tokenId: tokenForMarket(realMarkets[1].id, 'YES'), side: 'SELL' as const, outcome: 'YES' as const, size: 150000, price: 0.78, notional: 117000, detectedAt: hoursAgo(1) },
      { walletAddress: '0xMobyDick0000000000000000000000000000001', marketId: realMarkets[2].id, tokenId: tokenForMarket(realMarkets[2].id, 'NO'), side: 'BUY' as const, outcome: 'NO' as const, size: 180000, price: 0.31, notional: 55800, detectedAt: hoursAgo(5) },
      { walletAddress: '0xBigFish00000000000000000000000000000001', marketId: realMarkets[3].id, tokenId: tokenForMarket(realMarkets[3].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 45000, price: 0.60, notional: 27000, detectedAt: hoursAgo(4) },
      { walletAddress: '0xDeepBlue0000000000000000000000000000001', marketId: realMarkets[Math.min(4, realMarkets.length - 1)].id, tokenId: tokenForMarket(realMarkets[Math.min(4, realMarkets.length - 1)].id, 'YES'), side: 'SELL' as const, outcome: 'YES' as const, size: 95000, price: 0.48, notional: 45600, detectedAt: hoursAgo(3) },
      { walletAddress: '0xDeepBlue0000000000000000000000000000001', marketId: realMarkets[0].id, tokenId: tokenForMarket(realMarkets[0].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 110000, price: 0.66, notional: 72600, detectedAt: hoursAgo(6) },
      { walletAddress: '0xKrakenWallet000000000000000000000000001', marketId: realMarkets[1].id, tokenId: tokenForMarket(realMarkets[1].id, 'YES'), side: 'BUY' as const, outcome: 'YES' as const, size: 38000, price: 0.43, notional: 16340, detectedAt: hoursAgo(6) },
      { walletAddress: '0xLeviathan000000000000000000000000000001', marketId: realMarkets[2].id, tokenId: tokenForMarket(realMarkets[2].id, 'NO'), side: 'BUY' as const, outcome: 'NO' as const, size: 65000, price: 0.28, notional: 18200, detectedAt: hoursAgo(8) },
      { walletAddress: '0xLeviathan000000000000000000000000000001', marketId: realMarkets[3].id, tokenId: tokenForMarket(realMarkets[3].id, 'YES'), side: 'SELL' as const, outcome: 'YES' as const, size: 42000, price: 0.71, notional: 29820, detectedAt: hoursAgo(10) },
    ];

    for (const wa of whaleAlerts) {
      try {
        await prisma.whaleAlert.create({
          data: {
            walletAddress: wa.walletAddress,
            marketId: wa.marketId,
            tokenId: wa.tokenId,
            side: wa.side,
            outcome: wa.outcome,
            size: wa.size,
            price: wa.price,
            notional: wa.notional,
            txHash: '0xseed' + Math.random().toString(16).slice(2, 14),
            detectedAt: wa.detectedAt,
          },
        });
      } catch { /* skip FK errors */ }
    }
  }

  console.log(`  ✓ ${whaleProfiles.length} whale profiles + ${realMarkets.length >= 4 ? 15 : 0} whale alerts`);

  // ───────────────────────────────────────────────
  // DONE
  // ───────────────────────────────────────────────

  console.log('\n✅ User database seed complete!\n');
  console.log('  Dev credentials (password shown at seed start):');
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log(`  │  All users share the generated password above     │`);
  console.log(`  │  alice@dev.local   (connected)                    │`);
  console.log(`  │  bob@dev.local     (verified)                     │`);
  console.log(`  │  charlie@dev.local (verified)                     │`);
  console.log(`  │  carol@dev.local   (paper)                        │`);
  console.log(`  │  dave@dev.local    (suspended)                    │`);
  console.log('  └──────────────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
