import { create } from 'zustand';
import { adminApi } from '@/lib/api';

interface PollingState {
  openTickets: number;
  start: () => void;
  stop: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

async function fetchOpenTickets(): Promise<number> {
  try {
    const res = await adminApi.tickets({ status: 'OPEN', limit: 1 });
    return res.total ?? 0;
  } catch {
    return 0;
  }
}

export const usePollingStore = create<PollingState>((set) => ({
  openTickets: 0,

  start: () => {
    if (intervalId) return;
    // Fetch immediately, then every 30s
    fetchOpenTickets().then((count) => set({ openTickets: count }));
    intervalId = setInterval(async () => {
      const count = await fetchOpenTickets();
      set({ openTickets: count });
    }, 30_000);
  },

  stop: () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },
}));
