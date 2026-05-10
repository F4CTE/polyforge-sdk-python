import type { WsMessage } from './websocket';

export type OrderToast = {
  kind: 'success' | 'info' | 'error';
  message: string;
};

function nestedData(msg: WsMessage): Record<string, unknown> {
  return msg.data && typeof msg.data === 'object' && !Array.isArray(msg.data)
    ? msg.data as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function shortOrderId(orderId: string | undefined): string {
  return orderId ? ` · ${orderId.slice(0, 8)}...` : '';
}

export function formatOrderEventToast(msg: WsMessage): OrderToast | null {
  const data = nestedData(msg);
  const orderId = readString(msg.orderId) ?? readString(data.orderId);

  if (msg.type === 'ORDER_FILLED') {
    return {
      kind: 'success',
      message: `Order filled${shortOrderId(orderId)}`,
    };
  }

  if (msg.type === 'ORDER_CANCELLED') {
    return {
      kind: 'info',
      message: `Order cancelled${shortOrderId(orderId)}`,
    };
  }

  if (msg.type === 'ORDER_FAILED') {
    const reason = readString(msg.reason) ?? readString(data.reason) ?? readString(data.message);
    return {
      kind: 'error',
      message: `Order failed${reason ? `: ${reason}` : ''}${shortOrderId(orderId)}`,
    };
  }

  return null;
}
