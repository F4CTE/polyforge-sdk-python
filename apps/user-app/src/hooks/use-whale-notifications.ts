import { useState, useEffect, useCallback } from 'react';
import { wsManager, type WsMessage } from '../lib/websocket';

type Permission = 'default' | 'granted' | 'denied';

interface WhaleNotificationConfig {
  enabled: boolean;
  minSize: number;
  categories: string[];
  followedOnly: boolean;
}

const STORAGE_KEY = 'pf-whale-notification-config';

function loadConfig(): WhaleNotificationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* use defaults */ }
  return { enabled: false, minSize: 10000, categories: [], followedOnly: false };
}

function saveConfig(config: WhaleNotificationConfig): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

export function useWhaleNotifications() {
  const [permission, setPermission] = useState<Permission>(
    typeof Notification !== 'undefined' ? Notification.permission as Permission : 'denied',
  );
  const [config, setConfig] = useState<WhaleNotificationConfig>(loadConfig);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    if (result === 'granted') {
      const next = { ...config, enabled: true };
      setConfig(next);
      saveConfig(next);
    }
  }, [config]);

  const updateConfig = useCallback((patch: Partial<WhaleNotificationConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!config.enabled || permission !== 'granted') return;

    const listener = (msg: WsMessage) => {
      if (msg.type !== 'WHALE_TRADE') return;

      const size = parseFloat(String(msg.notional ?? msg.size ?? '0'));
      if (size < config.minSize) return;

      const category = String(msg.marketCategory ?? msg.category ?? '').toLowerCase();
      if (config.categories.length > 0 && !config.categories.includes(category)) return;

      if (config.followedOnly && !msg.isFollowing) return;

      const wallet = String(msg.walletAddress ?? '').slice(0, 8);
      const market = String(msg.marketName ?? msg.market ?? 'Unknown');
      const side = String(msg.side ?? 'BUY');
      const fmtSize = size >= 1000 ? `$${(size / 1000).toFixed(1)}K` : `$${size.toFixed(0)}`;

      new Notification(`🐋 Whale ${side}`, {
        body: `${wallet}… ${side.toLowerCase()} ${fmtSize} on "${market}"`,
        icon: '/favicon.ico',
        tag: `whale-${msg.id ?? Date.now()}`,
        silent: false,
      });
    };

    wsManager.addListener(listener);
    return () => { wsManager.removeListener(listener); };
  }, [config, permission]);

  return {
    permission,
    config,
    supported: typeof Notification !== 'undefined',
    requestPermission,
    updateConfig,
  };
}
