import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, Award, Target, Ban, Calendar } from 'lucide-react';
import { calculateBankrollHistory, formatCurrency } from '../utils/helpers';
import { TradeResult } from '../types';

const Dashboard: React.FC = () => {
  const { trades, settings } = useStore();
  const initialBankroll = settings.initialBank;

  const metrics = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === TradeResult.WIN).length;
    const losses = trades.filter(t => t.result === TradeResult.LOSE).length;
    const voids = trades.filter(t => t.result === TradeResult.VOID).length;
    const winRate = totalTrades > 0 ? (wins / (wins + losses)) * 100 : 0;
    
    const totalProfit = trades.reduce((sum, t) => sum + t.profitLoss, 0);
    const currentBankroll = initialBankroll + totalProfit;
    const roi = totalTrades > 0 ? (totalProfit / initialBankroll) * 100 : 0;

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

    return { 
      totalTrades, wins, losses, voids, winRate, 
      totalProfit, currentBankroll, roi, 
      bestTrade, worstTrade,
      dailyTPHits, dailySLHits,
      bestDay, worstDay
    };
  }, [trades, initialBankroll]);

  const bankrollHistory = useMemo(() => calculateBankrollHistory(trades, initialBankroll), [trades, initialBankroll]);

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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Current Bankroll</p>
              <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(metrics.currentBankroll)}</h3>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Started: {formatCurrency(initialBankroll)}
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Total Profit</p>
              <h3 className={`text-2xl font-bold mt-1 ${metrics.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {metrics.totalProfit > 0 ? '+' : ''}{formatCurrency(metrics.totalProfit)}
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${metrics.totalProfit >= 0 ? 'bg-green-500/20 text-success' : 'bg-red-500/20 text-danger'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            ROI: <span className={metrics.roi >= 0 ? 'text-success' : 'text-danger'}>{metrics.roi.toFixed(2)}%</span>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Win Rate</p>
              <h3 className="text-2xl font-bold text-white mt-1">{metrics.winRate.toFixed(1)}%</h3>
            </div>
            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            {metrics.wins}W - {metrics.losses}L - {metrics.voids}V
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400">Targets Hit</p>
              <h3 className="text-2xl font-bold text-white mt-1">{metrics.dailyTPHits} TP / {metrics.dailySLHits} SL</h3>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500">
              <Target className="w-5 h-5" />
            </div>
          </div>
           <div className="mt-4 text-sm text-gray-400">
             Avg Odds: {(trades.reduce((a, b) => a + b.odds, 0) / (trades.length || 1)).toFixed(2)}
           </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bankroll Growth */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Bankroll Evolution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
        </div>

        {/* Win/Loss Distribution */}
        <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Outcome Distribution</h3>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Top Strategies */}
         <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-6">Top Strategies by Profit</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
        </div>

        {/* Best/Worst */}
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
    </div>
  );
};

export default Dashboard;