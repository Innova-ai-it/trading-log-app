import { create } from 'zustand';
import { Trade, Settings, BankrollAdjustment, TradeResult, AdjustmentType } from '../types';
import { supabase } from '../lib/supabase';
import { recalculateTrades } from '../utils/helpers';

interface SupabaseStoreState {
  trades: Trade[];
  settings: Settings;
  adjustments: BankrollAdjustment[];
  loading: boolean;
  syncing: boolean;
  
  // Fetch data
  fetchAll: () => Promise<void>;
  fetchTrades: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchAdjustments: () => Promise<void>;
  
  // Trades
  addTrade: (trade: Trade) => Promise<void>;
  updateTrade: (id: string, trade: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  importTrades: (trades: Trade[]) => Promise<void>;
  clearAllTrades: () => Promise<void>;
  
  // Settings
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  
  // Adjustments
  addAdjustment: (adjustment: BankrollAdjustment) => Promise<void>;
  deleteAdjustment: (id: string) => Promise<void>;
}

const defaultSettings: Settings = {
  initialBank: 1000,
  currentBank: undefined,
  dailyTP: 0,
  dailySL: 0,
  weeklyTP: 0,
  weeklySL: 0,
  monthlyTP: 0,
  monthlySL: 0,
};

export const useSupabaseStore = create<SupabaseStoreState>((set, get) => ({
  trades: [],
  settings: defaultSettings,
  adjustments: [],
  loading: false,
  syncing: false,

  fetchAll: async () => {
    await Promise.all([
      get().fetchSettings(),
      get().fetchTrades(),
      get().fetchAdjustments(),
    ]);
  },

  fetchTrades: async () => {
    set({ syncing: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const trades = data.map(mapSupabaseToTrade);
        const recalculated = recalculateTrades(trades, get().settings);
        set({ trades: recalculated });
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      set({ syncing: false });
    }
  },

  fetchSettings: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        set({ settings: mapSupabaseToSettings(data) });
      } else {
        // Create default settings for new user
        await get().setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  },

  fetchAdjustments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('adjustments')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        set({ adjustments: data.map(mapSupabaseToAdjustment) });
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }
  },

  addTrade: async (trade: Trade) => {
    set({ syncing: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('trades')
        .insert(mapTradeToSupabase(trade, user.id));

      if (error) throw error;

      await get().fetchTrades();
    } catch (error) {
      console.error('Error adding trade:', error);
      throw error;
    } finally {
      set({ syncing: false });
    }
  },

  updateTrade: async (id: string, trade: Partial<Trade>) => {
    set({ syncing: true });
    try {
      const fullTrade = get().trades.find(t => t.id === id);
      if (!fullTrade) throw new Error('Trade not found');

      const updatedTrade = { ...fullTrade, ...trade };
      const { error } = await supabase
        .from('trades')
        .update(mapTradeToSupabase(updatedTrade))
        .eq('id', id);

      if (error) throw error;

      await get().fetchTrades();
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    } finally {
      set({ syncing: false });
    }
  },

  deleteTrade: async (id: string) => {
    set({ syncing: true });
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await get().fetchTrades();
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    } finally {
      set({ syncing: false });
    }
  },

  importTrades: async (newTrades: Trade[]) => {
    set({ syncing: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const tradesData = newTrades.map(trade => mapTradeToSupabase(trade, user.id));
      const { error } = await supabase.from('trades').insert(tradesData);

      if (error) throw error;

      await get().fetchTrades();
    } catch (error) {
      console.error('Error importing trades:', error);
      throw error;
    } finally {
      set({ syncing: false });
    }
  },

  clearAllTrades: async () => {
    set({ syncing: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      set({ trades: [] });
    } catch (error) {
      console.error('Error clearing trades:', error);
      throw error;
    } finally {
      set({ syncing: false });
    }
  },

  setSettings: async (newSettings: Partial<Settings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updatedSettings = { ...get().settings, ...newSettings };
      
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          user_id: user.id, 
          ...mapSettingsToSupabase(updatedSettings) 
        });

      if (error) throw error;

      set({ settings: updatedSettings });
      await get().fetchTrades(); // Recalculate with new settings
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  addAdjustment: async (adjustment: BankrollAdjustment) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('adjustments')
        .insert(mapAdjustmentToSupabase(adjustment, user.id));

      if (error) throw error;

      await get().fetchAdjustments();
    } catch (error) {
      console.error('Error adding adjustment:', error);
      throw error;
    }
  },

