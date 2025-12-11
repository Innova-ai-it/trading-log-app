import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Trade, Settings, BankrollAdjustment } from '../types';
import { recalculateTrades } from '../utils/helpers';

interface StoreState {
  trades: Trade[];
  settings: Settings;
  adjustments: BankrollAdjustment[];
  // Actions
  setSettings: (settings: Partial<Settings>) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, updatedTrade: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  importTrades: (newTrades: Trade[]) => void;
  clearAllTrades: () => void;
  // Adjustments
  addAdjustment: (adjustment: BankrollAdjustment) => void;
  deleteAdjustment: (id: string) => void;
  // Legacy support getter/setter
  initialBankroll: number;
  setInitialBankroll: (amount: number) => void;
}

const defaultSettings: Settings = {
  initialBank: 1000,
  dailyTP: 0,
  dailySL: 0,
  weeklyTP: 0,
  weeklySL: 0,
  monthlyTP: 0,
  monthlySL: 0,
  monthlyTarget: undefined
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      trades: [],
      settings: defaultSettings,
      adjustments: [],
      initialBankroll: 1000, // Syncs with settings.initialBank

      setSettings: (newSettings) => {
        set((state) => {
          const updatedSettings = { ...state.settings, ...newSettings };
          // If initial bank changed, update legacy prop too
          const legacyBank = newSettings.initialBank !== undefined ? newSettings.initialBank : state.initialBankroll;
          
          // Recalculate all trades with new settings
          const recalculated = recalculateTrades(state.trades, updatedSettings, state.adjustments);
          
          return {
            settings: updatedSettings,
            initialBankroll: legacyBank,
            trades: recalculated
          };
        });
      },

      setInitialBankroll: (amount) => {
        get().setSettings({ initialBank: amount });
      },

      addTrade: (trade) =>
        set((state) => {
          // Add raw trade first, then recalculate everything
          // We put new trade at the top, but recalculateTrades handles sorting
          const allTrades = [trade, ...state.trades];
          const recalculated = recalculateTrades(allTrades, state.settings, state.adjustments);
          return { trades: recalculated };
        }),

      updateTrade: (id, updatedTrade) =>
        set((state) => {
          const updatedTrades = state.trades.map((t) =>
            t.id === id ? { ...t, ...updatedTrade } : t
          );
          const recalculated = recalculateTrades(updatedTrades, state.settings, state.adjustments);
          return { trades: recalculated };
        }),

      deleteTrade: (id) =>
        set((state) => {
          const remainingTrades = state.trades.filter((t) => t.id !== id);
          const recalculated = recalculateTrades(remainingTrades, state.settings, state.adjustments);
          return { trades: recalculated };
        }),

      importTrades: (newTrades) =>
        set((state) => {
          const merged = [...newTrades, ...state.trades];
          const recalculated = recalculateTrades(merged, state.settings, state.adjustments);
          return { trades: recalculated };
        }),

      clearAllTrades: () => set({ trades: [] }),

      addAdjustment: (adjustment) =>
        set((state) => {
          const updatedAdjustments = [...state.adjustments, adjustment].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          // Recalculate trades with updated adjustments
          const recalculated = recalculateTrades(state.trades, state.settings, updatedAdjustments);
          return {
            adjustments: updatedAdjustments,
            trades: recalculated
          };
        }),

      deleteAdjustment: (id) =>
        set((state) => {
          const updatedAdjustments = state.adjustments.filter((a) => a.id !== id);
          // Recalculate trades with updated adjustments
          const recalculated = recalculateTrades(state.trades, state.settings, updatedAdjustments);
          return {
            adjustments: updatedAdjustments,
            trades: recalculated
          };
        }),
    }),
    {
      name: 'sports-trader-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);