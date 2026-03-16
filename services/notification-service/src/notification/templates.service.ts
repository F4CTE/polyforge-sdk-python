import { Injectable } from '@nestjs/common';

export interface NotificationContent {
    title: string;
    body: string;
    severity: 'info' | 'success' | 'warning' | 'error';
}

@Injectable()
export class TemplatesService {
    build(eventType: string, data: Record<string, string>): NotificationContent {
        switch (eventType) {
            case 'ORDER_FILLED':
                return {
                    title: 'Order Filled',
                    body: `Your order on token ${data.tokenId ?? 'unknown'} was filled at ${data.fillPrice ?? data.price ?? 'unknown'}.${data.pnl ? ` P&L: ${data.pnl} USDC.` : ''}`,
                    severity: 'success',
                };

            case 'STRATEGY_ERROR':
                return {
                    title: 'Strategy Error',
                    body: `Strategy ${data.strategyId ?? 'unknown'} encountered an error: ${data.reason ?? 'unknown error'}.`,
                    severity: 'error',
                };

            case 'BACKTEST_COMPLETE':
                return {
                    title: 'Backtest Complete',
                    body: `Your backtest run ${data.runId ?? 'unknown'} has finished.${data.totalPnl ? ` Total P&L: ${data.totalPnl} USDC.` : ''}`,
                    severity: 'info',
                };

            case 'PRICE_ALERT':
                return {
                    title: 'Price Alert Triggered',
                    body: `Token ${data.tokenId ?? 'unknown'} reached your price alert threshold of ${data.threshold ?? data.price ?? 'unknown'}.`,
                    severity: 'warning',
                };

            case 'DAILY_LOSS_LIMIT':
                return {
                    title: 'Daily Loss Limit Reached',
                    body: `Strategy ${data.strategyId ?? 'unknown'} hit its daily loss limit and has been stopped.`,
                    severity: 'error',
                };

            case 'MARKET_RESOLVED':
                return {
                    title: 'Market Resolved',
                    body: `Market ${data.marketId ?? 'unknown'} has resolved with outcome ${data.outcome ?? 'unknown'}.`,
                    severity: 'info',
                };

            case 'SOMEONE_FORKED':
                return {
                    title: 'Strategy Forked',
                    body: `${data.forkerUsername ?? 'Someone'} forked your strategy "${data.strategyName ?? data.strategyId ?? 'unknown'}".`,
                    severity: 'info',
                };

            case 'SOMEONE_FOLLOWED':
                return {
                    title: 'New Follower',
                    body: `${data.followerUsername ?? 'Someone'} started following you.`,
                    severity: 'info',
                };

            case 'SOMEONE_LIKED':
                return {
                    title: 'Strategy Liked',
                    body: `${data.likerUsername ?? 'Someone'} liked your strategy "${data.strategyName ?? data.strategyId ?? 'unknown'}".`,
                    severity: 'info',
                };

            case 'SOMEONE_COMMENTED':
                return {
                    title: 'New Comment',
                    body: `${data.commenterUsername ?? 'Someone'} commented on your strategy "${data.strategyName ?? data.strategyId ?? 'unknown'}".`,
                    severity: 'info',
                };

            default:
                return {
                    title: 'Polyforge Notification',
                    body: `New event: ${eventType}`,
                    severity: 'info',
                };
        }
    }

    toHtml(content: NotificationContent): string {
        const color = {
            info:    '#3b82f6',
            success: '#22c55e',
            warning: '#f59e0b',
            error:   '#ef4444',
        }[content.severity];

        return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f9fafb; padding: 24px;">
  <div style="max-width: 480px; background: #fff; border-radius: 8px; padding: 24px; border-left: 4px solid ${color};">
    <h2 style="color: ${color}; margin: 0 0 12px;">${content.title}</h2>
    <p style="color: #374151; margin: 0;">${content.body}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Manage your notification preferences at
      <a href="${process.env.FRONTEND_URL ?? 'https://polyforge.app'}/settings/notifications">polyforge.app/settings</a>
    </p>
  </div>
</body>
</html>`;
    }
}
