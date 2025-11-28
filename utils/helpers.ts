import { Trade, TradeResult, Settings, BankrollAdjustment, AdjustmentType } from '../types';

// Format currency
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Calculate Total Capital Invested (Initial + Deposits - Withdrawals)
export const calculateTotalCapitalInvested = (
  initialBank: number,
  adjustments: BankrollAdjustment[]
): number => {
  const adjustmentsSum = adjustments.reduce((sum, adj) => {
    if (adj.type === AdjustmentType.DEPOSIT) {
      return sum + adj.amount;
    } else if (adj.type === AdjustmentType.WITHDRAWAL) {
      return sum - adj.amount;
    }
    return sum;
  }, 0);
  
  return initialBank + adjustmentsSum;
};

// Format percentage
export const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

// Parse a number from string (handles "1.000,50", "1,50", "3.8", "1 €", "3,00%")
export const parseLocaleNumber = (stringNumber: any): number => {
  if (stringNumber === null || stringNumber === undefined) return 0;
  if (typeof stringNumber === 'number') return stringNumber;
  
  let str = stringNumber.toString().trim();
  if (!str) return 0;

  // Remove currency symbols, percentages, and spaces
  str = str.replace(/[€$£%]/g, '').trim();

  const lastCommaIndex = str.lastIndexOf(',');
  const lastDotIndex = str.lastIndexOf('.');

  if (lastCommaIndex > -1 && lastDotIndex > -1) {
    if (lastCommaIndex > lastDotIndex) {
      // European: 1.000,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,000.50
      str = str.replace(/,/g, '');
    }
  } else if (lastCommaIndex > -1) {
    // Only commas: 3,50 or 1000 (rare). Assume decimal.
    str = str.replace(',', '.');
  } 
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// Calculate Profit/Loss
export const calculateProfitLoss = (
  stake: number,
  odds: number,
  result: TradeResult
): number => {
  if (result === TradeResult.WIN) {
    return stake * (odds - 1);
  }
  if (result === TradeResult.LOSE) {
    return -stake;
  }
  return 0; // VOID or OPEN
};

// Calculate Bankroll Evolution (considering adjustments)
export const calculateBankrollHistory = (
  trades: Trade[],
  initialBankroll: number,
  adjustments: BankrollAdjustment[] = []
) => {
  // Combine trades and adjustments, sort by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sortedAdjustments = [...adjustments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let currentBalance = initialBankroll;
  const history = [{ date: 'Start', balance: initialBankroll }];

  // Merge trades and adjustments by date
  let tradeIdx = 0;
  let adjIdx = 0;
  
  while (tradeIdx < sortedTrades.length || adjIdx < sortedAdjustments.length) {
    const trade = sortedTrades[tradeIdx];
    const adjustment = sortedAdjustments[adjIdx];
    
    // Determine which comes first
    const tradeDate = trade ? new Date(trade.date).getTime() : Infinity;
    const adjDate = adjustment ? new Date(adjustment.date).getTime() : Infinity;
    
    if (tradeDate <= adjDate && trade) {
      // Process trade
      if (trade.result !== TradeResult.OPEN) {
        currentBalance += trade.profitLoss;
        history.push({
          date: new Date(trade.date).toLocaleDateString(),
          balance: currentBalance,
        });
      }
      tradeIdx++;
    } else if (adjustment) {
      // Process adjustment
      if (adjustment.type === AdjustmentType.DEPOSIT) {
        currentBalance += adjustment.amount;
      } else {
        currentBalance -= adjustment.amount;
      }
      history.push({
        date: new Date(adjustment.date).toLocaleDateString() + ' (Adj)',
        balance: currentBalance,
      });
      adjIdx++;
    }
  }

  return history;
};

// Helper: Recalculate all derived fields (Points, Daily, TP/SL)
export const recalculateTrades = (trades: Trade[], settings: Settings): Trade[] => {
  if (!trades.length) return [];

  // 1. Sort Chronologically to calculate running totals
  const chronologicalTrades = [...trades].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  // 2. Pre-calculate Start-of-Day Bankroll for every date
  // This simulates the "Compound Interest" logic where today's target is % of today's starting bankroll
  const startOfDayBankrolls = new Map<string, number>();
  let currentRunningBankroll = settings.initialBank || 1000;
  
  // Group trades by date to process them sequentially day by day
  const tradesByDate = new Map<string, Trade[]>();
  chronologicalTrades.forEach(t => {
      if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
      tradesByDate.get(t.date)!.push(t);
  });

  const sortedUniqueDates = Array.from(tradesByDate.keys()).sort();

  sortedUniqueDates.forEach(date => {
      // The bankroll at the start of this date is whatever the running bankroll is right now
      startOfDayBankrolls.set(date, currentRunningBankroll);

      // Now process all trades for this day to update the running bankroll for the NEXT day
      const daysTrades = tradesByDate.get(date) || [];
      daysTrades.forEach(t => {
          if (t.result !== TradeResult.OPEN) {
              currentRunningBankroll += (t.profitLoss || 0);
          }
      });
  });

  // 3. Compute derived fields
  const computed = chronologicalTrades.map((trade, index) => {
    // If trade is OPEN, it contributes nothing to points/daily/bankroll
    if (trade.result === TradeResult.OPEN) {
      return {
        ...trade,
        points: undefined,
        dailyPL: undefined,
        tpSl: undefined,
        profitLoss: 0,
        roi: 0
      };
    }

    // Points Formula: = (Profit / InitialBank) * 100
    // Note: 'points' is usually relative to Fixed Initial Bank, not daily, to track overall growth impact
    const points = settings.initialBank ? (trade.profitLoss / settings.initialBank) * 100 : 0;

    // Daily Profit (Running Total for that specific day up to this trade)
    const dayTrades = chronologicalTrades
      .slice(0, index + 1)
      .filter(t => t.date === trade.date && t.result !== TradeResult.OPEN);
    
    const dailyPL = dayTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    // TP/SL Check (Percentage based on Start-of-Day Bankroll)
    let tpSl = "";
    
    // Retrieve the bankroll at the start of THIS specific trade's day
    const dayStartBank = startOfDayBankrolls.get(trade.date) || settings.initialBank;
    
    // Calculate the monetary thresholds based on percentages
    // Example: Bank 1000, DailyTP 3% -> Threshold = 30
    const tpThreshold = settings.dailyTP !== 0 ? (dayStartBank * (settings.dailyTP / 100)) : 0;
    const slThreshold = settings.dailySL !== 0 ? (dayStartBank * (settings.dailySL / 100)) : 0;

    // Check thresholds
    // Logic: If DailyPL >= Calculated TP Value
    if (settings.dailyTP > 0 && tpThreshold > 0 && dailyPL >= tpThreshold) {
      tpSl = "TARGET PROFIT";
    } 
    // Logic: If DailyPL <= Calculated SL Value (assuming SL setting is negative, e.g., -5%)
    else if (settings.dailySL < 0 && slThreshold < 0 && dailyPL <= slThreshold) {
      tpSl = "STOP LOSS";
    }

    return {
      ...trade,
      points,
      dailyPL,
      tpSl
    };
  });

  // Return Newest First (Standard for UI)
  return computed.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
};