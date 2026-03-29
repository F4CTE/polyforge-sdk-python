import { Link } from 'react-router';
import { SearchX } from 'lucide-react';

export function Component() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-pf-base p-4">
      <div className="text-center max-w-md">
        <SearchX className="size-16 text-pf-text-muted mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-6xl font-bold text-pf-text-muted">404</h1>
        <h2 className="text-pf-text-secondary mt-4 text-lg">The page you are looking for does not exist.</h2>
        <Link
          to="/markets"
          className="inline-block mt-6 px-5 py-2.5 bg-pf-cyan-500 text-black font-medium rounded-pf hover:bg-pf-cyan-400 active:bg-pf-cyan-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
        >
          Go to Markets
        </Link>
      </div>
    </main>
  );
}
