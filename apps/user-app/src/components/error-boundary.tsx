import type { ErrorInfo } from 'react';
import { ErrorBoundary as BaseErrorBoundary } from '@polyforge/ui';
import { captureError } from '../lib/sentry';

export class ErrorBoundary extends BaseErrorBoundary {
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    super.componentDidCatch(error, errorInfo);
    captureError(error, { componentStack: errorInfo.componentStack ?? undefined });
  }
}
