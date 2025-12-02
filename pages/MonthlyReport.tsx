import React, { useMemo, useState } from 'react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Activity, Target, AlertTriangle,
  Calendar, CheckCircle, XCircle, Award, BarChart3, Clock, FileText
} from 'lucide-react';
import {
  filterTradesByMonth,
  calculatePerformanceOverview,
  calculateRiskMetrics,
  calculateTradingBehavior,
  calculateStrategyPerformance,
  calculateCompetitionPerformance,
  calculateOddsRangeAnalysis,
  calculateDayOfWeekPerformance,
  calculateHourRangePerformance,
  calculateMonthlyComparison,
  generateInsights,
  getMonthRange
} from '../utils/reportCalculations';
import { formatCurrency } from '../utils/helpers';

const MonthlyReport: React.FC = () => {
  const { trades, settings, adjustments } = useSupabaseStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [nextMonthGoals, setNextMonthGoals] = useState('');

  // Filter trades for selected month
  const monthTrades = useMemo(() => 
    filterTradesByMonth(trades, selectedYear, selectedMonth),
    [trades, selectedYear, selectedMonth]
  );

  // Filter trades for previous month
  const previousMonthTrades = useMemo(() => {
    const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
    return filterTradesByMonth(trades, prevDate.getFullYear(), prevDate.getMonth() + 1);
  }, [trades, selectedYear, selectedMonth]);

  // Calculate month range
  const monthRange = useMemo(() => 
    getMonthRange(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  // Calculate all metrics
  const performance = useMemo(() =>
    calculatePerformanceOverview(
      trades,  // Pass all trades, not just monthTrades, so we can calculate currentBankroll correctly
      settings.initialBank,
      adjustments,
      monthRange.start,
      monthRange.end
    ),
    [trades, settings.initialBank, adjustments, monthRange]
  );

  const riskMetrics = useMemo(() =>
    calculateRiskMetrics(
      monthTrades,
      settings.initialBank,
      adjustments,
      monthRange.start
    ),
    [monthTrades, settings.initialBank, adjustments, monthRange]
  );

  const tradingBehavior = useMemo(() =>
    calculateTradingBehavior(monthTrades),
    [monthTrades]
  );

  const strategyPerformance = useMemo(() =>
    calculateStrategyPerformance(monthTrades),
    [monthTrades]
  );

  const competitionPerformance = useMemo(() =>
    calculateCompetitionPerformance(monthTrades),
    [monthTrades]
  );

  const oddsRangeAnalysis = useMemo(() =>
    calculateOddsRangeAnalysis(monthTrades),
    [monthTrades]
  );

  const dayOfWeekPerformance = useMemo(() =>
    calculateDayOfWeekPerformance(monthTrades),
    [monthTrades]
  );

  const hourRangePerformance = useMemo(() =>
    calculateHourRangePerformance(monthTrades),
    [monthTrades]
  );

  const monthlyComparison = useMemo(() =>
    calculateMonthlyComparison(
      monthTrades,
      previousMonthTrades,
      settings.initialBank,
      adjustments,
      selectedYear,
      selectedMonth
    ),
    [monthTrades, previousMonthTrades, settings.initialBank, adjustments, selectedYear, selectedMonth]
  );

  const insights = useMemo(() =>
    generateInsights(performance, riskMetrics, strategyPerformance, competitionPerformance),
    [performance, riskMetrics, strategyPerformance, competitionPerformance]
  );

  // Month names in English
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[selectedMonth - 1];

  // Generate years list (last 2 years + current)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Monthly Report</h1>
          <p className="text-gray-400">Detailed performance analysis</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white"
          >
            {monthNames.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-4 py-2 text-white"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SEZIONE 1: Performance Overview */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Performance Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Starting Bankroll</p>
            <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(performance.startingBankroll)}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Ending Bankroll</p>
            <h3 className={`text-2xl font-bold mt-1 ${performance.endingBankroll >= performance.startingBankroll ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(performance.endingBankroll)}
            </h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Net Profit</p>
            <h3 className={`text-2xl font-bold mt-1 ${performance.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {performance.netProfit >= 0 ? '+' : ''}{formatCurrency(performance.netProfit)}
            </h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">ROI %</p>
            <h3 className={`text-2xl font-bold mt-1 ${performance.roi >= 0 ? 'text-success' : 'text-danger'}`}>
              {performance.roi >= 0 ? '+' : ''}{performance.roi.toFixed(2)}%
            </h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Total Staked</p>
            <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(performance.totalStaked)}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Total Trades</p>
            <h3 className="text-2xl font-bold text-white mt-1">{performance.totalTrades}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Win Rate %</p>
            <h3 className="text-2xl font-bold text-white mt-1">{performance.winRate.toFixed(1)}%</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Profit Factor</p>
            <h3 className={`text-2xl font-bold mt-1 ${performance.profitFactor >= 1.5 ? 'text-success' : performance.profitFactor >= 1 ? 'text-yellow-500' : 'text-danger'}`}>
              {performance.profitFactor >= 999 ? '∞' : performance.profitFactor.toFixed(2)}
            </h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Expectancy €/trade</p>
            <h3 className={`text-2xl font-bold mt-1 ${performance.expectancy >= 0 ? 'text-success' : 'text-danger'}`}>
              {performance.expectancy >= 0 ? '+' : ''}{formatCurrency(performance.expectancy)}
            </h3>
          </div>
        </div>
      </div>

      {/* SEZIONE 2: Risk Metrics */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Risk Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className={`bg-background/50 p-4 rounded-lg border ${riskMetrics.maxDrawdownPercent > 20 ? 'border-red-500/50' : 'border-border'}`}>
            <p className="text-sm text-gray-400">Max Drawdown</p>
            <h3 className={`text-2xl font-bold mt-1 ${riskMetrics.maxDrawdownPercent > 20 ? 'text-danger' : 'text-white'}`}>
              {formatCurrency(riskMetrics.maxDrawdown)} ({riskMetrics.maxDrawdownPercent.toFixed(1)}%)
            </h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Max Consecutive Losses</p>
            <h3 className="text-2xl font-bold text-danger mt-1">{riskMetrics.maxConsecutiveLosses}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Max Consecutive Wins</p>
            <h3 className="text-2xl font-bold text-success mt-1">{riskMetrics.maxConsecutiveWins}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Avg Risk per Trade %</p>
            <h3 className="text-2xl font-bold text-white mt-1">{riskMetrics.avgRiskPerTrade.toFixed(2)}%</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Sharpe Ratio</p>
            <h3 className="text-2xl font-bold text-white mt-1">{riskMetrics.sharpeRatio.toFixed(2)}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Recovery Factor</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {riskMetrics.recoveryFactor >= 999 ? '∞' : riskMetrics.recoveryFactor.toFixed(2)}
            </h3>
          </div>
        </div>
      </div>

      {/* SEZIONE 3: Trading Behavior */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          Trading Behavior
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Total Trading Days</p>
            <h3 className="text-2xl font-bold text-white mt-1">{tradingBehavior.totalTradingDays}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Avg Trades per Day</p>
            <h3 className="text-2xl font-bold text-white mt-1">{tradingBehavior.avgTradesPerDay.toFixed(1)}</h3>
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Best Day</p>
            {tradingBehavior.bestDay ? (
              <>
                <p className="text-sm text-white font-medium mt-1">{tradingBehavior.bestDay.date}</p>
                <p className="text-success font-mono">+{formatCurrency(tradingBehavior.bestDay.profit)}</p>
              </>
            ) : (
              <p className="text-gray-500 mt-1">-</p>
            )}
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Worst Day</p>
            {tradingBehavior.worstDay ? (
              <>
                <p className="text-sm text-white font-medium mt-1">{tradingBehavior.worstDay.date}</p>
                <p className="text-danger font-mono">{formatCurrency(tradingBehavior.worstDay.profit)}</p>
              </>
            ) : (
              <p className="text-gray-500 mt-1">-</p>
            )}
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-gray-400">Profitable Days %</p>
            <h3 className="text-2xl font-bold text-white mt-1">{tradingBehavior.profitableDaysPercent.toFixed(1)}%</h3>
          </div>
        </div>
      </div>

      {/* SEZIONE 4: Strategy Performance */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Target className="w-5 h-5 text-green-500" />
          Strategy Performance
        </h2>
        {strategyPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Strategy</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Trades</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Win%</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Profit</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">ROI%</th>
                </tr>
              </thead>
              <tbody>
                {strategyPerformance.map((strategy, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-border/50 hover:bg-background/50 transition-colors ${
                      strategy.profit >= 0 ? 'bg-green-900/10' : 'bg-red-900/10'
                    }`}
                  >
                    <td className="py-3 px-4 text-white font-medium">{strategy.strategy}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{strategy.trades}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{strategy.winRate.toFixed(1)}%</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${strategy.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {strategy.profit >= 0 ? '+' : ''}{formatCurrency(strategy.profit)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${strategy.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                      {strategy.roi >= 0 ? '+' : ''}{strategy.roi.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No trades available for this month</p>
        )}
      </div>

      {/* SEZIONE 5: Competition Performance */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Competition Performance
        </h2>
        {competitionPerformance.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 3 */}
            <div>
              <h3 className="text-lg font-medium text-success mb-4">Top 3 Competitions</h3>
              <div className="space-y-3">
                {competitionPerformance.slice(0, 3).map((comp, idx) => (
                  <div
                    key={idx}
                    className="bg-green-900/10 border border-green-500/20 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-white font-medium">{comp.competition}</p>
                      <p className="text-xs text-gray-400">{comp.trades} trades • Win Rate: {comp.winRate.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-success font-mono font-bold">+{formatCurrency(comp.profit)}</p>
                      <p className="text-xs text-gray-400">ROI: {comp.roi.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Worst 3 */}
            <div>
              <h3 className="text-lg font-medium text-danger mb-4">Worst 3 Competitions</h3>
              <div className="space-y-3">
                {competitionPerformance.slice(-3).reverse().map((comp, idx) => (
                  <div
                    key={idx}
                    className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-white font-medium">{comp.competition}</p>
                      <p className="text-xs text-gray-400">{comp.trades} trades • Win Rate: {comp.winRate.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-danger font-mono font-bold">{formatCurrency(comp.profit)}</p>
                      <p className="text-xs text-gray-400">ROI: {comp.roi.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No trades available for this month</p>
        )}
      </div>

      {/* SEZIONE 6: Odds Range Analysis */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Odds Range Analysis
        </h2>
        {oddsRangeAnalysis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Range</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Trades</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Win%</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {oddsRangeAnalysis.map((range, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 hover:bg-background/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-white font-medium">{range.range}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{range.trades}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{range.winRate.toFixed(1)}%</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${range.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {range.profit >= 0 ? '+' : ''}{formatCurrency(range.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No trades available for this month</p>
        )}
      </div>

      {/* SEZIONE 7: Time Analysis */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-500" />
          Time Analysis
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day of Week */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Performance by Day of Week</h3>
            {dayOfWeekPerformance.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#2d2d2d', borderColor: '#404040', color: '#fff' }}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {dayOfWeekPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </div>
          {/* Hour Range */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Performance by Time Range</h3>
            {hourRangePerformance.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourRangePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#2d2d2d', borderColor: '#404040', color: '#fff' }}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {hourRangePerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* SEZIONE 8: Notes & Observations */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-500" />
          Notes & Observations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-4">
            <h3 className="text-lg font-medium text-success mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Strengths
            </h3>
            {insights.strengths.length > 0 ? (
              <ul className="space-y-2">
                {insights.strengths.map((strength, idx) => (
                  <li key={idx} className="text-gray-300 flex items-start gap-2">
                    <span className="text-success mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No strengths identified</p>
            )}
          </div>
          {/* Improvements */}
          <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-4">
            <h3 className="text-lg font-medium text-yellow-500 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Areas for Improvement
            </h3>
            {insights.improvements.length > 0 ? (
              <ul className="space-y-2">
                {insights.improvements.map((improvement, idx) => (
                  <li key={idx} className="text-gray-300 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No areas for improvement identified</p>
            )}
          </div>
        </div>
        {/* Next Month Goals */}
        <div className="mt-6 bg-background/50 border border-border rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Next Month Goals
          </h3>
          <textarea
            value={nextMonthGoals}
            onChange={(e) => setNextMonthGoals(e.target.value)}
            placeholder="Write your goals for next month here..."
            className="w-full bg-background border border-border rounded-lg p-3 text-white placeholder-gray-500 min-h-[100px] focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* SEZIONE 9: Comparison with Previous Month */}
      <div className="bg-surface p-6 rounded-xl border border-border">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Comparison with Previous Month
        </h2>
        {monthlyComparison.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">KPI</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Month</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Previous Month</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {monthlyComparison.map((comp, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{comp.kpi}</td>
                    <td className="py-3 px-4 text-right text-gray-300">
                      {comp.kpi.includes('€') ? formatCurrency(comp.current) : comp.current.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-300">
                      {comp.kpi.includes('€') ? formatCurrency(comp.previous) : comp.previous.toFixed(2)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      comp.change >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {comp.change >= 0 ? '+' : ''}
                      {comp.kpi.includes('€') ? formatCurrency(comp.change) : comp.change.toFixed(2)}
                      <span className="text-xs ml-2 text-gray-400">
                        ({comp.changePercent >= 0 ? '+' : ''}{comp.changePercent.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No data available for comparison</p>
        )}
      </div>
    </div>
  );
};

export default MonthlyReport;

