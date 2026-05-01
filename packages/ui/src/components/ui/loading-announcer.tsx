import * as React from "react";

export interface LoadingAnnouncerProps {
  /** Whether content is currently loading. Toggling this announces the state. */
  loading: boolean;
  /** Short label describing the resource — e.g. "strategy chart". */
  label?: string;
  /** Override message announced while loading. Default: `Loading {label}…`. */
  loadingMessage?: string;
  /** Override message announced when loading completes. Default: `{label} loaded.` */
  loadedMessage?: string;
  /** When true, status is announced more assertively (use sparingly). */
  assertive?: boolean;
}

/**
 * Visually-hidden ARIA live region announcing loading state transitions.
 *
 * Pairs with `<Skeleton aria-hidden="true">` placeholders to fulfil
 * WCAG 4.1.3 (Status Messages): screen readers receive a polite update
 * when async content begins loading and again when it lands.
 *
 * Usage:
 *   <LoadingAnnouncer loading={isLoading} label="markets" />
 */
export function LoadingAnnouncer({
  loading,
  label = "content",
  loadingMessage,
  loadedMessage,
  assertive = false,
}: LoadingAnnouncerProps): React.ReactElement {
  const wasLoadingRef = React.useRef(loading);
  const [message, setMessage] = React.useState<string>(
    loading ? (loadingMessage ?? `Loading ${label}…`) : "",
  );

  React.useEffect(() => {
    if (loading && !wasLoadingRef.current) {
      setMessage(loadingMessage ?? `Loading ${label}…`);
    } else if (!loading && wasLoadingRef.current) {
      setMessage(
        loadedMessage ??
          `${label.charAt(0).toUpperCase()}${label.slice(1)} loaded.`,
      );
    }
    wasLoadingRef.current = loading;
  }, [loading, label, loadingMessage, loadedMessage]);

  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