  deleteAdjustment: async (id: string) => {
    try {
      const { error } = await supabase
        .from('adjustments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await get().fetchAdjustments();
    } catch (error) {
      console.error('Error deleting adjustment:', error);
      throw error;
    }
  },
}));

// Mapping functions (snake_case <-> camelCase)
function mapSupabaseToTrade(data: any): Trade {
  return {
    id: data.id,
    date: data.date,
    competition: data.competition || '',
    homeTeam: data.home_team,
    awayTeam: data.away_team || '',
    strategy: data.strategy || '',
    odds: Number(data.odds),
    stakePercent: Number(data.stake_percent),
    stakeEuro: Number(data.stake_euro),
    matchedParts: data.matched_parts,
    position: data.position || '',
    result: data.result as TradeResult,
    profitLoss: Number(data.profit_loss),
    roi: Number(data.roi),
    points: data.points ? Number(data.points) : undefined,
    dailyPL: data.daily_pl ? Number(data.daily_pl) : undefined,
    tpSl: data.tp_sl || undefined,
    notes: data.notes || undefined,
    createdAt: data.created_at || undefined,
  };
}

function mapTradeToSupabase(trade: Trade, userId?: string): any {
  return {
    id: trade.id,
    user_id: userId,
    date: trade.date,
    competition: trade.competition,
    home_team: trade.homeTeam,
    away_team: trade.awayTeam,
    strategy: trade.strategy,
    odds: trade.odds,
    stake_percent: trade.stakePercent,
    stake_euro: trade.stakeEuro,
    matched_parts: trade.matchedParts,
    position: trade.position,
    result: trade.result,
    profit_loss: trade.profitLoss,
    roi: trade.roi,
    points: trade.points,
    daily_pl: trade.dailyPL,
    tp_sl: trade.tpSl,
    notes: trade.notes,
  };
}

function mapSupabaseToSettings(data: any): Settings {
  return {
    initialBank: Number(data.initial_bank),
    currentBank: data.current_bank ? Number(data.current_bank) : undefined,
    dailyTP: Number(data.daily_tp),
    dailySL: Number(data.daily_sl),
    weeklyTP: Number(data.weekly_tp),
    weeklySL: Number(data.weekly_sl),
    monthlyTP: Number(data.monthly_tp),
    monthlySL: Number(data.monthly_sl),
  };
}

function mapSettingsToSupabase(settings: Settings): any {
  return {
    initial_bank: settings.initialBank,
    current_bank: settings.currentBank,
    daily_tp: settings.dailyTP,
    daily_sl: settings.dailySL,
    weekly_tp: settings.weeklyTP,
    weekly_sl: settings.weeklySL,
    monthly_tp: settings.monthlyTP,
    monthly_sl: settings.monthlySL,
  };
}

function mapSupabaseToAdjustment(data: any): BankrollAdjustment {
  return {
    id: data.id,
    date: data.date,
    type: data.type as AdjustmentType,
    amount: Number(data.amount),
    notes: data.notes || undefined,
  };
}

function mapAdjustmentToSupabase(adj: BankrollAdjustment, userId: string): any {
  return {
    id: adj.id,
    user_id: userId,
    date: adj.date,
    type: adj.type,
    amount: adj.amount,
    notes: adj.notes,
  };
}

