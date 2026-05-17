import { PrismaService } from '@polyforge/shared-db';

/**
 * Truncate all tables relevant to auth testing, in dependency order.
 * Children (FK dependencies) are truncated before parents to avoid
 * foreign key constraint violations.
 */
export async function cleanAuthDb(prisma: PrismaService): Promise<void> {
  const result = await prisma.$queryRawUnsafe<
    Array<{ current_database: string }>
  >('SELECT current_database()');
  const dbName = result[0]?.current_database;
  if (!dbName || !/(^|[^a-z])test($|[^a-z])/i.test(dbName)) {
    throw new Error(
      `Refusing to truncate non-test database: ${dbName ?? 'unknown'}. ` +
        `Set TEST_DATABASE_URL to a dedicated test database whose name contains 'test' as a standalone word.`,
    );
  }

  const tables = [
    // FK children first
    'public.user_login_history',
    'public.email_verifications',
    'public.password_reset_tokens',
    'public.user_credentials',
    'public.kalshi_credentials',
    'public.polymarket_us_credentials',
    'public.api_keys',
    'public.notification_preferences',
    'public.strategies',
    'public.bot_connections',
    'public.follows',
    'public.user_limits',
    'public.notification_history',
    'public.strategy_versions',
    'public.strategy_likes',
    'public.strategy_comments',
    'public.strategy_forks',
    'public.strategy_status_history',
    'public.strategy_events',
    'public.orders',
    'public.smart_orders',
    'public.positions',
    'public.paper_orders',
    'public.paper_positions',
    'public.backtest_runs',
    'public.reports',
    'public.price_alerts',
    'public.copy_configs',
    'public.copy_trades',
    'public.conditional_orders',
    'public.watchlist_items',
    'public.journal_entries',
    // Parent last
    'public.users',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`,
    );
  }
}
