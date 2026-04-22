import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { App } from '../app';
import { ErrorBoundary } from '../components/error-boundary';

vi.mock('../router', () => ({
  router: createMemoryRouter([{ path: '/', element: <div>Home</div> }]),
}));

const mockInit = vi.fn();
vi.mock('../stores/auth-store', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { init: mockInit };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/theme-store', () => ({
  useThemeStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { isDark: false };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/notification-store', () => ({
  useNotificationStore: Object.assign(() => ({}), {
    getState: () => ({ bindWebSocket: () => vi.fn() }),
  }),
}));

vi.mock('../lib/websocket', () => ({
  wsManager: {
    connect: vi.fn(),
    destroy: vi.fn(),
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
