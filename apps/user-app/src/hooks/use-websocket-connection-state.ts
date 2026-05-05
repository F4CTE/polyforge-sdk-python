import { useEffect, useState } from "react";
import { wsManager, type ConnectionState } from "@/lib/websocket";

export function useWebSocketConnectionState(): ConnectionState {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    wsManager.getConnectionState(),
  );

  useEffect(() => wsManager.addConnectionListener(setConnectionState), []);

  return connectionState;
}
