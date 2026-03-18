import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

export type MockDb = DeepMockProxy<PrismaClient>;

export function createMockDb(): MockDb {
    return mockDeep<PrismaClient>();
}
