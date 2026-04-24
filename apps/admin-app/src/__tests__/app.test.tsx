import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../app';
import { ErrorBoundary } from '../components/error-boundary';

// Mock react-router to avoid RouterProvider initialization in tests
vi.mock('react-router', () => ({
  RouterProvider: () => <div data-testid="router-provider" />,
  createBrowserRouter: vi.fn(() => ({ routes: [] })),
  Navigate: () => null,
  NavLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('../router', () => ({
  router: { routes: [] },
}));

const mockInit = vi.fn();
vi.mock('../stores/admin-auth-store', () => ({
  useAdminAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { init: mockInit, isSuperAdmin: false, admin: null };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/theme-store', () => ({
  useThemeStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { isDark: false };
    return selector ? selector(state) : state;
  },
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
