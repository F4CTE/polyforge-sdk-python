import { WifiOff } from "lucide-react";
import { useWebSocketConnectionState } from "@/hooks/use-websocket-connection-state";

export function WebSocketStatusBanner() {
  const connectionState = useWebSocketConnectionState();

  if (
    connectionState !== "reconnecting" &&
    connectionState !== "disconnected"
  ) {
    return null;
  }

  return (
    <section
      data-testid="websocket-disconnect-banner"
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 border-y border-warning/40 bg-warning/10 px-4 py-3 text-warning"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-label font-semibold uppercase">
          Connection lost - reconnecting
        </p>
        <p className="text-body-sm text-primary">
          Live prices and strategy events may be stale until the WebSocket
          connection is restored.
        </p>
      </div>
    </section>
  );
}
