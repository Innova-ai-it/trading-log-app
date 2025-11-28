export enum TradeResult {
  WIN = 'WIN',
  LOSE = 'LOSE',
  VOID = 'VOID',
  OPEN = 'OPEN'
}

export enum AdjustmentType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL'
}

export interface BankrollAdjustment {
  id: string;
  date: string;
  type: AdjustmentType;
  amount: number;
  notes?: string;
}

export interface Settings {
  initialBank: number;
  currentBank?: number; // Bank attuale importato dal CSV (B7)
  dailyTP: number;
  dailySL: number;
  weeklyTP: number;
  weeklySL: number;
  monthlyTP: number;
  monthlySL: number;
}

export interface Trade {
  id: string;
  date: string; // ISO string or formatted string
  competition: string;
  homeTeam: string;
  awayTeam: string;
  strategy: string;
  odds: number;
  stakePercent: number;
  stakeEuro: number;
  matchedParts: number; // Percentage 0-100 or 0-1
  position: string;
  result: TradeResult;
  profitLoss: number;
  roi: number;
  points?: number;
  dailyPL?: number;
  tpSl?: string;
  notes?: string;
}

export interface BankrollSnapshot {
  date: string;
  balance: number;
}

export interface DashboardMetrics {
  totalProfit: number;
  totalTrades: number;
  winRate: number;
  roi: number;
  currentBankroll: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  dailyTPHits: number;
  dailySLHits: number;
  bestDay: { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
}