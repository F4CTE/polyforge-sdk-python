import { create } from 'zustand';

/**
 * Lightweight store to broadcast execution state to block nodes
 * so they can visually indicate when a strategy is live or a backtest is running.
 */
interface ExecutionState {
  /** Whether a backtest is currently running for this strategy */
  backtestRunning: boolean;
  /** Whether the strategy is executing live (or paper) */
  liveRunning: boolean;
  /** IDs of blocks that recently fired (for pulse animation) */
  firedBlockIds: Set<string>;

  setBacktestRunning: (running: boolean) => void;
  setLiveRunning: (running: boolean) => void;
  fireBlock: (blockId: string) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  backtestRunning: false,
  liveRunning: false,
  firedBlockIds: new Set(),

  setBacktestRunning: (running) => set({ backtestRunning: running }),
  setLiveRunning: (running) => set({ liveRunning: running }),

  fireBlock: (blockId) => {
    const newSet = new Set(get().firedBlockIds);
    newSet.add(blockId);
    set({ firedBlockIds: newSet });
    // Remove after animation
    setTimeout(() => {
      const current = get().firedBlockIds;
      const next = new Set(current);
      next.delete(blockId);
      set({ firedBlockIds: next });
    }, 1500);
  },
}));
