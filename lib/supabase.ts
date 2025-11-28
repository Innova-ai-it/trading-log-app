import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database type definitions
export interface Database {
  public: {
    Tables: {
      trades: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          competition: string | null;
          home_team: string;
          away_team: string | null;
          strategy: string | null;
          odds: number;
          stake_percent: number;
          stake_euro: number;
          matched_parts: number;
          position: string | null;
          result: string;
          profit_loss: number;
          roi: number;
          points: number | null;
          daily_pl: number | null;
          tp_sl: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['trades']['Insert']>;
      };
      settings: {
        Row: {
          user_id: string;
          initial_bank: number;
          current_bank: number | null;
          daily_tp: number;
          daily_sl: number;
          weekly_tp: number;
          weekly_sl: number;
          monthly_tp: number;
          monthly_sl: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
      adjustments: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          type: 'DEPOSIT' | 'WITHDRAWAL';
          amount: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['adjustments']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['adjustments']['Insert']>;
      };
    };
  };
}

