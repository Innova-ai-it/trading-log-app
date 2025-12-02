import { Trade, TradeResult, Settings, BankrollAdjustment, AdjustmentType } from '../types';
import { calculateTotalCapitalInvested } from './helpers';

// Helper: Get month start/end dates
export const getMonthRange = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
};

// Helper: Filter trades by month
export const filterTradesByMonth = (trades: Trade[], year: number, month: number): Trade[] => {
  const { start, end } = getMonthRange(year, month);
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return tradeDate >= start && tradeDate <= end;
  });
};

// Helper: Get day of week name in English
const getDayOfWeek = (date: string): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
};

// Helper: Get hour from date (if createdAt exists, otherwise estimate)
const getTradeHour = (trade: Trade): number => {
  if (trade.createdAt) {
    return new Date(trade.createdAt).getHours();
  }
  // Default to noon if no timestamp
  return 12;
};

// ==================== PERFORMANCE OVERVIEW ====================

export interface PerformanceOverview {
  startingBankroll: number;
  endingBankroll: number;
  netProfit: number;
  roi: number;
  totalStaked: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgProfitPerTrade: number;
}

export const calculatePerformanceOverview = (
  allTrades: Trade[],
  initialBankroll: number,
  adjustments: BankrollAdjustment[],
  monthStart: Date,
  monthEnd: Date
): PerformanceOverview => {
  // Filter trades for the selected month
  const monthTrades = allTrades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return tradeDate >= monthStart && tradeDate <= monthEnd;
  });
  
  const closedTrades = monthTrades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  const totalTrades = closedTrades.length;
  
  // Calculate net profit for the month
  const netProfit = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  
  // Calculate adjustments during the month
  const adjustmentsInMonth = adjustments.filter(adj => {
    const adjDate = new Date(adj.date);
    return adjDate >= monthStart && adjDate <= monthEnd;
  });
  const adjustmentsSum = adjustmentsInMonth.reduce((sum, adj) => {
    return sum + (adj.type === AdjustmentType.DEPOSIT ? adj.amount : -adj.amount);
  }, 0);
  // Calculate total deposits during the month (for ROI calculation)
  const depositsInMonth = adjustmentsInMonth
    .filter(adj => adj.type === AdjustmentType.DEPOSIT)
    .reduce((sum, adj) => sum + adj.amount, 0);
  
  // Calculate bankroll at the END of the selected month (not current total bankroll)
  // This ensures past months show correct values, not affected by future months
  const adjustmentsUpToMonthEnd = adjustments.filter(adj => {
    const adjDate = new Date(adj.date);
    return adjDate <= monthEnd;
  });
  const tradesUpToMonthEnd = allTrades.filter(t => {
    const tradeDate = new Date(t.date);
    return tradeDate <= monthEnd && t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID;
  });
  
  const capitalInvestedUpToMonthEnd = calculateTotalCapitalInvested(initialBankroll, adjustmentsUpToMonthEnd);
  const profitUpToMonthEnd = tradesUpToMonthEnd.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const bankrollAtMonthEnd = capitalInvestedUpToMonthEnd + profitUpToMonthEnd;
  
  // Starting bankroll = Bankroll at end of month - Net profit of the month - Adjustments of the month
  const startingBankroll = bankrollAtMonthEnd - netProfit - adjustmentsSum;
  
  // Ending bankroll = Starting bankroll + Net profit + Adjustments
  const endingBankroll = startingBankroll + netProfit + adjustmentsSum;
  
  // Total staked
  const totalStaked = closedTrades.reduce((sum, t) => sum + t.stakeEuro, 0);
  
  // Win rate
  const wins = closedTrades.filter(t => t.result === TradeResult.WIN).length;
  const losses = closedTrades.filter(t => t.result === TradeResult.LOSE).length;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  
  // Profit Factor
  const totalWinAmount = closedTrades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
  const totalLossAmount = Math.abs(closedTrades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;
  
  // Expectancy
  const avgWin = wins > 0 ? totalWinAmount / wins : 0;
  const avgLoss = losses > 0 ? totalLossAmount / losses : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  
  // ROI - calculated on total capital invested during the month (starting bankroll + deposits)
  // This gives a more accurate ROI that accounts for capital additions during the month
  const totalCapitalInvestedInMonth = startingBankroll + depositsInMonth;
  const roi = totalCapitalInvestedInMonth > 0 ? (netProfit / totalCapitalInvestedInMonth) * 100 : 0;
  
  // Avg Profit per Trade
  const avgProfitPerTrade = totalTrades > 0 ? netProfit / totalTrades : 0;
  
  return {
    startingBankroll,
    endingBankroll,
    netProfit,
    roi,
    totalStaked,
    totalTrades,
    winRate,
    profitFactor,
    expectancy,
    avgProfitPerTrade
  };
};

