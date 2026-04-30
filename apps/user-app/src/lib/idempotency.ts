export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

interface PendingKeyState {
  key: string;
  leases: number;
}

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const KEY_PREFIX = 'polyforge-trade';
const PENDING_KEY_STATE: unique symbol = Symbol('pendingIdempotencyKeyState');
const PENDING_KEY_STATES_BY_ID: unique symbol = Symbol('pendingIdempotencyKeyStatesById');

interface MutableRef<T> {
  current: T;
  [PENDING_KEY_STATE]?: PendingKeyState;
  [PENDING_KEY_STATES_BY_ID]?: Map<string, PendingKeyState>;
}

function normalizeScope(scope: string): string {
  const normalized = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || 'submit';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createIdempotencyKey(scope = 'submit'): string {
  const key = `${KEY_PREFIX}-${normalizeScope(scope)}-${randomId()}`;
  return key.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}

export function idempotencyHeaders(key: string): Record<typeof IDEMPOTENCY_KEY_HEADER, string> {
  return { [IDEMPOTENCY_KEY_HEADER]: key };
}

export function getOrCreatePendingIdempotencyKey(ref: MutableRef<string | null>, scope: string): string {
  let state = ref[PENDING_KEY_STATE];
  if (!state || state.key !== ref.current) {
    state = { key: ref.current ?? createIdempotencyKey(scope), leases: 0 };
    ref.current = state.key;
    ref[PENDING_KEY_STATE] = state;
  }

  state.leases += 1;
  return state.key;
}

export function clearPendingIdempotencyKey(ref: MutableRef<string | null>): void {
  const state = ref[PENDING_KEY_STATE];
  if (!state || state.key !== ref.current) {
    ref.current = null;
    delete ref[PENDING_KEY_STATE];
    return;
  }

  state.leases -= 1;
  if (state.leases <= 0) {
    ref.current = null;
    delete ref[PENDING_KEY_STATE];
  }
}

export function getOrCreatePendingIdempotencyKeyForId(
  ref: MutableRef<Record<string, string | undefined>>,
  id: string,
  scope: string,
): string {
  let leases = ref[PENDING_KEY_STATES_BY_ID];
  if (!leases) {
    leases = new Map<string, PendingKeyState>();
    ref[PENDING_KEY_STATES_BY_ID] = leases;
  }

  let state = leases.get(id);
  const existing = ref.current[id];
  if (!state || state.key !== existing) {
    state = { key: existing ?? createIdempotencyKey(scope), leases: 0 };
    ref.current[id] = state.key;
    leases.set(id, state);
  }

  state.leases += 1;
  return state.key;
}

export function clearPendingIdempotencyKeyForId(
  ref: MutableRef<Record<string, string | undefined>>,
  id: string,
): void {
  const leases = ref[PENDING_KEY_STATES_BY_ID];
  const state = leases?.get(id);
  if (!leases || !state || state.key !== ref.current[id]) {
    delete ref.current[id];
    leases?.delete(id);
    return;
  }

  state.leases -= 1;
  if (state.leases <= 0) {
    delete ref.current[id];
    leases.delete(id);
  }
}
