import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./mailhog.ts', import.meta.url), 'utf8');
const authComprehensive = readFileSync(
  new URL('../specs/auth-comprehensive.spec.ts', import.meta.url),
  'utf8',
);
const authFlow = readFileSync(new URL('../specs/auth-flow.spec.ts', import.meta.url), 'utf8');

test('clearAllMessages is guarded for shared CI mailboxes', () => {
  assert.match(source, /function isSharedCiMailbox\(\)/);
  assert.match(source, /process\.env\.E2E_SHARED_MAILBOX/);
  assert.match(source, /export async function clearAllMessages\(\)/);
});

test('recipient-scoped cleanup deletes only matched Mailpit IDs', () => {
  assert.match(source, /export async function clearMessagesForRecipient\(/);
  assert.match(source, /\/api\/v1\/search/);
  assert.match(source, /to:"\$\{escapeSearchValue\(toEmail\)\}"/);
  assert.match(source, /IDs:\s*matches\.map\(m => m\.ID\)/);
  assert.match(source, /method:\s*'DELETE'/);
});

test('same-recipient reset and resend flows use scoped cleanup', () => {
  assert.match(authComprehensive, /clearMessagesForRecipient\(email\)/);
  assert.match(authFlow, /clearMessagesForRecipient\(email\)/);
});
