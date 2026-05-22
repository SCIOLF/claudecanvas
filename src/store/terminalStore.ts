import { create } from 'zustand';
import type { TerminalConfig, TerminalStatus } from '../types';

interface TerminalStore {
  terminals: TerminalConfig[];
  activeTerminalId: string | null;
  statuses: Record<string, TerminalStatus>;
  addTerminal: (config: TerminalConfig) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  updateStatus: (id: string, status: TerminalStatus) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminals: [],
  activeTerminalId: null,
  statuses: {},

  addTerminal: (config) =>
    set((state) => ({
      terminals: [...state.terminals, config],
      activeTerminalId: state.activeTerminalId ?? config.id,
      statuses: { ...state.statuses, [config.id]: 'active' },
    })),

  removeTerminal: (id) =>
    set((state) => {
      const terminals = state.terminals.filter((t) => t.id !== id);
      const { [id]: _removed, ...statuses } = state.statuses;
      const activeTerminalId =
        state.activeTerminalId === id
          ? (terminals[0]?.id ?? null)
          : state.activeTerminalId;
      return { terminals, statuses, activeTerminalId };
    }),

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  updateStatus: (id, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [id]: status },
    })),
}));
