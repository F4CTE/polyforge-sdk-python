import { Link } from 'react-router';

export function Component() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-pf-base">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-pf-text-muted">404</h1>
        <p className="text-pf-text-muted mt-4 text-lg">Page not found</p>
        <Link
          to="/markets"
          className="inline-block mt-6 px-4 py-2 bg-pf-cyan-500 text-black rounded-pf hover:bg-pf-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40"
        >
          Go to Markets
        </Link>
      </div>
    </div>
  );
}
