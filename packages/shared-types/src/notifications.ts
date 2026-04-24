// ─────────────────────────────────────────────────────────────────────────────
// Notification types
// ─────────────────────────────────────────────────────────────────────────────

export enum NotificationChannel {
  EMAIL = "EMAIL",
  TELEGRAM = "TELEGRAM",
  DISCORD = "DISCORD",
  WHATSAPP = "WHATSAPP",
}

export enum NotificationFrequency {
  IMMEDIATE = "IMMEDIATE",
  HOURLY = "HOURLY",
  DAILY = "DAILY",
}

export enum NotificationEventType {
  STRATEGY_ERROR = "STRATEGY_ERROR",
  ORDER_FILLED = "ORDER_FILLED",
  DAILY_LOSS_LIMIT = "DAILY_LOSS_LIMIT",
  BACKTEST_COMPLETE = "BACKTEST_COMPLETE",
  MARKET_RESOLVED = "MARKET_RESOLVED",
  SOMEONE_FORKED = "SOMEONE_FORKED",
  SOMEONE_FOLLOWED = "SOMEONE_FOLLOWED",
  SOMEONE_LIKED = "SOMEONE_LIKED",
  SOMEONE_COMMENTED = "SOMEONE_COMMENTED",
  PRICE_ALERT = "PRICE_ALERT",
}

export interface NotificationPayload {
  userId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  data: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  discordEnabled: boolean;
  whatsappEnabled: boolean;
  onStrategyError: boolean;
  onOrderFilled: boolean;
  onDailyLossLimit: boolean;
  onBacktestComplete: boolean;
  onMarketResolved: boolean;
  onSomeoneForked: boolean;
  onSomeoneFollowed: boolean;
  onSomeoneLiked: boolean;
  onSomeoneCommented: boolean;
  minFillNotifyUsdc: string;
  notificationFreq: NotificationFrequency;
}
