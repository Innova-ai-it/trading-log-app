export enum TradeResult {
  WIN = 'WIN',
  LOSE = 'LOSE',
  VOID = 'VOID',
  OPEN = 'OPEN'
}

export interface Settings {
  initialBank: number;
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