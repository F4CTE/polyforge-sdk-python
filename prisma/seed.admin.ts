/**
 * Polyforge — Admin Database Seed
 * File: prisma/seed.admin.ts
 *
 * Creates a single SUPER_ADMIN account for dev access.
 *
 * Run: pnpm seed:admin
 *
 * ⚠️  NEVER seed real admin passwords here.
 *     Dev passwords are intentionally weak — change in production via the UI.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
import { PrismaClient } from '.prisma/admin-client';
import * as bcrypt from 'bcrypt';

const adminAdapter = new PrismaPg({ connectionString: process.env.ADMIN_DIRECT_DATABASE_URL ?? process.env.ADMIN_DATABASE_URL });
const prisma = new PrismaClient({ adapter: adminAdapter });

async function main() {
  console.log('🌱 Seeding admin database...\n');

  const superAdmin = await prisma.admin.upsert({
    where:  { email: 'superadmin@dev.local' },
    update: {},
    create: {
      email:        'superadmin@dev.local',
      passwordHash: await bcrypt.hash('superadmin123', 12),
      displayName:  'Super Admin',
      role:         'SUPER_ADMIN',
      active:       true,
    },
  });

  console.log(`  ✓ superadmin (id: ${superAdmin.id}) — SUPER_ADMIN`);
  console.log('\n✅ Done!\n');
  console.log('  Email:    superadmin@dev.local');
  console.log('  Password: superadmin123\n');
  console.log('  ⚠️  Dev-only password. Change in production.\n');
}

main()
  .catch((e) => {
    console.error('❌ Admin seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
