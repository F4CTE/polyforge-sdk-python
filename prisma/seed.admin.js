"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    console.error('ERROR: Seed scripts must only run in development environment');
    process.exit(1);
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
const admin_client_1 = require(".prisma/admin-client");
const bcrypt = __importStar(require("bcrypt"));
function generateSeedPassword() {
    return (0, crypto_1.randomBytes)(16).toString('base64url');
}
const adminAdapter = new PrismaPg({ connectionString: process.env.ADMIN_DIRECT_DATABASE_URL ?? process.env.ADMIN_DATABASE_URL });
const prisma = new admin_client_1.PrismaClient({ adapter: adminAdapter });
async function main() {
    console.log('🌱 Seeding admin database...\n');
    const adminPassword = generateSeedPassword();
    console.log(`🔑 Generated admin password: ${adminPassword}\n`);
    const superAdmin = await prisma.admin.upsert({
        where: { email: 'superadmin@dev.local' },
        update: {},
        create: {
            email: 'superadmin@dev.local',
            passwordHash: await bcrypt.hash(adminPassword, 12),
            displayName: 'Super Admin',
            role: 'SUPER_ADMIN',
            active: true,
        },
    });
    console.log(`  ✓ superadmin (id: ${superAdmin.id}) — SUPER_ADMIN`);
    console.log('\n✅ Done!\n');
    console.log('  Email:    superadmin@dev.local');
    console.log(`  Password: ${adminPassword}\n`);
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
//# sourceMappingURL=seed.admin.js.map