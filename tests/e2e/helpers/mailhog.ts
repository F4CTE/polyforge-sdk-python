/**
 * Mailpit REST API helper.
 *
 * The compose infra uses axllent/mailpit (not MailHog).
 * Mailpit exposes /api/v1/* (MailHog had /api/v2/messages — that path
 * returns "File not found" in Mailpit, causing JSON parse errors).
 *
 * Mailpit list endpoint: GET /api/v1/messages
 *   → { messages: [{ID, From:{Address}, To:[{Address}], Subject, …}], total, … }
 *   Note: body is NOT included in the list, only message metadata.
 *
 * Mailpit message endpoint: GET /api/v1/message/{ID}
 *   → { ID, From, To, Subject, HTML, Text, Attachments, … }
 *
 * Delete all: DELETE /api/v1/messages (same path/method as MailHog)
 */

const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';

// ─── Mailpit response types ──────────────────────────────────────────────────

interface MailpitAddress {
    Address: string;
    Name:    string;
}

interface MailpitSummary {
    ID:          string;
    MessageID:   string;
    From:        MailpitAddress;
    To:          MailpitAddress[];
    Cc:          MailpitAddress[];
    Bcc:         MailpitAddress[];
    ReplyTo:     MailpitAddress[];
    Subject:     string;
    Created:     string;
    Read:        boolean;
    Attachments: number;
    Snippet:     string;
    Tags:        string[];
}

interface MailpitListResponse {
    messages:       MailpitSummary[];
    messages_count: number;
    start:          number;
    tags:           string[];
    total:          number;
    unread:         number;
}

interface MailpitMessage {
    ID:          string;
    MessageID:   string;
    From:        MailpitAddress;
    To:          MailpitAddress[];
    Cc:          MailpitAddress[];
    Bcc:         MailpitAddress[];
    ReplyTo:     MailpitAddress[];
    Subject:     string;
    Created:     string;
    HTML:        string;
    Text:        string;
    Attachments: unknown[];
    Inline:      unknown[];
    Tags:        string[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns all message summaries currently in Mailpit (no body). */
export async function getAllMessages(): Promise<MailpitSummary[]> {
    const res  = await fetch(`${MAILHOG_URL}/api/v1/messages?limit=200&start=0`);
    if (!res.ok) {
        throw new Error(`Mailpit list error: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as MailpitListResponse;
    return body.messages ?? [];
}

/** Fetches the full content (including HTML/Text body) of a specific message. */
async function getMessage(id: string): Promise<MailpitMessage> {
    const res = await fetch(`${MAILHOG_URL}/api/v1/message/${id}`);
    if (!res.ok) {
        throw new Error(`Mailpit message error: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<MailpitMessage>;
}

/** Clears all messages from Mailpit. */
export async function clearAllMessages(): Promise<void> {
    await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * Waits up to `timeoutMs` for a message addressed to `toEmail` and returns
 * the full message (including body). Polls every 500ms.
 */
export async function waitForEmail(
    toEmail:   string,
    timeoutMs = 10_000,
): Promise<MailpitMessage> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const summaries = await getAllMessages();
        const match = summaries.find(m =>
            m.To.some(r => r.Address.toLowerCase() === toEmail.toLowerCase()),
        );
        if (match) {
            // Fetch the full message to get the body (HTML/Text)
            return getMessage(match.ID);
        }
        await sleep(500);
    }

    throw new Error(`No email for ${toEmail} arrived within ${timeoutMs}ms`);
}

/**
 * Decode quoted-printable encoding:
 *   - soft line breaks (=\r\n or =\n) are removed (line continuation)
 *   - =XX sequences are decoded to their byte value
 */
function decodeQuotedPrintable(raw: string): string {
    return raw
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extracts the first URL matching `pathPrefix` from an email body.
 * Checks HTML body first, then plain-text body.
 */
export function extractLink(body: string, pathPrefix: string): string {
    const decoded = decodeQuotedPrintable(body);

    const hrefMatch = decoded.match(new RegExp(`href="([^"]*${escapeRegex(pathPrefix)}[^"]*)"`, 'i'));
    if (hrefMatch) return hrefMatch[1];

    const textMatch = decoded.match(new RegExp(`https?://\\S*${escapeRegex(pathPrefix)}\\S*`, 'i'));
    if (textMatch) return textMatch[0];

    throw new Error(`Could not find a link starting with '${pathPrefix}' in email body`);
}

/**
 * Rewrite an extracted email link so it points at the E2E test server
 * (BASE_URL, typically http://localhost on CI) instead of FRONTEND_URL
 * (which may be http://localhost:4200 or https://polyforge.app).
 */
function rebaseUrl(raw: string): string {
    const base = process.env.BASE_URL ?? 'http://localhost';
    try {
        const parsed = new URL(raw);
        const target = new URL(base);
        parsed.protocol = target.protocol;
        parsed.host     = target.host;
        return parsed.toString();
    } catch {
        return raw;
    }
}

/**
 * Convenience: wait for the verification email sent to `email` and return
 * the verification URL it contains (rebased to BASE_URL).
 * Checks the HTML body first, then plain text.
 */
export async function getVerificationUrl(email: string): Promise<string> {
    const msg  = await waitForEmail(email);
    const body = msg.HTML || msg.Text || '';
    return rebaseUrl(extractLink(body, '/verify-email'));
}

/**
 * Convenience: wait for the password-reset email and return the reset URL
 * (rebased to BASE_URL).
 */
export async function getPasswordResetUrl(email: string): Promise<string> {
    const msg  = await waitForEmail(email);
    const body = msg.HTML || msg.Text || '';
    return rebaseUrl(extractLink(body, '/reset-password'));
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
