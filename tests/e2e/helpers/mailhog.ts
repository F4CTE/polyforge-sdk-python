/**
 * MailHog REST API helper.
 *
 * MailHog stores emails at http://localhost:8025/api/v2/messages
 * Each item in `items[]` has:
 *   .To[0].Mailbox + .Domain  — recipient address
 *   .Content.Body             — raw email body (HTML email with links)
 */

const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';

interface MailHogMessage {
    ID:      string;
    From:    { Relays: null; Mailbox: string; Domain: string; Params: string };
    To:      Array<{ Relays: null; Mailbox: string; Domain: string; Params: string }>;
    Content: {
        Headers: Record<string, string[]>;
        Body:    string;
        Size:    number;
    };
    Created: string;
    Raw: {
        From: string;
        To:   string[];
        Data: string;
    };
}

interface MailHogResponse {
    total: number;
    count: number;
    start: number;
    items: MailHogMessage[];
}

/** Returns all messages currently in MailHog */
export async function getAllMessages(): Promise<MailHogMessage[]> {
    const res  = await fetch(`${MAILHOG_URL}/api/v2/messages`);
    const body = await res.json() as MailHogResponse;
    return body.items ?? [];
}

/** Clears all messages from MailHog */
export async function clearAllMessages(): Promise<void> {
    await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * Waits up to `timeoutMs` for a message addressed to `toEmail` and returns
 * the first matching message. Polls every 500ms.
 */
export async function waitForEmail(
    toEmail:   string,
    timeoutMs = 10_000,
): Promise<MailHogMessage> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const messages = await getAllMessages();
        const match = messages.find(m =>
            m.To.some(r => `${r.Mailbox}@${r.Domain}`.toLowerCase() === toEmail.toLowerCase()),
        );
        if (match) return match;
        await sleep(500);
    }

    throw new Error(`No email for ${toEmail} arrived within ${timeoutMs}ms`);
}

/**
 * Extracts the first URL from an email body.
 * Used to pull verification / password-reset links out of emails.
 */
export function extractLink(body: string, pathPrefix: string): string {
    // Emails may be HTML — look for href="..." containing the path
    const hrefMatch = body.match(new RegExp(`href="([^"]*${escapeRegex(pathPrefix)}[^"]*)"`, 'i'));
    if (hrefMatch) return hrefMatch[1];

    // Fallback: bare URL in text (plain-text emails)
    const textMatch = body.match(new RegExp(`https?://\\S*${escapeRegex(pathPrefix)}\\S*`, 'i'));
    if (textMatch) return textMatch[0];

    throw new Error(`Could not find a link starting with '${pathPrefix}' in email body`);
}

/**
 * Convenience: wait for the verification email sent to `email` and return
 * the verification URL it contains.
 */
export async function getVerificationUrl(email: string): Promise<string> {
    const msg = await waitForEmail(email);
    return extractLink(msg.Content.Body, '/verify-email');
}

/**
 * Convenience: wait for the password-reset email and return the reset URL.
 */
export async function getPasswordResetUrl(email: string): Promise<string> {
    const msg = await waitForEmail(email);
    return extractLink(msg.Content.Body, '/reset-password');
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
