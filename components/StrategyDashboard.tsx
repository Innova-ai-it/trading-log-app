import React, { useMemo, useState } from 'react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { calculateStrategyPerformance } from '../utils/reportCalculations';
import { formatCurrency, formatPercent } from '../utils/helpers';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  X, ArrowLeft, BarChart3, Target, Zap, DollarSign, Activity,
  AlertCircle, Info
} from 'lucide-react';
import { TradeResult } from '../types';

interface StrategyDashboardProps {
  onBack: () => void;
}

export const StrategyDashboard: React.FC<StrategyDashboardProps> = ({ onBack }) => {
  const { trades } = useSupabaseStore();
  const [sortBy, setSortBy] = useState<'profit' | 'roi' | 'winRate' | 'trades'>('profit');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const strategies = useMemo(() => {
    return calculateStrategyPerformance(trades);
  }, [trades]);

  const sortedStrategies = useMemo(() => {
    return [...strategies].sort((a, b) => {
      switch (sortBy) {
        case 'roi':
          return b.roi - a.roi;
        case 'winRate':
          return b.winRate - a.winRate;
        case 'trades':
          return b.trades - a.trades;
        default:
          return b.profit - a.profit;
      }
    });
  }, [strategies, sortBy]);

  const selectedStrategyData = selectedStrategy
    ? strategies.find(s => s.strategy === selectedStrategy)
    : null;

  const getAlertMessage = (alert: string | null | undefined) => {
    switch (alert) {
      case 'LOW_SAMPLE':
        return 'Dati insufficienti (<30 trade)';
      case 'CONSECUTIVE_LOSSES':
        return '⚠️ 5+ loss consecutive - PAUSA CONSIGLIATA';
      case 'SCALE_UP':
        return '✅ ROI >30% con >50 trade - SCALA UP';
      default:
        return null;
    }
  };

  const getAlertColor = (alert: string | null | undefined) => {
    switch (alert) {
      case 'LOW_SAMPLE':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'CONSECUTIVE_LOSSES':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'SCALE_UP':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return '';
    }
  };

  const getKellyStatus = (strategy: typeof strategies[0]) => {
    if (strategy.fractionalKelly === 0) return null;
    
    const ratio = strategy.avgStakePercent / strategy.fractionalKelly;
    
    if (ratio > 2) {
      return { status: 'OVER-BETTING', color: 'text-red-400', icon: AlertTriangle };
    } else if (ratio < 0.5) {
      return { status: 'UNDER-BETTING', color: 'text-yellow-400', icon: Info };
    }
    return { status: 'OPTIMAL', color: 'text-green-400', icon: CheckCircle };
  };

  if (selectedStrategyData) {
    // Detail view
    const kellyStatus = getKellyStatus(selectedStrategyData);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedStrategy(null)}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{selectedStrategyData.strategy}</h2>
            <p className="text-gray-400">Dettagli completi strategia</p>
          </div>
        </div>

        {/* Alert */}
        {selectedStrategyData.alert && (
          <div className={`p-4 rounded-lg border ${getAlertColor(selectedStrategyData.alert)}`}>
            <div className="flex items-center gap-2">
              {selectedStrategyData.alert === 'CONSECUTIVE_LOSSES' && <AlertTriangle className="w-5 h-5" />}
              {selectedStrategyData.alert === 'SCALE_UP' && <CheckCircle className="w-5 h-5" />}
              {selectedStrategyData.alert === 'LOW_SAMPLE' && <Info className="w-5 h-5" />}
              <span className="font-medium">{getAlertMessage(selectedStrategyData.alert)}</span>
            </div>
          </div>
        )}

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Win Rate</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {selectedStrategyData.winRate.toFixed(1)}%
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              {selectedStrategyData.wins}W - {selectedStrategyData.losses}L
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">ROI %</p>
            <h3 className={`text-2xl font-bold mt-1 ${
              selectedStrategyData.roi >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {selectedStrategyData.roi >= 0 ? '+' : ''}{selectedStrategyData.roi.toFixed(2)}%
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Profit: {formatCurrency(selectedStrategyData.profit)}
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Profit Factor</p>
            <h3 className={`text-2xl font-bold mt-1 ${
              selectedStrategyData.profitFactor >= 1.5 ? 'text-success' : 
              selectedStrategyData.profitFactor >= 1 ? 'text-yellow-500' : 'text-danger'
            }`}>
              {selectedStrategyData.profitFactor >= 999 ? '∞' : selectedStrategyData.profitFactor.toFixed(2)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              {selectedStrategyData.profitFactor >= 1.5 ? 'Excellent' : 
               selectedStrategyData.profitFactor >= 1 ? 'Good' : 'Poor'}
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Total Trades</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {selectedStrategyData.trades}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Sample size
            </p>
          </div>
        </div>

        {/* Extended Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Expectancy</p>
            <h3 className={`text-xl font-bold mt-1 ${
              selectedStrategyData.expectancy >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {selectedStrategyData.expectancy >= 0 ? '+' : ''}{formatCurrency(selectedStrategyData.expectancy)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">per trade</p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Avg Win</p>
            <h3 className="text-xl font-bold text-success mt-1">
              +{formatCurrency(selectedStrategyData.avgWin)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              vs Avg Loss: {formatCurrency(-selectedStrategyData.avgLoss)}
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Payoff Ratio</p>
            <h3 className="text-xl font-bold text-white mt-1">
              {selectedStrategyData.payoffRatio >= 999 ? '∞' : selectedStrategyData.payoffRatio.toFixed(2)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Avg Win / Avg Loss
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Max Drawdown</p>
            <h3 className="text-xl font-bold text-danger mt-1">
              {formatCurrency(selectedStrategyData.maxDrawdown)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              {selectedStrategyData.maxDrawdownPercent.toFixed(1)}% del peak
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Yield %</p>
            <h3 className={`text-xl font-bold mt-1 ${
              selectedStrategyData.yield >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {selectedStrategyData.yield >= 0 ? '+' : ''}{selectedStrategyData.yield.toFixed(2)}%
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Normalized: {selectedStrategyData.normalizedYield.toFixed(2)}%
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-border">
            <p className="text-sm text-gray-400">Avg Odds</p>
            <h3 className="text-xl font-bold text-white mt-1">
              {selectedStrategyData.avgOdds.toFixed(2)}
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Quota media
            </p>
          </div>
        </div>

        {/* Kelly Criterion */}
        <div className="bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Kelly Criterion & Position Sizing
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Historical Win Rate:</span>
                <span className="text-white font-medium">{selectedStrategyData.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg Odds:</span>
                <span className="text-white font-medium">{selectedStrategyData.avgOdds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Kelly Suggested:</span>
                <span className="text-green-400 font-bold">
                  {selectedStrategyData.fractionalKelly.toFixed(2)}% bankroll
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Your Avg Stake:</span>
                <span className="text-white font-medium">
                  {selectedStrategyData.avgStakePercent.toFixed(2)}% bankroll
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {kellyStatus ? (
                <div className={`p-4 rounded-lg border ${
                  kellyStatus.status === 'OVER-BETTING' ? 'bg-red-500/20 border-red-500/30' :
                  kellyStatus.status === 'UNDER-BETTING' ? 'bg-yellow-500/20 border-yellow-500/30' :
                  'bg-green-500/20 border-green-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <kellyStatus.icon className={`w-5 h-5 ${kellyStatus.color}`} />
                    <span className={`font-medium ${kellyStatus.color}`}>
                      Status: {kellyStatus.status}
                    </span>
                  </div>
                  {kellyStatus.status === 'OVER-BETTING' && (
                    <p className="text-sm text-gray-300 mt-2">
                      Stai rischiando troppo! Riduci lo stake.
                    </p>
                  )}
                  {kellyStatus.status === 'UNDER-BETTING' && (
                    <p className="text-sm text-gray-300 mt-2">
                      Stai lasciando soldi sul tavolo. Considera di aumentare lo stake.
                    </p>
                  )}
                  {kellyStatus.status === 'OPTIMAL' && (
                    <p className="text-sm text-gray-300 mt-2">
                      Position sizing ottimale! 👍
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-gray-500/30 bg-gray-500/10">
                  <p className="text-gray-400 text-sm">
                    Kelly non disponibile (edge negativo o dati insufficienti)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Strategy Performance</h1>
          <p className="text-gray-400">Analisi dettagliata per ogni strategia</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm">Sort by:</span>
        <div className="flex gap-2">
          {(['profit', 'roi', 'winRate', 'trades'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sortBy === sort
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-gray-300 hover:bg-gray-700'
              }`}
            >
              {sort === 'profit' ? 'Profit' : 
               sort === 'roi' ? 'ROI' : 
               sort === 'winRate' ? 'Win Rate' : 'Trades'}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Strategy
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Trades
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Win Rate
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  ROI %
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Profit
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  P.Factor
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Yield %
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Kelly
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Alert
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedStrategies.map((strategy) => {
                const kellyStatus = getKellyStatus(strategy);
                return (
                  <tr
                    key={strategy.strategy}
                    onClick={() => setSelectedStrategy(strategy.strategy)}
                    className="hover:bg-background/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{strategy.strategy}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                      {strategy.trades}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={strategy.winRate >= 55 ? 'text-success' : 'text-gray-300'}>
                        {strategy.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={strategy.roi >= 10 ? 'text-success' : strategy.roi >= 0 ? 'text-yellow-500' : 'text-danger'}>
                        {strategy.roi >= 0 ? '+' : ''}{strategy.roi.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={strategy.profit >= 0 ? 'text-success' : 'text-danger'}>
                        {strategy.profit >= 0 ? '+' : ''}{formatCurrency(strategy.profit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                      {strategy.profitFactor >= 999 ? '∞' : strategy.profitFactor.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                      {strategy.yield.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {strategy.fractionalKelly > 0 ? (
                        <span className={kellyStatus?.color || 'text-gray-300'}>
                          {strategy.fractionalKelly.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {strategy.alert && (
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          strategy.alert === 'CONSECUTIVE_LOSSES' ? 'bg-red-500/20 text-red-400' :
                          strategy.alert === 'LOW_SAMPLE' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {strategy.alert === 'CONSECUTIVE_LOSSES' && '⚠️'}
                          {strategy.alert === 'LOW_SAMPLE' && '📊'}
                          {strategy.alert === 'SCALE_UP' && '✅'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sortedStrategies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">Nessuna strategia trovata</p>
        </div>
      )}
    </div>
  );
};

