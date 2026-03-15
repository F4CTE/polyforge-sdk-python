/**
 * Polyforge — Admin Database Seed
 * File: prisma/seed.admin.ts
 *
 * Creates dev admin accounts:
 *   - 1 SUPER_ADMIN  (full access)
 *   - 1 ADMIN        (standard admin)
 *   - 1 VIEWER       (read-only)
 *   - Sample audit logs
 *
 * Run: pnpm seed:admin
 *
 * ⚠️  NEVER seed real admin passwords here.
 *     Dev passwords are intentionally weak — change in production via the UI.
 */

import { PrismaClient } from '.prisma/admin-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

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
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding admin database...\n');

  // ───────────────────────────────────────────────
  // ADMIN ACCOUNTS
  // ───────────────────────────────────────────────

  console.log('👤 Creating admin accounts...');

  const superAdmin = await prisma.admin.upsert({
    where: { email: 'superadmin@dev.local' },
    update: {},
    create: {
      email:        'superadmin@dev.local',
      passwordHash: await hashPassword('superadmin123'),
      displayName:  'Super Admin',
      role:         'SUPER_ADMIN',
      active:       true,
      createdAt:    daysAgo(90),
      lastSeen:     hoursAgo(2),
    },
  });

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@dev.local' },
    update: {},
    create: {
      email:        'admin@dev.local',
      passwordHash: await hashPassword('admin123'),
      displayName:  'Admin User',
      role:         'ADMIN',
      active:       true,
      createdAt:    daysAgo(60),
      lastSeen:     hoursAgo(8),
    },
  });

  const viewer = await prisma.admin.upsert({
    where: { email: 'viewer@dev.local' },
    update: {},
    create: {
      email:        'viewer@dev.local',
      passwordHash: await hashPassword('viewer123'),
      displayName:  'Read-Only Viewer',
      role:         'VIEWER',
      active:       true,
      createdAt:    daysAgo(30),
      lastSeen:     daysAgo(3),
    },
  });

  console.log(`  ✓ superadmin (id: ${superAdmin.id}) — SUPER_ADMIN`);
  console.log(`  ✓ admin      (id: ${admin.id})      — ADMIN`);
  console.log(`  ✓ viewer     (id: ${viewer.id})     — VIEWER`);

  // ───────────────────────────────────────────────
  // ADMIN SESSIONS (sample — to test revocation)
  // ───────────────────────────────────────────────

  console.log('\n🔐 Creating sample sessions...');

  // Active session for superAdmin
  await prisma.adminSession.upsert({
    where: { id: 'seed-admin-session-1' },
    update: {},
    create: {
      id:        'seed-admin-session-1',
      adminId:   superAdmin.id,
      ip:        '127.0.0.1',
      userAgent: 'Mozilla/5.0 (dev)',
      expiresAt: new Date(Date.now() + 3600 * 1000), // expires in 1h
      revoked:   false,
      createdAt: hoursAgo(1),
    },
  });

  // Expired session for admin
  await prisma.adminSession.upsert({
    where: { id: 'seed-admin-session-2' },
    update: {},
    create: {
      id:        'seed-admin-session-2',
      adminId:   admin.id,
      ip:        '127.0.0.1',
      userAgent: 'Mozilla/5.0 (dev)',
      expiresAt: hoursAgo(2), // already expired
      revoked:   false,
      createdAt: hoursAgo(3),
    },
  });

  // Manually revoked session for admin
  await prisma.adminSession.upsert({
    where: { id: 'seed-admin-session-3' },
    update: {},
    create: {
      id:        'seed-admin-session-3',
      adminId:   admin.id,
      ip:        '192.168.1.100',
      userAgent: 'Mozilla/5.0 (dev — suspicious)',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      revoked:   true, // manually revoked
      createdAt: daysAgo(1),
    },
  });

  console.log('  ✓ 3 sessions (1 active, 1 expired, 1 revoked)');

  // ───────────────────────────────────────────────
  // AUDIT LOGS
  // These use UUIDs from the USER database as target_id.
  // We use placeholder UUIDs here since we can't FK across DBs.
  // In production these reference real user/strategy IDs.
  // ───────────────────────────────────────────────

  console.log('\n📋 Creating audit logs...');

  // Placeholder UUIDs representing entities in the user DB
  const PLACEHOLDER_USER_ID     = '00000000-0000-0000-0000-000000000001';
  const PLACEHOLDER_STRATEGY_ID = '00000000-0000-0000-0000-000000000002';
  const PLACEHOLDER_COMMENT_ID  = '00000000-0000-0000-0000-000000000003';

  const auditLogs = [
    {
      adminId:    superAdmin.id,
      action:     'SUSPEND_USER',
      targetType: 'user',
      targetId:   PLACEHOLDER_USER_ID,
      payload:    {
        before: { suspended: false },
        after:  { suspended: true, suspendedReason: 'Suspected market manipulation' },
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(15),
    },
    {
      adminId:    admin.id,
      action:     'UNSUSPEND_USER',
      targetType: 'user',
      targetId:   PLACEHOLDER_USER_ID,
      payload:    {
        before: { suspended: true },
        after:  { suspended: false },
        note:   'Investigation concluded — no violation found',
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(10),
    },
    {
      adminId:    admin.id,
      action:     'FORCE_STOP_STRATEGY',
      targetType: 'strategy',
      targetId:   PLACEHOLDER_STRATEGY_ID,
      payload:    {
        reason:       'Strategy placing abnormal order volume',
        ordersToday:  312,
        maxAllowed:   200,
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(7),
    },
    {
      adminId:    admin.id,
      action:     'REMOVE_COMMENT',
      targetType: 'comment',
      targetId:   PLACEHOLDER_COMMENT_ID,
      payload:    {
        reason:         'Spam',
        commentContent: '[redacted]',
        reportCount:    3,
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(5),
    },
    {
      adminId:    superAdmin.id,
      action:     'UPDATE_USER_LIMITS',
      targetType: 'user',
      targetId:   PLACEHOLDER_USER_ID,
      payload:    {
        before: { maxOrdersPerDay: 200, maxOrderSizeUsdc: '500.00' },
        after:  { maxOrdersPerDay: 500, maxOrderSizeUsdc: '1000.00' },
        reason: 'User requested limit increase — approved',
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(3),
    },
    {
      adminId:    superAdmin.id,
      action:     'CREATE_ADMIN',
      targetType: 'admin',
      targetId:   viewer.id,
      payload:    {
        email: 'viewer@dev.local',
        role:  'VIEWER',
      },
      ip:        '127.0.0.1',
      createdAt: daysAgo(30),
    },
    {
      adminId:    admin.id,
      action:     'MARK_STRATEGY_AS_TEMPLATE',
      targetType: 'strategy',
      targetId:   PLACEHOLDER_STRATEGY_ID,
      payload:    {
        strategyName: 'Momentum Blitz',
        template:     true,
      },
      ip:        '127.0.0.1',
      createdAt: hoursAgo(6),
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log as any });
  }

  console.log(`  ✓ ${auditLogs.length} audit log entries`);

  // ───────────────────────────────────────────────
  // DONE
  // ───────────────────────────────────────────────

  console.log('\n✅ Admin database seed complete!\n');
  console.log('  Dev credentials:');
  console.log('  ┌─────────────────────────────────────────────────────┐');
  console.log('  │  superadmin@dev.local / superadmin123  SUPER_ADMIN  │');
  console.log('  │  admin@dev.local      / admin123       ADMIN        │');
  console.log('  │  viewer@dev.local     / viewer123      VIEWER       │');
  console.log('  └─────────────────────────────────────────────────────┘\n');
  console.log('  ⚠️  These are dev-only passwords. Never use in production.\n');
}

main()
  .catch((e) => {
    console.error('❌ Admin seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