// ==================== RISK METRICS ====================

export interface RiskMetrics {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  avgRiskPerTrade: number;
  sharpeRatio: number;
  recoveryFactor: number;
}

export const calculateRiskMetrics = (
  trades: Trade[],
  initialBankroll: number,
  adjustments: BankrollAdjustment[],
  monthStart: Date
): RiskMetrics => {
  const closedTrades = trades
    .filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID)
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // If same date, sort by createdAt if available
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  
  // Calculate bankroll evolution for drawdown
  const adjustmentsBeforeMonth = adjustments.filter(adj => new Date(adj.date) < monthStart);
  const closedTradesBeforeMonth = trades.filter(t => 
    new Date(t.date) < monthStart && 
    t.result !== TradeResult.OPEN && 
    t.result !== TradeResult.VOID
  );
  const profitBeforeMonth = closedTradesBeforeMonth.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  let currentBankroll = calculateTotalCapitalInvested(initialBankroll, adjustmentsBeforeMonth) + profitBeforeMonth;
  
  // Get month range to filter adjustments during the month
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  
  // Combine trades and adjustments, sort by date
  const allEvents: Array<{ date: Date; type: 'trade' | 'adjustment'; trade?: Trade; adjustment?: BankrollAdjustment }> = [];
  
  closedTrades.forEach(trade => {
    allEvents.push({ date: new Date(trade.date), type: 'trade', trade });
  });
  
  adjustments.filter(adj => {
    const adjDate = new Date(adj.date);
    return adjDate >= monthStart && adjDate <= monthEnd;
  }).forEach(adj => {
    allEvents.push({ date: new Date(adj.date), type: 'adjustment', adjustment: adj });
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let peakBankroll = currentBankroll;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  
  // Calculate drawdown iterating through all events (trades and adjustments)
  allEvents.forEach(event => {
    if (event.type === 'trade' && event.trade) {
      currentBankroll += event.trade.profitLoss;
    } else if (event.type === 'adjustment' && event.adjustment) {
      if (event.adjustment.type === AdjustmentType.DEPOSIT) {
        currentBankroll += event.adjustment.amount;
      } else {
        currentBankroll -= event.adjustment.amount;
      }
    }
    
    if (currentBankroll > peakBankroll) {
      peakBankroll = currentBankroll;
    }
    const drawdown = peakBankroll - currentBankroll;
    const drawdownPercent = peakBankroll > 0 ? (drawdown / peakBankroll) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  });
  
  // Consecutive streaks
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  
  closedTrades.forEach(trade => {
    if (trade.result === TradeResult.WIN) {
      currentWinStreak++;
      currentLossStreak = 0; // Reset loss streak
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (trade.result === TradeResult.LOSE) {
      currentLossStreak++;
      currentWinStreak = 0; // Reset win streak
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    } else {
      // For VOID trades, reset both streaks
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  });
  
  // Avg Risk per Trade
  const totalStaked = closedTrades.reduce((sum, t) => sum + t.stakeEuro, 0);
  const avgStake = closedTrades.length > 0 ? totalStaked / closedTrades.length : 0;
  const avgBankroll = peakBankroll > 0 ? peakBankroll : initialBankroll;
  const avgRiskPerTrade = avgBankroll > 0 ? (avgStake / avgBankroll) * 100 : 0;
  
  // Sharpe Ratio (simplified: mean return / std dev of returns)
  const returns = closedTrades.map(t => {
    const stake = t.stakeEuro;
    return stake > 0 ? (t.profitLoss / stake) : 0;
  });
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0 
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length 
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;
  
  // Recovery Factor
  const netProfit = closedTrades.reduce((sum, t) => sum + t.profitLoss, 0);
  const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : netProfit > 0 ? 999 : 0;
  
  return {
    maxDrawdown,
    maxDrawdownPercent,
    maxConsecutiveLosses: maxLossStreak,
    maxConsecutiveWins: maxWinStreak,
    avgRiskPerTrade,
    sharpeRatio,
    recoveryFactor
  };
};

// ==================== TRADING BEHAVIOR ====================

export interface TradingBehavior {
  totalTradingDays: number;
  avgTradesPerDay: number;
  bestDay: { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
  profitableDaysPercent: number;
}

export const calculateTradingBehavior = (trades: Trade[]): TradingBehavior => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  // Group by date
  const dailyMap = new Map<string, number>();
  closedTrades.forEach(trade => {
    const current = dailyMap.get(trade.date) || 0;
    dailyMap.set(trade.date, current + trade.profitLoss);
  });
  
  const totalTradingDays = dailyMap.size;
  const avgTradesPerDay = totalTradingDays > 0 ? closedTrades.length / totalTradingDays : 0;
  
  let bestDay = { date: '', profit: -Infinity };
  let worstDay = { date: '', profit: Infinity };
  let profitableDays = 0;
  
  dailyMap.forEach((profit, date) => {
    if (profit > bestDay.profit) bestDay = { date, profit };
    if (profit < worstDay.profit) worstDay = { date, profit };
    if (profit > 0) profitableDays++;
  });
  
  if (dailyMap.size === 0) {
    bestDay = { date: '-', profit: 0 };
    worstDay = { date: '-', profit: 0 };
  }
  
  const profitableDaysPercent = totalTradingDays > 0 ? (profitableDays / totalTradingDays) * 100 : 0;
  
  return {
    totalTradingDays,
    avgTradesPerDay,
    bestDay: bestDay.profit !== -Infinity ? bestDay : null,
    worstDay: worstDay.profit !== Infinity ? worstDay : null,
    profitableDaysPercent
  };
};

// ==================== STRATEGY PERFORMANCE ====================

export interface StrategyPerformance {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  roi: number;
}

export const calculateStrategyPerformance = (trades: Trade[]): StrategyPerformance[] => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  const strategyMap = new Map<string, {
    trades: Trade[];
    wins: number;
    losses: number;
    profit: number;
    totalStaked: number;
  }>();
  
  closedTrades.forEach(trade => {
    const strategy = trade.strategy || 'N/A';
    const current = strategyMap.get(strategy) || {
      trades: [],
      wins: 0,
      losses: 0,
      profit: 0,
      totalStaked: 0
    };
    
    current.trades.push(trade);
    if (trade.result === TradeResult.WIN) current.wins++;
    if (trade.result === TradeResult.LOSE) current.losses++;
    current.profit += trade.profitLoss;
    current.totalStaked += trade.stakeEuro;
    
    strategyMap.set(strategy, current);
  });
  
  return Array.from(strategyMap.entries())
    .map(([strategy, data]) => {
      const winRate = data.wins + data.losses > 0 
        ? (data.wins / (data.wins + data.losses)) * 100 
        : 0;
      const roi = data.totalStaked > 0 
        ? (data.profit / data.totalStaked) * 100 
        : 0;
      
      return {
        strategy,
        trades: data.trades.length,
        wins: data.wins,
        losses: data.losses,
        winRate,
        profit: data.profit,
        roi
      };
    })
    .sort((a, b) => b.profit - a.profit);
};

// ==================== COMPETITION PERFORMANCE ====================

export interface CompetitionPerformance {
  competition: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  roi: number;
}

export const calculateCompetitionPerformance = (trades: Trade[]): CompetitionPerformance[] => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  const competitionMap = new Map<string, {
    trades: Trade[];
    wins: number;
    losses: number;
    profit: number;
    totalStaked: number;
  }>();
  
  closedTrades.forEach(trade => {
    const competition = trade.competition || 'N/A';
    const current = competitionMap.get(competition) || {
      trades: [],
      wins: 0,
      losses: 0,
      profit: 0,
      totalStaked: 0
    };
    
    current.trades.push(trade);
    if (trade.result === TradeResult.WIN) current.wins++;
    if (trade.result === TradeResult.LOSE) current.losses++;
    current.profit += trade.profitLoss;
    current.totalStaked += trade.stakeEuro;
    
    competitionMap.set(competition, current);
  });
  
  return Array.from(competitionMap.entries())
    .map(([competition, data]) => {
      const winRate = data.wins + data.losses > 0 
        ? (data.wins / (data.wins + data.losses)) * 100 
        : 0;
      const roi = data.totalStaked > 0 
        ? (data.profit / data.totalStaked) * 100 
        : 0;
      
      return {
        competition,
        trades: data.trades.length,
        wins: data.wins,
        losses: data.losses,
        winRate,
        profit: data.profit,
        roi
      };
    })
    .sort((a, b) => b.profit - a.profit);
};

// ==================== ODDS RANGE ANALYSIS ====================

export interface OddsRangeAnalysis {
  range: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
}

export const calculateOddsRangeAnalysis = (trades: Trade[]): OddsRangeAnalysis[] => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  const ranges = [
    { label: '1.01 - 1.50', min: 1.01, max: 1.50 },
    { label: '1.51 - 2.00', min: 1.51, max: 2.00 },
    { label: '2.01 - 3.00', min: 2.01, max: 3.00 },
    { label: '3.01+', min: 3.01, max: Infinity }
  ];
  
  return ranges.map(range => {
    const tradesInRange = closedTrades.filter(t => t.odds >= range.min && t.odds < range.max);
    const wins = tradesInRange.filter(t => t.result === TradeResult.WIN).length;
    const losses = tradesInRange.filter(t => t.result === TradeResult.LOSE).length;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const profit = tradesInRange.reduce((sum, t) => sum + t.profitLoss, 0);
    
    return {
      range: range.label,
      trades: tradesInRange.length,
      wins,
      losses,
      winRate,
      profit
    };
  });
};

