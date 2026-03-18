import { Injectable } from "@nestjs/common";

export interface FillRecord {
  side: "BUY" | "SELL";
  pnl: number; // 0 for BUY; realized for SELL
  equityCurve: number; // cumulative P&L at this point
  simulatedAt: Date;
}

export interface BacktestMetrics {
  totalPnl: number;
  winRate: number; // 0–1
  maxDrawdown: number; // absolute USDC value, always positive
  sharpeRatio: number;
}

@Injectable()
export class MetricsService {
  compute(fills: FillRecord[]): BacktestMetrics {
    const sells = fills.filter((f) => f.side === "SELL");
    const wins = sells.filter((f) => f.pnl > 0);

    const totalPnl = sells.reduce((sum, f) => sum + f.pnl, 0);
    const winRate = sells.length > 0 ? wins.length / sells.length : 0;
    const maxDrawdown = this.computeMaxDrawdown(
      fills.map((f) => f.equityCurve),
    );
    const sharpeRatio = this.computeSharpe(fills);

    return { totalPnl, winRate, maxDrawdown, sharpeRatio };
  }

  private computeMaxDrawdown(equityCurve: number[]): number {
    let peak = 0;
    let maxDd = 0;
    for (const equity of equityCurve) {
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  }

  private computeSharpe(fills: FillRecord[]): number {
    if (fills.length < 2) return 0;

    // Last equity value per calendar day
    const dailyEquity = new Map<string, number>();
    for (const f of fills) {
      const day = f.simulatedAt.toISOString().slice(0, 10);
      dailyEquity.set(day, f.equityCurve);
    }

    const equities = Array.from(dailyEquity.values());
    if (equities.length < 2) return 0;

    // Absolute daily returns
    const returns: number[] = [];
    for (let i = 1; i < equities.length; i++) {
      returns.push(equities[i] - equities[i - 1]);
    }

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);

    if (std === 0) return 0;
    return (mean / std) * Math.sqrt(252);
  }
}
