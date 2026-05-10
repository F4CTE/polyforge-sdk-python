import { toast } from 'sonner';

interface ApiError {
  message?: string;
  error?: string;
  statusCode?: number;
}

function formatApiError(err: unknown, context: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as ApiError).message === 'string') {
    return (err as ApiError).message!;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return `Failed to ${context}`;
}

function notifyApiError(err: unknown, context: string): void {
  const message = formatApiError(err, context);
  toast.error(message);
}

export { formatApiError, notifyApiError };
export type { ApiError };
