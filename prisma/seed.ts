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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
import { PrismaClient } from '.prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const BCRYPT_COST = 12;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
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

  // ───────────────────────────────────────────────
  // USERS
  // ───────────────────────────────────────────────

  console.log('👤 Creating users...');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@dev.local' },
    update: {},
    create: {
      email: 'alice@dev.local',
      passwordHash: await hashPassword('password123'),
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
      passwordHash: await hashPassword('password123'),
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
      passwordHash: await hashPassword('password123'),
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
      passwordHash: await hashPassword('Test1234!'),
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
      passwordHash: await hashPassword('Test1234!'),
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
    where: { id: 'seed-strat-alice-momentum' },
    update: {},
    create: {
      id: 'seed-strat-alice-momentum',
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
    where: { id: 'seed-strat-alice-crossdown' },
    update: {},
    create: {
      id: 'seed-strat-alice-crossdown',
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
    where: { id: 'seed-strat-bob-scalper' },
    update: {},
    create: {
      id: 'seed-strat-bob-scalper',
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
    where: { id: 'seed-strat-charlie-fork' },
    update: {},
    create: {
      id: 'seed-strat-charlie-fork',
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
    where: { id: 'seed-fork-charlie-momentum' },
    update: {},
    create: {
      id: 'seed-fork-charlie-momentum',
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
    where: { id: 'seed-comment-1' },
    update: {},
    create: {
      id: 'seed-comment-1',
      strategyId: stratMomentum.id,
      userId: bob.id,
      content: 'Really solid strategy. Have you tried a 0.55 threshold instead of 0.60?',
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
  });

  await prisma.strategyComment.upsert({
    where: { id: 'seed-comment-2' },
    update: {},
    create: {
      id: 'seed-comment-2',
      strategyId: stratMomentum.id,
      userId: alice.id,
      parentId: comment1.id,
      content: 'Yes I tried it — more trades but lower avg fill quality. 0.60 works better for me.',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
  });

  await prisma.strategyComment.upsert({
    where: { id: 'seed-comment-3' },
    update: {},
    create: {
      id: 'seed-comment-3',
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
      id: 'seed-order-1',
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
      id: 'seed-order-2',
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
      id: 'seed-order-3',
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
      id: 'seed-order-4',
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
      id: 'seed-order-5',
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
      id: 'seed-order-6',
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
      id: 'seed-order-7',
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
      id: 'seed-order-8',
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
      id: 'seed-order-9',
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
    where: { id: 'seed-paper-order-alice-1' },
    update: {},
    create: {
      id: 'seed-paper-order-alice-1',
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
    where: { id: 'seed-paper-order-1' },
    update: {},
    create: {
      id: 'seed-paper-order-1',
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
    where: { id: 'seed-backtest-1' },
    update: {},
    create: {
      id: 'seed-backtest-1',
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
    where: { id: 'seed-backtest-2' },
    update: {},
    create: {
      id: 'seed-backtest-2',
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
    where: { id: 'seed-backtest-3' },
    update: {},
    create: {
      id: 'seed-backtest-3',
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
    { id: 'seed-bt-order-1', runId: 'seed-backtest-2', tokenId: MARKETS.usElections.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '50.000000', price: '0.580000', fillPrice: '0.582000', pnl: '12.500000', equityCurve: '12.500000', simulatedAt: daysAgo(55) },
    { id: 'seed-bt-order-2', runId: 'seed-backtest-2', tokenId: MARKETS.usElections.tokenYes, side: 'SELL' as const, outcome: 'YES' as const, size: '50.000000', price: '0.620000', fillPrice: '0.618000', pnl: '18.000000', equityCurve: '30.500000', simulatedAt: daysAgo(50) },
    { id: 'seed-bt-order-3', runId: 'seed-backtest-2', tokenId: MARKETS.cryptoEtf.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '100.000000', price: '0.400000', fillPrice: '0.402000', pnl: '-8.200000', equityCurve: '22.300000', simulatedAt: daysAgo(45) },
    { id: 'seed-bt-order-4', runId: 'seed-backtest-2', tokenId: MARKETS.usElections.tokenYes, side: 'BUY' as const, outcome: 'YES' as const, size: '75.000000', price: '0.650000', fillPrice: '0.652000', pnl: '35.100000', equityCurve: '57.400000', simulatedAt: daysAgo(40) },
    { id: 'seed-bt-order-5', runId: 'seed-backtest-2', tokenId: MARKETS.cryptoEtf.tokenYes, side: 'SELL' as const, outcome: 'YES' as const, size: '100.000000', price: '0.450000', fillPrice: '0.448000', pnl: '44.600000', equityCurve: '102.000000', simulatedAt: daysAgo(30) },
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
      await prisma.$executeRawUnsafe(
        `INSERT INTO pnl_snapshots (time, "userId", "strategyId", pnl, "realizedPnl", "positionCount")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        snap.time,
        snap.userId,
        snap.strategyId,
        snap.pnl,
        snap.realizedPnl,
        snap.positionCount,
      );
    }

    console.log(`  ✓ ${pnlSnapshots.length} P&L snapshots for alice (30 days portfolio + 30 days momentum strategy)`);
  }

  // ───────────────────────────────────────────────
  // PRICE ALERTS — ALICE
  // ───────────────────────────────────────────────

  console.log('\n🔔 Creating price alerts...');

  await prisma.priceAlert.upsert({
    where: { id: 'seed-alert-1' },
    update: {},
    create: {
      id: 'seed-alert-1',
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
    where: { id: 'seed-alert-2' },
    update: {},
    create: {
      id: 'seed-alert-2',
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
    { id: 'seed-login-1', userId: alice.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(1) },
    { id: 'seed-login-2', userId: alice.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: daysAgo(1) },
    { id: 'seed-login-3', userId: bob.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(3) },
    { id: 'seed-login-4', userId: charlie.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: false, createdAt: hoursAgo(12) },
    { id: 'seed-login-5', userId: charlie.id, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (dev)', success: true, createdAt: hoursAgo(11) },
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
  // DONE
  // ───────────────────────────────────────────────

  console.log('\n✅ User database seed complete!\n');
  console.log('  Dev credentials:');
  console.log('  ┌──────────────────────────────────────────────────────┐');
  console.log('  │  alice@dev.local   / password123  (connected)        │');
  console.log('  │  bob@dev.local     / password123  (verified)         │');
  console.log('  │  charlie@dev.local / password123  (verified)         │');
  console.log('  │  carol@dev.local   / Test1234!    (verified, paper)  │');
  console.log('  │  dave@dev.local    / Test1234!    (suspended)        │');
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
