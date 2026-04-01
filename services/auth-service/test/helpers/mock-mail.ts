import { vi } from 'vitest';
import { MailService } from '../../src/mail/mail.service';

export function createMockMailService(): Partial<MailService> {
    return {
        sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
        sendPendingApprovalEmail: vi.fn().mockResolvedValue(undefined),
        sendWaitlistConfirmationEmail: vi.fn().mockResolvedValue(undefined),
        sendAccountApprovedEmail: vi.fn().mockResolvedValue(undefined),
    };
}
