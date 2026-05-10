import { toast } from 'sonner';

export interface FormattedApiError {
  message: string;
  description?: string;
  requestId?: string;
  dedupeKey: string;
}

interface FormatApiErrorInput {
  status?: number;
  fallbackMessage: string;
  body?: unknown;
  error?: unknown;
}

interface ApiErrorBody {
  message?: unknown;
  error?: unknown;
  suggestion?: unknown;
  requestId?: unknown;
}

type ToastError = (message: string, options?: { description?: string; id?: string }) => void;

const INTERNAL_ERROR_PATTERNS = [
  /\bPrisma(Client|Known|Unknown|Validation)?/i,
  /\b(QueryFailedError|TypeError|ReferenceError|SyntaxError)\b/,
  /\bat\s+\S+\s+\(/,
  /\/(src|dist|app|srv)\//,
  /\.ts:\d+:\d+/,
  /\b(stack|traceback)\b/i,
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.filter((item): item is string => typeof item === 'string');
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isPublicMessage(message: string | undefined): message is string {
  if (!message) return false;
  return !INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function readBody(body: unknown): ApiErrorBody {
  const record = asRecord(body);
  return record ?? {};
}

export function formatApiError({
  status,
  fallbackMessage,
  body,
  error,
}: FormatApiErrorInput): FormattedApiError {
  const errorBody = readBody(body);
  const backendMessage = normalizeMessage(errorBody.message ?? errorBody.error);
  const errorMessage = error instanceof Error ? error.message : undefined;
  const message = isPublicMessage(backendMessage)
    ? backendMessage
    : isPublicMessage(errorMessage)
      ? errorMessage
      : fallbackMessage;
  const suggestion = normalizeMessage(errorBody.suggestion);
  const requestId = normalizeMessage(errorBody.requestId);
  const descriptionParts = [
    isPublicMessage(suggestion) ? suggestion : undefined,
    requestId ? `Request ID: ${requestId}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return {
    message,
    description: descriptionParts.length > 0 ? descriptionParts.join(' ') : undefined,
    requestId,
    dedupeKey: `${status ?? 'network'}:${message}:${suggestion ?? ''}`,
  };
}

export async function parseApiErrorResponse(
  response: Response,
  fallbackMessage: string,
): Promise<FormattedApiError> {
  const body = await response.json().catch(() => undefined);
  return formatApiError({
    status: response.status,
    fallbackMessage,
    body,
  });
}

export function createApiErrorNotifier({
  toastError,
  now = () => Date.now(),
  dedupeMs = 5_000,
}: {
  toastError: ToastError;
  now?: () => number;
  dedupeMs?: number;
}) {
  const recent = new Map<string, number>();

  return (error: FormattedApiError) => {
    const timestamp = now();
    const previous = recent.get(error.dedupeKey);
    if (previous !== undefined && timestamp - previous < dedupeMs) {
      return;
    }
    recent.set(error.dedupeKey, timestamp);
    toastError(error.message, {
      description: error.description,
      id: error.dedupeKey,
    });
  };
}

const _notify = createApiErrorNotifier({
  toastError: toast.error,
});

export function notifyApiError(error: FormattedApiError): void;
export function notifyApiError(err: unknown, context: string): void;
export function notifyApiError(errOrFormatted: unknown, context?: string): void {
  if (context !== undefined) {
    const formatted = formatApiError({
      fallbackMessage: `Failed to ${context}`,
      error: errOrFormatted,
    });
    _notify(formatted);
    return;
  }
  _notify(errOrFormatted as FormattedApiError);
}
