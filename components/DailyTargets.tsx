import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { TradeResult } from '../types';
import { formatCurrency } from '../utils/helpers';

export const DailyTargets: React.FC = () => {
  const { trades, settings } = useSupabaseStore();

  const dailyStats = useMemo(() => {
    // Get today's date in the same format as trades
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's trades (excluding OPEN)
    const todayTrades = trades.filter(
      t => t.date === today && t.result !== TradeResult.OPEN
    );

    // Calculate today's P/L
    const todayPL = todayTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

    // Calculate start-of-day bankroll
    // This is the bankroll before any of today's trades
    const tradesBeforeToday = trades
      .filter(t => {
        const tradeDate = new Date(t.date).getTime();
        const todayTime = new Date(today).getTime();
        return tradeDate < todayTime && t.result !== TradeResult.OPEN;
      });
    
    const plBeforeToday = tradesBeforeToday.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const startOfDayBankroll = (settings.initialBank || 1000) + plBeforeToday;
    const currentBankroll = startOfDayBankroll + todayPL;

    // Calculate targets in euros
    const tpTarget = (startOfDayBankroll * (settings.dailyTP / 100));
    const slTarget = (startOfDayBankroll * (settings.dailySL / 100));

    // Calculate remaining amounts
    const tpRemaining = tpTarget - todayPL;
    const slRemaining = slTarget - todayPL;

    // Check if targets are hit
    const tpHit = settings.dailyTP > 0 && todayPL >= tpTarget;
    const slHit = settings.dailySL < 0 && todayPL <= slTarget;

    return {
      startOfDayBankroll,
      currentBankroll,
      todayPL,
      tpTarget,
      slTarget,
      tpRemaining,
      slRemaining,
      tpHit,
      slHit,
      tpPercentage: settings.dailyTP,
      slPercentage: settings.dailySL
    };
  }, [trades, settings]);

  // Don't show if no targets are set
  if (dailyStats.tpPercentage === 0 && dailyStats.slPercentage === 0) {
    return null;
  }

  return (
    <div className="flex gap-3 items-center">
      {/* Daily Take Profit */}
      {dailyStats.tpPercentage > 0 && (
        <div className={`relative px-4 py-2 rounded-lg border transition-all ${
          dailyStats.tpHit 
            ? 'bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/20' 
            : 'bg-surface border-border'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${
              dailyStats.tpHit ? 'bg-green-500/30' : 'bg-green-500/10'
            }`}>
              <TrendingUp className={`w-4 h-4 ${
                dailyStats.tpHit ? 'text-green-400' : 'text-green-500'
              }`} />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-medium">
                Daily Take Profit
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-bold font-mono ${
                  dailyStats.tpHit ? 'text-green-400' : 'text-white'
                }`}>
                  {formatCurrency(dailyStats.tpTarget)}
                </span>
                {!dailyStats.tpHit ? (
                  <span className="text-[10px] text-gray-500">
                    ({formatCurrency(dailyStats.tpRemaining)} to go)
                  </span>
                ) : (
                  <span className="text-[10px] text-green-400 font-semibold">
                    ✓ HIT
                  </span>
                )}
              </div>
            </div>
          </div>
          {dailyStats.tpHit && (
            <div className="absolute inset-0 rounded-lg bg-green-500/10 animate-pulse pointer-events-none"></div>
          )}
        </div>
      )}

      {/* Daily Stop Loss */}
      {dailyStats.slPercentage < 0 && (
        <div className={`relative px-4 py-2 rounded-lg border transition-all ${
          dailyStats.slHit 
            ? 'bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/20' 
            : 'bg-surface border-border'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${
              dailyStats.slHit ? 'bg-red-500/30' : 'bg-red-500/10'
            }`}>
              <TrendingDown className={`w-4 h-4 ${
                dailyStats.slHit ? 'text-red-400' : 'text-red-500'
              }`} />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-medium">
                Daily Stop Loss
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-bold font-mono ${
                  dailyStats.slHit ? 'text-red-400' : 'text-white'
                }`}>
                  {formatCurrency(dailyStats.slTarget)}
                </span>
                {!dailyStats.slHit ? (
                  <span className="text-[10px] text-gray-500">
                    ({formatCurrency(Math.abs(dailyStats.slRemaining))} buffer)
                  </span>
                ) : (
                  <span className="text-[10px] text-red-400 font-semibold">
                    ✓ HIT
                  </span>
                )}
              </div>
            </div>
          </div>
          {dailyStats.slHit && (
            <div className="absolute inset-0 rounded-lg bg-red-500/10 animate-pulse pointer-events-none"></div>
          )}
        </div>
      )}

      {/* Current Day P/L indicator */}
      <div className="px-3 py-2 rounded-lg bg-background border border-border">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-medium">
              Today P/L
            </div>
            <span className={`text-sm font-bold font-mono ${
              dailyStats.todayPL > 0 ? 'text-success' : 
              dailyStats.todayPL < 0 ? 'text-danger' : 
              'text-gray-400'
            }`}>
              {dailyStats.todayPL > 0 ? '+' : ''}{formatCurrency(dailyStats.todayPL)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

