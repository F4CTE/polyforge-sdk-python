import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
  return {
    default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    createTransport: vi.fn().mockReturnValue({ sendMail }),
    __mockSendMail: sendMail,
  };
});

import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

const mockSendMail = (nodemailer as any).__mockSendMail;

describe('Auth MailService', () => {
  let service: MailService;

  beforeEach(() => {
    vi.stubEnv('EMAIL_DRIVER', 'mailhog');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    mockSendMail.mockClear();
    service = new MailService();
  });

  it('escapes the approved account username in HTML email content', async () => {
    await service.sendAccountApprovedEmail(
      'user@example.com',
      '<img src=x onerror="alert(1)">',
    );

    expect(mockSendMail).toHaveBeenCalledOnce();
    const email = mockSendMail.mock.calls[0][0];
    expect(email.html).toContain(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(email.html).not.toContain('<img src=x');
  });
});
