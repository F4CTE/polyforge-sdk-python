import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../app';
import { ErrorBoundary } from '../components/error-boundary';

// Mock the router and stores to avoid initialization issues
vi.mock('../router', () => ({
  router: {
    routes: [],
  },
}));

vi.mock('../stores/admin-auth-store', () => ({
  useAdminAuthStore: () => ({
    init: vi.fn(),
  }),
}));

vi.mock('../stores/theme-store', () => ({
  useThemeStore: () => ({
    isDark: false,
  }),
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('renders ErrorBoundary wrapper', () => {
    const { getByTestId } = render(<App />);
    const toaster = getByTestId('toaster');
    expect(toaster).toBeTruthy();
  });
});

describe('ErrorBoundary Component', () => {
  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    expect(getByText('Test Content')).toBeTruthy();
  });

  it('catches errors and displays error UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