// ==================== TIME ANALYSIS ====================

export interface DayOfWeekPerformance {
  day: string;
  trades: number;
  profit: number;
  winRate: number;
}

export const calculateDayOfWeekPerformance = (trades: Trade[]): DayOfWeekPerformance[] => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  const dayMap = new Map<string, { trades: Trade[]; wins: number; losses: number; profit: number }>();
  
  closedTrades.forEach(trade => {
    const day = getDayOfWeek(trade.date);
    const current = dayMap.get(day) || { trades: [], wins: 0, losses: 0, profit: 0 };
    
    current.trades.push(trade);
    if (trade.result === TradeResult.WIN) current.wins++;
    if (trade.result === TradeResult.LOSE) current.losses++;
    current.profit += trade.profitLoss;
    
    dayMap.set(day, current);
  });
  
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  return daysOrder
    .map(day => {
      const data = dayMap.get(day);
      if (!data) {
        return { day, trades: 0, profit: 0, winRate: 0 };
      }
      const winRate = data.wins + data.losses > 0 
        ? (data.wins / (data.wins + data.losses)) * 100 
        : 0;
      return {
        day,
        trades: data.trades.length,
        profit: data.profit,
        winRate
      };
    })
    .filter(d => d.trades > 0);
};

export interface HourRangePerformance {
  range: string;
  trades: number;
  profit: number;
  winRate: number;
}

