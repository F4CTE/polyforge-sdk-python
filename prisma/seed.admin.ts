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

import { randomBytes } from 'crypto';

if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
  console.error('ERROR: Seed scripts must only run in development environment');
  process.exit(1);
}

if (process.env.CI === 'true' && process.env.CI_SEED_ALLOWED !== 'true') {
  console.error(
    'ERROR: Seed scripts in CI require CI_SEED_ALLOWED=true.\n' +
    '       Set SEED_ADMIN_PASSWORD before running.',
  );
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
import { PrismaClient } from '.prisma/admin-client';
import * as bcrypt from 'bcrypt';

function generateSeedPassword(): string {
  return randomBytes(16).toString('base64url');
}

const adminAdapter = new PrismaPg({ connectionString: process.env.ADMIN_DIRECT_DATABASE_URL ?? process.env.ADMIN_DATABASE_URL });
const prisma = new PrismaClient({ adapter: adminAdapter });

async function main() {
  console.log('🌱 Seeding admin database...\n');

  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ?? generateSeedPassword();
  console.log('🔑 Admin password prepared and stored (not printed).');
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      '  Set SEED_ADMIN_PASSWORD before running seed:admin if you need a known local admin password.',
    );
  }
  console.log('');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const superAdmin = await prisma.admin.upsert({
    where:  { email: 'superadmin@dev.local' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email:        'superadmin@dev.local',
      passwordHash: adminPasswordHash,
      displayName:  'Super Admin',
      role:         'SUPER_ADMIN',
      active:       true,
    },
  });

  console.log(`  ✓ superadmin (id: ${superAdmin.id}) — SUPER_ADMIN`);
  console.log('\n✅ Done!\n');
  console.log('  Email:    superadmin@dev.local');
  console.log('  Password: not printed\n');
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
