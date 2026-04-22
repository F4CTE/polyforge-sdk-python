"use client";

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Show raw error message in a pre block — useful in dev/debug contexts */
  showErrorDetails?: boolean;
  /** Label for the reset button */
  resetLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { showErrorDetails = false, resetLabel = 'Try again' } = this.props;
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center bg-app p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto size-16 rounded-full bg-loss/10 flex items-center justify-center">
              <AlertTriangle className="size-8 text-loss" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-primary mb-2">
                Something went wrong
              </h1>
              <p className="text-body-sm text-tertiary">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>
            {showErrorDetails && this.state.error && (
              <pre className="text-label text-left text-loss bg-loss-subtle border border-loss/10 rounded-pf p-3 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-pf bg-accent text-inverse text-body-sm font-medium hover:bg-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring transition-colors"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {resetLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