export const calculateHourRangePerformance = (trades: Trade[]): HourRangePerformance[] => {
  const closedTrades = trades.filter(t => t.result !== TradeResult.OPEN && t.result !== TradeResult.VOID);
  
  const ranges = [
    { label: '00:00 - 14:00', min: 0, max: 14 },
    { label: '14:00 - 18:00', min: 14, max: 18 },
    { label: '18:00 - 22:00', min: 18, max: 22 },
    { label: '22:00 - 24:00', min: 22, max: 24 }
  ];
  
  return ranges.map(range => {
    const tradesInRange = closedTrades.filter(t => {
      const hour = getTradeHour(t);
      return hour >= range.min && hour < range.max;
    });
    const wins = tradesInRange.filter(t => t.result === TradeResult.WIN).length;
    const losses = tradesInRange.filter(t => t.result === TradeResult.LOSE).length;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const profit = tradesInRange.reduce((sum, t) => sum + t.profitLoss, 0);
    
    return {
      range: range.label,
      trades: tradesInRange.length,
      profit,
      winRate
    };
  }).filter(r => r.trades > 0);
};

// ==================== MONTHLY COMPARISON ====================

export interface MonthlyComparison {
  kpi: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export const calculateMonthlyComparison = (
  currentTrades: Trade[],
  previousTrades: Trade[],
  initialBankroll: number,
  adjustments: BankrollAdjustment[],
  currentYear: number,
  currentMonth: number
): MonthlyComparison[] => {
  const currentMonthRange = getMonthRange(currentYear, currentMonth);
  const prevDate = new Date(currentYear, currentMonth - 2, 1);
  const prevMonth = getMonthRange(prevDate.getFullYear(), prevDate.getMonth() + 1);
  
  const currentPerf = calculatePerformanceOverview(
    currentTrades,
    initialBankroll,
    adjustments,
    currentMonthRange.start,
    currentMonthRange.end
  );
  
  const previousPerf = calculatePerformanceOverview(
    previousTrades,
    initialBankroll,
    adjustments,
    prevMonth.start,
    prevMonth.end
  );
  
  const comparisons: MonthlyComparison[] = [
    {
      kpi: 'ROI %',
      current: currentPerf.roi,
      previous: previousPerf.roi,
      change: currentPerf.roi - previousPerf.roi,
      changePercent: previousPerf.roi !== 0 ? ((currentPerf.roi - previousPerf.roi) / Math.abs(previousPerf.roi)) * 100 : 0
    },
    {
      kpi: 'Win Rate %',
      current: currentPerf.winRate,
      previous: previousPerf.winRate,
      change: currentPerf.winRate - previousPerf.winRate,
      changePercent: previousPerf.winRate !== 0 ? ((currentPerf.winRate - previousPerf.winRate) / Math.abs(previousPerf.winRate)) * 100 : 0
    },
    {
      kpi: 'Profit Factor',
      current: currentPerf.profitFactor,
      previous: previousPerf.profitFactor,
      change: currentPerf.profitFactor - previousPerf.profitFactor,
      changePercent: previousPerf.profitFactor !== 0 ? ((currentPerf.profitFactor - previousPerf.profitFactor) / Math.abs(previousPerf.profitFactor)) * 100 : 0
    },
    {
      kpi: 'Avg Profit/Trade',
      current: currentPerf.avgProfitPerTrade,
      previous: previousPerf.avgProfitPerTrade,
      change: currentPerf.avgProfitPerTrade - previousPerf.avgProfitPerTrade,
      changePercent: previousPerf.avgProfitPerTrade !== 0 ? ((currentPerf.avgProfitPerTrade - previousPerf.avgProfitPerTrade) / Math.abs(previousPerf.avgProfitPerTrade)) * 100 : 0
    }
  ];
  
  return comparisons;
};

// ==================== AUTO-GENERATE INSIGHTS ====================

export interface Insights {
  strengths: string[];
  improvements: string[];
}

export const generateInsights = (
  performance: PerformanceOverview,
  riskMetrics: RiskMetrics,
  strategyPerf: StrategyPerformance[],
  competitionPerf: CompetitionPerformance[]
): Insights => {
  const strengths: string[] = [];
  const improvements: string[] = [];
  
  // Strengths
  if (performance.winRate >= 60) {
    strengths.push(`Excellent win rate of ${performance.winRate.toFixed(1)}%`);
  } else if (performance.winRate >= 55) {
    strengths.push(`Good win rate of ${performance.winRate.toFixed(1)}%`);
  }
  
  if (performance.profitFactor >= 2.0) {
    strengths.push(`Very high Profit Factor: ${performance.profitFactor.toFixed(2)}`);
  } else if (performance.profitFactor >= 1.5) {
    strengths.push(`Positive Profit Factor: ${performance.profitFactor.toFixed(2)}`);
  }
  
  if (riskMetrics.maxDrawdownPercent < 10) {
    strengths.push(`Contained drawdown: ${riskMetrics.maxDrawdownPercent.toFixed(1)}%`);
  }
  
  const topStrategies = strategyPerf.filter(s => s.profit > 0).slice(0, 3);
  if (topStrategies.length > 0) {
    strengths.push(`Winning strategies: ${topStrategies.map(s => s.strategy).join(', ')}`);
  }
  
  if (performance.expectancy > 0) {
    strengths.push(`Positive expectancy: €${performance.expectancy.toFixed(2)} per trade`);
  }
  
  // Improvements
  if (performance.winRate < 50) {
    improvements.push(`Low win rate (${performance.winRate.toFixed(1)}%). Consider reviewing your strategies.`);
  }
  
  if (performance.profitFactor < 1.0) {
    improvements.push(`Negative Profit Factor (${performance.profitFactor.toFixed(2)}). Losses exceed gains.`);
  }
  
  if (riskMetrics.maxDrawdownPercent > 20) {
    improvements.push(`High drawdown: ${riskMetrics.maxDrawdownPercent.toFixed(1)}%. Consider reducing stake size.`);
  }
  
  const losingStrategies = strategyPerf.filter(s => s.profit < 0);
  if (losingStrategies.length > 0) {
    improvements.push(`Losing strategies: ${losingStrategies.map(s => s.strategy).join(', ')}`);
  }
  
  if (riskMetrics.maxConsecutiveLosses >= 5) {
    improvements.push(`High consecutive losses: ${riskMetrics.maxConsecutiveLosses}. Consider taking a break.`);
  }
  
  if (performance.expectancy < 0) {
    improvements.push(`Negative expectancy: €${performance.expectancy.toFixed(2)} per trade. Review your approach.`);
  }
  
  return { strengths, improvements };
};

