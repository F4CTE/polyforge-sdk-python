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

import { PrismaClient } from '.prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
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

  console.log(`  ✓ alice (id: ${alice.id})`);
  console.log(`  ✓ bob   (id: ${bob.id})`);
  console.log(`  ✓ charlie (id: ${charlie.id})`);

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

  console.log('  ✓ limits set for all users');

  // ───────────────────────────────────────────────
  // NOTIFICATION PREFERENCES
  // ───────────────────────────────────────────────

  console.log('\n🔔 Setting notification preferences...');

  for (const user of [alice, bob, charlie]) {
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

  console.log('  ✓ 3 orders for alice (2 confirmed, 1 live)');

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

  console.log('  ✓ 1 open position for alice (US Elections YES)');

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
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │  alice@dev.local   / password123  (connected) │');
  console.log('  │  bob@dev.local     / password123  (verified)  │');
  console.log('  │  charlie@dev.local / password123  (verified)  │');
  console.log('  └─────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
