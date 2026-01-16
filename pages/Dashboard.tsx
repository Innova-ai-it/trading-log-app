import React, { useMemo, useState } from 'react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, Award, Target, Ban, Calendar, PlusCircle, Trophy, Zap, AlertTriangle, Info } from 'lucide-react';
import { calculateBankrollHistory, calculateTotalCapitalInvested, formatCurrency } from '../utils/helpers';
import { TradeResult, AdjustmentType } from '../types';
import { AdjustmentModal } from '../components/AdjustmentModal';
import { calculateCurrentStreak } from '../utils/reportCalculations';

const Dashboard: React.FC = () => {
  const { trades, settings, adjustments } = useSupabaseStore();
  const initialBankroll = settings.initialBank;
  const totalCapitalInvested = useMemo(() => 
    calculateTotalCapitalInvested(initialBankroll, adjustments), 
    [initialBankroll, adjustments]
  );
  const [isAdjustmentModalOpen, setAdjustmentModalOpen] = useState(false);

  // Current Streak
  const currentStreak = useMemo(() => calculateCurrentStreak(trades), [trades]);

  const metrics = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === TradeResult.WIN).length;
    const losses = trades.filter(t => t.result === TradeResult.LOSE).length;
    const voids = trades.filter(t => t.result === TradeResult.VOID).length;
    const winRate = totalTrades > 0 ? (wins / (wins + losses)) * 100 : 0;
    
    const totalProfit = trades.reduce((sum, t) => sum + t.profitLoss, 0);
    const currentBankroll = totalCapitalInvested + totalProfit;
    // ROI corretto: basato sul capitale totale investito (inclusi depositi/prelievi)
    const roi = totalTrades > 0 && totalCapitalInvested > 0 ? (totalProfit / totalCapitalInvested) * 100 : 0;

    const sortedByProfit = [...trades].sort((a, b) => b.profitLoss - a.profitLoss);
    const bestTrade = sortedByProfit[0];
    const worstTrade = sortedByProfit[sortedByProfit.length - 1];

    // Daily Stats
    const dailyTPHits = trades.filter(t => t.tpSl === "TARGET PROFIT").length;
    const dailySLHits = trades.filter(t => t.tpSl === "STOP LOSS").length;

    // Best/Worst Day
    const dailyMap = new Map<string, number>();
    trades.forEach(t => {
      const current = dailyMap.get(t.date) || 0;
      dailyMap.set(t.date, current + t.profitLoss);
    });

    let bestDay = { date: '', profit: -Infinity };
    let worstDay = { date: '', profit: Infinity };

    dailyMap.forEach((profit, date) => {
      if (profit > bestDay.profit) bestDay = { date, profit };
      if (profit < worstDay.profit) worstDay = { date, profit };
    });

    if (dailyMap.size === 0) {
      bestDay = { date: '-', profit: 0 };
      worstDay = { date: '-', profit: 0 };
    }

    // Profit Factor: (Total Wins / Total Losses)
    const totalWinAmount = trades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLossAmount = Math.abs(trades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;

    // Average Profit per Trade
    const avgProfitPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;

    // Expectancy
    const avgWin = wins > 0 ? totalWinAmount / wins : 0;
    const avgLoss = losses > 0 ? totalLossAmount / losses : 0;
    const expectancy = totalTrades > 0 ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss : 0;

    // Consecutive Streaks
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let lastResult: TradeResult | null = null;

    [...trades].reverse().forEach(t => {
      if (t.result === TradeResult.VOID) return;
      
      if (lastResult === null || t.result === lastResult) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }

      if (t.result === TradeResult.WIN) {
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else if (t.result === TradeResult.LOSE) {
        maxLossStreak = Math.max(maxLossStreak, currentStreak);
      }
      
      lastResult = t.result;
    });

    return { 
      totalTrades, wins, losses, voids, winRate, 
      totalProfit, currentBankroll, roi, 
      bestTrade, worstTrade,
      dailyTPHits, dailySLHits,
      bestDay, worstDay,
      profitFactor, avgProfitPerTrade, expectancy,
      maxWinStreak, maxLossStreak
    };
  }, [trades, initialBankroll]);

  const bankrollHistory = useMemo(() => 
    calculateBankrollHistory(trades, initialBankroll, adjustments), 
    [trades, initialBankroll, adjustments]
  );

  // Strategy Performance
  const strategyData = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => {
      const current = map.get(t.strategy) || 0;
      map.set(t.strategy, current + t.profitLoss);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [trades]);

  // Competition Performance
  const competitionData = useMemo(() => {
    const map = new Map<string, { profit: number; count: number }>();
    trades.forEach(t => {
      if (!t.competition || t.competition.trim() === '') return;
      const current = map.get(t.competition) || { profit: 0, count: 0 };
      map.set(t.competition, { 
        profit: current.profit + t.profitLoss, 
        count: current.count + 1 
      });
    });
    
    const sorted = Array.from(map.entries())
      .map(([name, data]) => ({ 
        name, 
        profit: data.profit,
        count: data.count,
        avgProfit: data.profit / data.count
      }))
      .sort((a, b) => b.profit - a.profit);
    
    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse()
    };
  }, [trades]);

  const pieData = [
    { name: 'Win', value: metrics.wins, color: '#22c55e' },
    { name: 'Lose', value: metrics.losses, color: '#ef4444' },
    { name: 'Void', value: metrics.voids, color: '#06b6d4' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Overview of your trading performance</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setAdjustmentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-colors shadow-lg shadow-purple-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Deposit/Withdrawal
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Current Bankroll</p>
              <h3 className="text-xl md:text-2xl font-bold text-white mt-1">{formatCurrency(metrics.currentBankroll)}</h3>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500 flex-shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Invested Capital: {formatCurrency(totalCapitalInvested)}
            {adjustments.length > 0 && (
              <span className="text-xs ml-2 text-blue-400">
                ({adjustments.length} adj.)
              </span>
            )}
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Total Profit</p>
              <h3 className={`text-xl md:text-2xl font-bold mt-1 ${metrics.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {metrics.totalProfit > 0 ? '+' : ''}{formatCurrency(metrics.totalProfit)}
              </h3>
            </div>
            <div className={`p-2 rounded-lg flex-shrink-0 ${metrics.totalProfit >= 0 ? 'bg-green-500/20 text-success' : 'bg-red-500/20 text-danger'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            ROI: <span className={metrics.roi >= 0 ? 'text-success' : 'text-danger'}>{metrics.roi.toFixed(2)}%</span>
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Win Rate</p>
              <h3 className="text-xl md:text-2xl font-bold text-white mt-1">{metrics.winRate.toFixed(1)}%</h3>
            </div>
            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500 flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            {metrics.wins}W - {metrics.losses}L - {metrics.voids}V
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Targets Hit</p>
              <h3 className="text-xl md:text-2xl font-bold text-white mt-1">{metrics.dailyTPHits} TP / {metrics.dailySLHits} SL</h3>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500 flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
          </div>
           <div className="mt-4 text-sm text-gray-400">
             Avg Odds: {(trades.reduce((a, b) => a + b.odds, 0) / (trades.length || 1)).toFixed(2)}
           </div>
        </div>
      </div>

      {/* Current Streak Card */}
      <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Current Streak
          </h3>
          {currentStreak.alert && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs md:text-sm ${
              currentStreak.alert === 'OVER_CONFIDENCE' ? 'bg-yellow-500/20 text-yellow-400' :
              currentStreak.alert === 'REVENGE_TRADING' ? 'bg-red-500/20 text-red-400' :
              'bg-orange-500/20 text-orange-400'
            }`}>
              {currentStreak.alert === 'OVER_CONFIDENCE' && <AlertTriangle className="w-4 h-4" />}
              {currentStreak.alert === 'REVENGE_TRADING' && <AlertTriangle className="w-4 h-4" />}
              {currentStreak.alert === 'TILT' && <Info className="w-4 h-4" />}
              <span>
                {currentStreak.alert === 'OVER_CONFIDENCE' && 'Attenzione: Over-confidence'}
                {currentStreak.alert === 'REVENGE_TRADING' && 'Pausa consigliata'}
                {currentStreak.alert === 'TILT' && 'Possibile tilt, rallenta'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            {currentStreak.type === 'WIN' && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-success">{currentStreak.count}</p>
                  <p className="text-xs text-gray-400">Wins Consecutive</p>
                </div>
              </div>
            )}
            {currentStreak.type === 'LOSE' && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-danger">{currentStreak.count}</p>
                  <p className="text-xs text-gray-400">Losses Consecutive</p>
                </div>
              </div>
            )}
            {currentStreak.type === 'NONE' && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-gray-400">-</p>
                  <p className="text-xs text-gray-400">No streak</p>
                </div>
              </div>
            )}
          </div>
          
          {currentStreak.last10Results.length > 0 && (
            <div className="flex-1 w-full md:w-auto">
              <p className="text-xs md:text-sm text-gray-400 mb-2">Last 10 trades:</p>
              <div className="flex gap-1 flex-wrap">
                {currentStreak.last10Results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      result === 'W' ? 'bg-green-500/20 text-green-400' :
                      result === 'L' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Profit Factor</p>
              <h3 className={`text-xl md:text-2xl font-bold mt-1 ${metrics.profitFactor >= 1.5 ? 'text-success' : metrics.profitFactor >= 1 ? 'text-yellow-500' : 'text-danger'}`}>
                {metrics.profitFactor >= 999 ? '∞' : metrics.profitFactor.toFixed(2)}
              </h3>
            </div>
            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-500 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            {metrics.profitFactor >= 1.5 ? 'Excellent' : metrics.profitFactor >= 1 ? 'Good' : 'Poor'}
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Avg Profit/Trade</p>
              <h3 className={`text-xl md:text-2xl font-bold mt-1 ${metrics.avgProfitPerTrade >= 0 ? 'text-success' : 'text-danger'}`}>
                {metrics.avgProfitPerTrade >= 0 ? '+' : ''}{formatCurrency(metrics.avgProfitPerTrade)}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-500 flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Expectancy: {formatCurrency(metrics.expectancy)}
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Max Win Streak</p>
              <h3 className="text-xl md:text-2xl font-bold text-success mt-1">{metrics.maxWinStreak}</h3>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg text-green-500 flex-shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Consecutive Wins
          </div>
        </div>

        <div className="bg-surface p-4 md:p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Max Loss Streak</p>
              <h3 className="text-xl md:text-2xl font-bold text-danger mt-1">{metrics.maxLossStreak}</h3>
            </div>
            <div className="p-2 bg-red-500/20 rounded-lg text-red-500 flex-shrink-0">
              <Ban className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Consecutive Losses
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bankroll Growth */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Bankroll Evolution</h3>
          {bankrollHistory.length > 0 ? (
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bankrollHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickMargin={10} minTickGap={30} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#2d2d2d', borderColor: '#404040', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 8 }} 
                />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>

        {/* Win/Loss Distribution */}
        <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Outcome Distribution</h3>
          {pieData.length > 0 ? (
            <div className="h-[300px] w-full min-h-[300px] relative">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#2d2d2d', borderColor: '#404040', color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-white">{metrics.totalTrades}</span>
              </div>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Top Strategies */}
         <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Top Strategies by Profit</h3>
          {strategyData.length > 0 ? (
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={strategyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" hide />
                <YAxis dataKey="name" type="category" width={120} stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  cursor={{fill: '#404040', opacity: 0.2}}
                  contentStyle={{ backgroundColor: '#2d2d2d', borderColor: '#404040', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {strategyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>

        {/* Best/Worst Days */}
        <div className="bg-surface p-6 rounded-xl border border-border flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white">Extremes</h3>
          
          <div className="flex-1 bg-green-900/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-full text-green-500">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Best Day</p>
              {metrics.bestDay?.profit !== undefined ? (
                <>
                   <p className="text-lg font-bold text-white">{metrics.bestDay.date}</p>
                   <p className="text-green-400 font-mono">+{formatCurrency(metrics.bestDay.profit)}</p>
                </>
              ) : (
                <p className="text-gray-500">No data</p>
              )}
            </div>
          </div>

          <div className="flex-1 bg-red-900/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-full text-red-500">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Worst Day</p>
              {metrics.worstDay?.profit !== undefined ? (
                <>
                   <p className="text-lg font-bold text-white">{metrics.worstDay.date}</p>
                   <p className="text-red-400 font-mono">{formatCurrency(metrics.worstDay.profit)}</p>
                </>
              ) : (
                <p className="text-gray-500">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Competition Performance */}
      {competitionData.best.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Competitions */}
          <div className="bg-surface p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-white">Best Competitions</h3>
            </div>
            <div className="space-y-3">
              {competitionData.best.map((comp, idx) => (
                <div 
                  key={comp.name} 
                  className="flex justify-between items-center p-3 bg-green-900/10 border border-green-500/20 rounded-lg hover:bg-green-900/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{comp.name}</p>
                      <p className="text-xs text-gray-400">{comp.count} trades • Avg: {formatCurrency(comp.avgProfit)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400 font-mono">+{formatCurrency(comp.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Worst Competitions */}
          <div className="bg-surface p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-6">
              <Ban className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-white">Worst Competitions</h3>
            </div>
            <div className="space-y-3">
              {competitionData.worst.map((comp, idx) => (
                <div 
                  key={comp.name} 
                  className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/20 rounded-lg hover:bg-red-900/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{comp.name}</p>
                      <p className="text-xs text-gray-400">{comp.count} trades • Avg: {formatCurrency(comp.avgProfit)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-400 font-mono">{formatCurrency(comp.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Adjustments List (if any) */}
      {adjustments.length > 0 && (
        <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-4">Deposits & Withdrawals</h3>
          <div className="space-y-2">
            {adjustments.slice(0, 5).map((adj) => (
              <div 
                key={adj.id} 
                className="flex justify-between items-center p-3 bg-background/50 rounded-lg hover:bg-background transition-colors"
              >
                <div className="flex items-center gap-3">
                  {adj.type === AdjustmentType.DEPOSIT ? (
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {adj.type === AdjustmentType.DEPOSIT ? 'Deposit' : 'Withdrawal'}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(adj.date).toLocaleDateString('en-US')}</p>
                    {adj.notes && <p className="text-xs text-gray-400 mt-1">{adj.notes}</p>}
                  </div>
                </div>
                <div className={`text-lg font-bold font-mono ${
                  adj.type === AdjustmentType.DEPOSIT ? 'text-green-400' : 'text-red-400'
                }`}>
                  {adj.type === AdjustmentType.DEPOSIT ? '+' : '-'}{formatCurrency(adj.amount)}
                </div>
              </div>
            ))}
            {adjustments.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                ...and {adjustments.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      <AdjustmentModal 
        isOpen={isAdjustmentModalOpen} 
        onClose={() => setAdjustmentModalOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;