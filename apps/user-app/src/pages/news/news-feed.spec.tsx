import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from './news-feed';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const reutersArticle = {
  id: 'news-reuters',
  source: 'Reuters',
  title: 'Reuters filtered article',
  summary: 'Filtered Reuters summary',
  url: 'https://reuters.com/example',
  sentiment: 'NEGATIVE',
  publishedAt: new Date().toISOString(),
  signals: [],
};

const coindeskArticle = {
  id: 'news-coindesk',
  source: 'CoinDesk',
  title: 'CoinDesk stale article',
  summary: 'Unfiltered CoinDesk summary',
  url: 'https://coindesk.com/example',
  sentiment: 'POSITIVE',
  publishedAt: new Date().toISOString(),
  signals: [],
};

function articlePayload(data: unknown[]) {
  return {
    data,
    meta: { total: data.length, page: 1, limit: 10, totalPages: 1 },
  };
}

describe('News feed article loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores stale unfiltered article responses after a source filter is selected', async () => {
    const initialArticles = deferred<Response>();

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/news/signals')) {
        return Promise.resolve(jsonResponse({ data: [] }));
      }
      if (url.includes('/api/v1/news?') && url.includes('source=Reuters')) {
        return Promise.resolve(jsonResponse(articlePayload([reutersArticle])));
      }
      if (url.includes('/api/v1/news?')) {
        return initialArticles.promise;
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    }));

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Filter by news source'), {
      target: { value: 'Reuters' },
    });

    expect(await screen.findByText('Reuters filtered article')).toBeTruthy();

    initialArticles.resolve(jsonResponse(articlePayload([coindeskArticle])));

    await waitFor(() => {
      expect(screen.getByText('Reuters filtered article')).toBeTruthy();
      expect(screen.queryByText('CoinDesk stale article')).toBeNull();
      expect(screen.getAllByTestId('news-source').map(source => source.textContent)).toEqual(['Reuters']);
    });
  });
});
