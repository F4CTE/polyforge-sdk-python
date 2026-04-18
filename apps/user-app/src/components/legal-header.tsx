import { Link, useNavigate } from "react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function LegalHeader() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function handleBack() {
    if (window.history.length > 1) {
      void navigate(-1);
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div className="flex items-center justify-between mb-8">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-2 text-body-sm text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      {isAuthenticated() ? (
        <Link
          to="/markets"
          className="flex items-center gap-2 text-primary hover:text-accent-text transition-colors"
        >
          <Zap className="size-4 text-accent-text" />
          <span className="font-semibold">Polyforge</span>
        </Link>
      ) : (
        <a
          href="/"
          className="flex items-center gap-2 text-primary hover:text-accent-text transition-colors"
        >
          <Zap className="size-4 text-accent-text" />
          <span className="font-semibold">Polyforge</span>
        </a>
      )}
    </div>
  );
}
