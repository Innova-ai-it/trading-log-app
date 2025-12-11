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
  monthlyTarget?: number; // Obiettivo mensile in percentuale (del bankroll mensile iniziale)
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
  createdAt?: string; // Timestamp from database
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

// ============================================
// ALERT ROOM TYPES
// ============================================

export enum FilterCategory {
  GOALS = 'Goals',
  LAYING = 'Laying',
  MATCH_ODDS = 'MatchOdds',
  CORNERS = 'Corners',
  CARDS = 'Cards'
}

export interface FilterConditions {
  timing?: {
    minMinute?: number;
    maxMinute?: number;
  };
  matchStatus?: {
    score?: string | string[]; // e.g. "0-0" o ["0-0", "1-0", "0-1"] - il filtro si attiva se il match ha uno di questi score
    maxRedCards?: number;
    maxYellowCards?: number;
  };
  liveStats?: {
    totalShots?: { min?: number; max?: number };
    shotsOnTarget?: { min?: number; max?: number };
    corners?: { min?: number; max?: number };
    possession?: { min?: number; max?: number };
    dangerousAttacks?: { min?: number; max?: number };
    xG?: { min?: number; max?: number };
  };
  preMatchData?: {
    xG_firstHalf_avg?: { min?: number };
    goalsScoredFH_last5?: { min?: number };
    allowedLeagues?: string[];
    minLeagueQuality?: number;
  };
  odds?: {
    market: string;
    min?: number;
    max?: number;
  };
  weights?: {
    timing?: number;
    matchStatus?: number;
    liveStats?: number;
    preMatchData?: number;
    odds?: number;
  };
}

export interface StrategyFilter {
  id: string;
  userId: string;
  name: string;
  category: FilterCategory;
  targetMarket?: string;
  isActive: boolean;
  color: string;
  conditions: FilterConditions;
  confidenceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedStrategyData {
  name: string;
  description?: string;
  entryConditions?: {
    odds?: {
      optimalRange?: string;
      preferredRange?: string;
      avoidBelow?: number;
      avoidAbove?: number;
    };
    preMatch?: {
      xgFirstHalf?: string;
      goalsLast5?: string;
      preferredLeagues?: string[];
      avoidLeagues?: string[];
    };
    live?: {
      minuteRange?: string;
      score?: string[];
      shotsOnTarget?: string;
      xg?: string;
      possession?: string;
      avoid?: string[];
    };
  };
  exitConditions?: {
    goal?: string;
    minute?: string;
    stopLoss?: string;
  };
  riskManagement?: {
    stake?: string;
    splitStaking?: string;
    takeProfit?: string;
    stopLoss?: string;
  };
  notes?: string;
}

export interface UserStrategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string; // Contenuto originale Markdown
  parsedData?: ParsedStrategyData;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface LiveMatchStatistics {
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  possession?: { home: number; away: number };
  dangerousAttacks?: { home: number; away: number };
  xG?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
}

export interface LiveMatchOdds {
  over_0_5_fh?: number;
  over_1_5_fh?: number;
  over_2_5_match?: number;
  btts?: number;
  ltd?: number;
  ltf?: number;
  [key: string]: number | undefined;
}

export interface LiveMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  score: { home: number; away: number };
  statistics?: LiveMatchStatistics;
  odds?: LiveMatchOdds;
  status: 'LIVE' | 'HT' | 'FT' | 'CANCELLED';
  kickoffTime?: string;
  preMatchData?: {
    xG_firstHalf_avg?: number;
    goalsScoredFH_last5?: number;
    leagueQuality?: number;
    // Statistiche complete primo e secondo tempo
    avgGoalsPerMatch?: number; // Media goal totali per partita
    goalsFirstHalf?: number; // Goal primo tempo (ultimi 5 match combinati)
    goalsSecondHalf?: number; // Goal secondo tempo (ultimi 5 match combinati)
    scoringPattern?: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED'; // Quando segna di più
    homeTeamStats?: {
      avgGoalsFor?: number; // Media goal fatti dalla squadra casa
      avgGoalsAgainst?: number; // Media goal subiti dalla squadra casa
      goalsFH?: number; // Goal primo tempo squadra casa
      goalsSH?: number; // Goal secondo tempo squadra casa
      scoringPattern?: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
    };
    awayTeamStats?: {
      avgGoalsFor?: number; // Media goal fatti dalla squadra trasferta
      avgGoalsAgainst?: number; // Media goal subiti dalla squadra trasferta
      goalsFH?: number; // Goal primo tempo squadra trasferta
      goalsSH?: number; // Goal secondo tempo squadra trasferta
      scoringPattern?: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
    };
  };
}

export interface MatchAlert {
  filterId: string;
  filterName: string;
  filterColor: string;
  confidence: number;
  breakdown: {
    timing: number;
    matchStatus: number;
    liveStats: number;
    preMatchData: number;
    odds: number;
  };
}

export interface UserNotificationSettings {
  userId: string;
  pushEnabled: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
  minConfidenceThreshold: number;
  maxAlertsPerHour: number;
  activeHoursStart?: string; // HH:mm format
  activeHoursEnd?: string; // HH:mm format
  createdAt: string;
  updatedAt: string;
}

export interface MatchConfidenceResult {
  confidence: number;
  breakdown: {
    timing: number;
    matchStatus: number;
    liveStats: number;
    preMatchData: number;
    odds: number;
  };
  shouldAlert: boolean;
  matchedFilters: string[]; // Filter IDs that matched
}

// ============================================
// TRADING PLAN TYPES
// ============================================

export interface TradingPlan {
  id: string;
  userId: string;
  planDate: string; // ISO date string
  planContent: string;
  matchesAnalyzed?: any[]; // Array delle partite analizzate
  contextSnapshot?: any; // Snapshot del contesto al momento della generazione
  createdAt: string;
  updatedAt: string;
}

export interface TradingPlanFeedback {
  id: string;
  planId: string;
  userId: string;
  matchIdentifier: string; // Competizione + squadre
  recommendationText?: string; // Il consiglio specifico dato nel piano
  wasFollowed?: boolean; // Se l'utente ha seguito il consiglio
  wasProfitable?: boolean; // Se il trade è stato profittevole
  actualResult?: string; // Risultato reale
  feedbackNotes?: string; // Note aggiuntive
  tradeId?: string; // Trade associato se eseguito
  createdAt: string;
  updatedAt: string;
}