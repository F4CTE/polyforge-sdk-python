import { Link } from 'react-router';
import { SearchX } from 'lucide-react';

export function Component() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-app p-4">
      <div className="text-center max-w-md">
        <SearchX className="size-16 text-tertiary mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-6xl font-bold text-tertiary">404</h1>
        <h2 className="text-secondary mt-4 text-lg">The page you are looking for does not exist.</h2>
        <Link
          to="/markets"
          className="inline-block mt-6 px-5 py-3 bg-accent text-inverse font-medium rounded-pf hover:bg-accent-text active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Go to Markets
        </Link>
      </div>
    </main>
  );
}
