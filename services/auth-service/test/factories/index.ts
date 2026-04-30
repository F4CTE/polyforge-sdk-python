// Shape matching Prisma User model fields used in auth flows
export interface UserLike {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    passwordHash: string;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    polymarketConnected: boolean;
    kalshiConnected: boolean;
    kalshiUserId: string | null;
    totpEnabled: boolean;
    suspended: boolean;
    deleted: boolean;
    approved: boolean;
    bio: string | null;
    avatarUrl: string | null;
    tosAcceptedAt: Date;
    createdAt: Date;
    lastSeen: Date | null;
}

export interface EmailVerificationLike {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

export interface PasswordResetTokenLike {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

let fakeIdSequence = 0;

function fakeUuid(): string {
    fakeIdSequence += 1;
    return `00000000-0000-4000-8000-${String(fakeIdSequence).padStart(12, '0')}`;
}

function fakeHex(length: number): string {
    return 'a'.repeat(length);
}

export function userFactory(overrides: Partial<UserLike> = {}): UserLike {
    const id = fakeUuid();

    return {
        id,
        email: `user-${id.slice(-12)}@example.com`,
        username: `user_${id.slice(-12)}`,
        displayName: 'Test User',
        passwordHash: '$2b$12$hashedpassword',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        polymarketConnected: false,
        kalshiConnected: false,
        kalshiUserId: null,
        totpEnabled: false,
        suspended: false,
        deleted: false,
        approved: true,
        bio: null,
        avatarUrl: null,
        tosAcceptedAt: new Date(),
        createdAt: new Date(),
        lastSeen: null,
        ...overrides,
    };
}

export function emailVerificationFactory(overrides: Partial<EmailVerificationLike> = {}): EmailVerificationLike {
    return {
        id: fakeUuid(),
        userId: fakeUuid(),
        tokenHash: fakeHex(64),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        ...overrides,
    };
}

export function passwordResetTokenFactory(overrides: Partial<PasswordResetTokenLike> = {}): PasswordResetTokenLike {
    return {
        id: fakeUuid(),
        userId: fakeUuid(),
        tokenHash: fakeHex(64),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        ...overrides,
    };
}

/** Returns a raw 64-char hex token (as sent in email links) */
export function rawToken(): string {
    return fakeHex(64);
}
