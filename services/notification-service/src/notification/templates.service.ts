import { Injectable } from "@nestjs/common";

const FRONTEND = process.env.FRONTEND_URL ?? "https://polyforge.app";

export interface NotificationContent {
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "error";
}

const SEVERITY_COLOR: Record<NotificationContent["severity"], string> = {
  info: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
};

const SEVERITY_LABEL: Record<NotificationContent["severity"], string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Alert",
};

@Injectable()
export class TemplatesService {
  build(eventType: string, data: Record<string, string>): NotificationContent {
    switch (eventType) {
      case "ORDER_FILLED":
        return {
          title: "Order Filled",
          body: `Your order on token ${data.tokenId ?? "unknown"} was filled at ${data.fillPrice ?? data.price ?? "unknown"}.${data.pnl ? ` P&L: ${data.pnl} USDC.` : ""}`,
          severity: "success",
        };

      case "STRATEGY_ERROR":
        return {
          title: "Strategy Error",
          body: `Strategy ${data.strategyId ?? "unknown"} encountered an error: ${data.reason ?? "unknown error"}.`,
          severity: "error",
        };

      case "BACKTEST_COMPLETE":
        return {
          title: "Backtest Complete",
          body: `Your backtest run ${data.runId ?? "unknown"} has finished.${data.totalPnl ? ` Total P&L: ${data.totalPnl} USDC.` : ""}`,
          severity: "info",
        };

      case "PRICE_ALERT":
        return {
          title: "Price Alert Triggered",
          body: `Token ${data.tokenId ?? "unknown"} reached your price alert threshold of ${data.threshold ?? data.price ?? "unknown"}.`,
          severity: "warning",
        };

      case "DAILY_LOSS_LIMIT":
        return {
          title: "Daily Loss Limit Reached",
          body: `Strategy ${data.strategyId ?? "unknown"} hit its daily loss limit and has been stopped.`,
          severity: "error",
        };

      case "MARKET_RESOLVED":
        return {
          title: "Market Resolved",
          body: `Market ${data.marketId ?? "unknown"} has resolved with outcome ${data.outcome ?? "unknown"}.`,
          severity: "info",
        };

      case "SOMEONE_FORKED":
        return {
          title: "Strategy Forked",
          body: `${data.forkerUsername ?? "Someone"} forked your strategy "${data.strategyName ?? data.strategyId ?? "unknown"}".`,
          severity: "info",
        };

      case "SOMEONE_FOLLOWED":
        return {
          title: "New Follower",
          body: `${data.followerUsername ?? "Someone"} started following you.`,
          severity: "info",
        };

      case "SOMEONE_LIKED":
        return {
          title: "Strategy Liked",
          body: `${data.likerUsername ?? "Someone"} liked your strategy "${data.strategyName ?? data.strategyId ?? "unknown"}".`,
          severity: "info",
        };

      case "SOMEONE_COMMENTED":
        return {
          title: "New Comment",
          body: `${data.commenterUsername ?? "Someone"} commented on your strategy "${data.strategyName ?? data.strategyId ?? "unknown"}".`,
          severity: "info",
        };

      case "TICKET_REPLY":
        return {
          title: "Support Reply",
          body: `${data.adminName ?? "Our support team"} replied to your ticket "${data.subject ?? "unknown"}". Check your ticket for details.`,
          severity: "info",
        };

      case "TICKET_CLOSED":
        return {
          title: "Ticket Closed",
          body: `Your support ticket "${data.subject ?? "unknown"}" has been closed. If you need further help, you can open a new ticket.`,
          severity: "info",
        };

      case "TICKET_CREATED":
        return {
          title: "Ticket Received",
          body: `Your support ticket "${data.subject ?? "unknown"}" has been received. We'll get back to you as soon as possible.`,
          severity: "info",
        };

      default:
        return {
          title: "Polyforge Notification",
          body: `New event: ${eventType}`,
          severity: "info",
        };
    }
  }

  toHtml(content: NotificationContent): string {
    const accent = SEVERITY_COLOR[content.severity];
    const label = SEVERITY_LABEL[content.severity];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${content.title}</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;background:#f4f4f7;
         font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
    table{border-collapse:collapse}
    a{color:#06b6d4}
  </style>
</head>
<body>
  <!-- Preheader -->
  <span style="display:none;font-size:1px;color:#f4f4f7;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${content.title} — ${content.body}
  </span>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f7">
    <tr>
      <td align="center" style="padding:32px 16px 0">

        <table width="100%" border="0" cellspacing="0" cellpadding="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;
                      box-shadow:0 2px 16px rgba(0,0,0,0.06);overflow:hidden">

          <!-- Header -->
          <tr>
            <td bgcolor="#0a0a0f" align="center" style="padding:24px 32px">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                         xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#67e8f9"/>
                          <stop offset="100%" stop-color="#06b6d4"/>
                        </linearGradient>
                      </defs>
                      <path d="M13 2L4.09 12.96H11L10 22L20.91 11.04H14L13 2Z"
                            fill="url(#bg)"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle">
                    <span style="font-size:22px;font-weight:700;color:#f0f0f5;
                                 font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                                 letter-spacing:-0.5px">Polyforge</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Severity stripe -->
          <tr>
            <td height="4" bgcolor="${accent}" style="font-size:0;line-height:0">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 28px">

              <!-- Severity badge -->
              <p style="margin:0 0 16px">
                <span style="display:inline-block;padding:3px 10px;border-radius:999px;
                             font-size:11px;font-weight:700;text-transform:uppercase;
                             letter-spacing:0.06em;
                             background:${accent}1a;color:${accent}">${label}</span>
              </p>

              <!-- Title -->
              <h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#111827;
                         font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
                ${content.title}
              </h2>

              <!-- Message -->
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7">
                ${content.body}
              </p>

              <!-- CTA -->
              <p style="margin:0">
                <a href="${FRONTEND}"
                   style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                          font-size:14px;font-weight:600;padding:10px 24px;text-decoration:none">
                  Open Polyforge
                </a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f9fafb"
                style="padding:18px 40px;border-top:1px solid #e5e7eb;
                       font-size:12px;color:#9ca3af;line-height:1.6;
                       font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
              <p style="margin:0 0 6px">
                You received this because you have notifications enabled for this event type.
              </p>
              <p style="margin:0">
                <a href="${FRONTEND}/settings" style="color:#06b6d4;text-decoration:none">Manage preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${FRONTEND}/terms" style="color:#9ca3af;text-decoration:none">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${FRONTEND}/privacy" style="color:#9ca3af;text-decoration:none">Privacy</a>
              </p>
            </td>
          </tr>

        </table>

        <p style="font-size:12px;color:#9ca3af;margin:16px 0 32px;text-align:center">
          &copy; ${new Date().getFullYear()} Polyforge. All rights reserved.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
