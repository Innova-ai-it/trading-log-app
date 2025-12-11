import React, { useMemo, useState, useEffect } from 'react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { calculateStrategyPerformance, StrategyPerformance } from '../utils/reportCalculations';
import { formatCurrency } from '../utils/helpers';
import { StrategyFormModal } from '../components/StrategyFormModal';
import { StrategyViewModal } from '../components/StrategyViewModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  TrendingUp, TrendingDown, Award, Activity, Target, AlertTriangle, 
  Info, BarChart3, Zap, DollarSign, Percent, Calculator, Plus, BookOpen, Edit, Trash2
} from 'lucide-react';

interface SavedStrategy {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

const Strategies: React.FC = () => {
  const { trades } = useSupabaseStore();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<keyof StrategyPerformance>('profit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [viewingStrategy, setViewingStrategy] = useState<SavedStrategy | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<SavedStrategy | null>(null);
  const [activeTab, setActiveTab] = useState<'performance' | 'saved'>('performance');

  // Fetch saved strategies
  useEffect(() => {
    const fetchStrategies = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_strategies')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSavedStrategies(data || []);
      } catch (error) {
        console.error('Error fetching strategies:', error);
      }
    };

    fetchStrategies();
  }, [user]);

  // Calculate strategy performance for all trades
  const strategyPerformance = useMemo(() => {
    return calculateStrategyPerformance(trades);
  }, [trades]);

  // Sort strategies
  const sortedStrategies = useMemo(() => {
    const sorted = [...strategyPerformance].sort((a, b) => {
      const aValue = a[sortBy] as number;
      const bValue = b[sortBy] as number;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
    return sorted;
  }, [strategyPerformance, sortBy, sortOrder]);

  const handleSort = (field: keyof StrategyPerformance) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getAlertBadge = (alert: StrategyPerformance['alert']) => {
    if (!alert) return null;
    
    const config = {
      LOW_SAMPLE: { 
        bgClass: 'bg-yellow-500/20', 
        textClass: 'text-yellow-400', 
        borderClass: 'border-yellow-500/30',
        text: 'Campione ridotto', 
        icon: Info 
      },
      CONSECUTIVE_LOSSES: { 
        bgClass: 'bg-red-500/20', 
        textClass: 'text-red-400', 
        borderClass: 'border-red-500/30',
        text: 'Perdite consecutive', 
        icon: AlertTriangle 
      },
      SCALE_UP: { 
        bgClass: 'bg-green-500/20', 
        textClass: 'text-green-400', 
        borderClass: 'border-green-500/30',
        text: 'Scala su', 
        icon: TrendingUp 
      }
    };
    
    const cfg = config[alert];
    const Icon = cfg.icon;
    
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${cfg.bgClass} ${cfg.textClass} border ${cfg.borderClass}`}>
        <Icon className="w-3 h-3" />
        <span>{cfg.text}</span>
      </div>
    );
  };

  const getColorClass = (value: number, isPositive: boolean = true) => {
    if (isPositive) {
      return value >= 0 ? 'text-green-400' : 'text-red-400';
    }
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const selectedStrategyData = selectedStrategy 
    ? strategyPerformance.find(s => s.strategy === selectedStrategy)
    : null;

  const handleDeleteStrategy = async (id: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('user_strategies')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSavedStrategies(prev => prev.filter(s => s.id !== id));
      setViewingStrategy(null);
    } catch (error) {
      console.error('Error deleting strategy:', error);
      alert('Errore nell\'eliminazione della strategia');
    }
  };

  const handleEditStrategy = (strategy: SavedStrategy) => {
    setEditingStrategy(strategy);
    setViewingStrategy(null);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = async () => {
    // Refresh saved strategies
    if (user) {
      const { data, error } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSavedStrategies(data);
      }
    }
    setEditingStrategy(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            Strategy Performance
          </h1>
          <p className="text-gray-400 mt-1">Analisi dettagliata delle performance per strategia</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Totale strategie: <span className="text-white font-semibold">{strategyPerformance.length}</span>
          </div>
          <button
            onClick={() => {
              setEditingStrategy(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Strategia
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'performance'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Performance Trading
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Strategie Salvate ({savedStrategies.length})
        </button>
      </div>

      {/* Saved Strategies Tab */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedStrategies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="bg-surface p-4 rounded-xl border border-border hover:border-blue-500/50 transition-colors cursor-pointer"
                  onClick={() => setViewingStrategy(strategy)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                    <div className={`px-2 py-1 rounded text-xs ${
                      strategy.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {strategy.is_active ? 'Attiva' : 'Inattiva'}
                    </div>
                  </div>
                  {strategy.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{strategy.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>v{strategy.version}</span>
                    <span>{new Date(strategy.updated_at).toLocaleDateString('it-IT')}</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStrategy(strategy);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Modifica
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStrategy(strategy.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface p-12 rounded-xl border border-border text-center">
              <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Nessuna strategia salvata</p>
              <p className="text-sm text-gray-500 mb-4">Crea la tua prima strategia per iniziare</p>
              <button
                onClick={() => {
                  setEditingStrategy(null);
                  setIsFormModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Crea Strategia
              </button>
            </div>
          )}
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Strategie Attive</p>
              <p className="text-lg font-bold text-white">{strategyPerformance.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Strategie Profittevoli</p>
              <p className="text-lg font-bold text-green-400">
                {strategyPerformance.filter(s => s.profit > 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Migliore ROI</p>
              <p className="text-lg font-bold text-white">
                {strategyPerformance.length > 0 
                  ? `${Math.max(...strategyPerformance.map(s => s.roi)).toFixed(1)}%`
                  : '-'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Migliore Profit Factor</p>
              <p className="text-lg font-bold text-white">
                {strategyPerformance.length > 0 
                  ? Math.max(...strategyPerformance.map(s => s.profitFactor)).toFixed(2)
                  : '-'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background/50 border-b border-border">
              <tr>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('strategy')}
                >
                  <div className="flex items-center gap-2">
                    Strategy
                    {sortBy === 'strategy' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('trades')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Trades
                    {sortBy === 'trades' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('winRate')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Win Rate
                    {sortBy === 'winRate' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('profit')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Profit/Loss
                    {sortBy === 'profit' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center justify-end gap-2">
                    ROI
                    {sortBy === 'roi' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('profitFactor')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Profit Factor
                    {sortBy === 'profitFactor' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('expectancy')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Expectancy
                    {sortBy === 'expectancy' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('kellyPercent')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Kelly %
                    {sortBy === 'kellyPercent' && (
                      <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-400 uppercase">
                  Alert
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStrategies.length > 0 ? (
                sortedStrategies.map((strategy, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-border/50 hover:bg-background/30 transition-colors cursor-pointer ${
                      strategy.profit >= 0 ? 'bg-green-900/5' : 'bg-red-900/5'
                    } ${selectedStrategy === strategy.strategy ? 'bg-blue-900/20' : ''}`}
                    onClick={() => setSelectedStrategy(
                      selectedStrategy === strategy.strategy ? null : strategy.strategy
                    )}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{strategy.strategy || 'N/A'}</span>
                        {strategy.alert && getAlertBadge(strategy.alert)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-300">
                      {strategy.trades}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold ${getColorClass(strategy.winRate - 50, true)}`}>
                        {strategy.winRate.toFixed(1)}%
                      </span>
                      <div className="text-xs text-gray-500">
                        {strategy.wins}W / {strategy.losses}L
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-right font-mono font-bold ${getColorClass(strategy.profit)}`}>
                      {strategy.profit >= 0 ? '+' : ''}{formatCurrency(strategy.profit)}
                    </td>
                    <td className={`px-4 py-4 text-right font-mono ${getColorClass(strategy.roi)}`}>
                      {strategy.roi >= 0 ? '+' : ''}{strategy.roi.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold ${
                        strategy.profitFactor >= 1.5 ? 'text-green-400' :
                        strategy.profitFactor >= 1 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {strategy.profitFactor >= 999 ? '∞' : strategy.profitFactor.toFixed(2)}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-mono ${getColorClass(strategy.expectancy)}`}>
                      {strategy.expectancy >= 0 ? '+' : ''}{formatCurrency(strategy.expectancy)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-semibold ${
                          strategy.kellyPercent > 0 && strategy.kellyPercent <= 25 ? 'text-green-400' :
                          strategy.kellyPercent > 25 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {strategy.kellyPercent.toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          Frac: {strategy.fractionalKelly.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {strategy.alert ? getAlertBadge(strategy.alert) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Nessuna strategia trovata. Aggiungi dei trade per vedere le performance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed View for Selected Strategy */}
      {selectedStrategyData && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Dettagli: {selectedStrategyData.strategy}
            </h2>
            <button
              onClick={() => setSelectedStrategy(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic Stats */}
            <div className="bg-background/50 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Statistiche Base</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Trades Totali:</span>
                  <span className="text-white font-semibold">{selectedStrategyData.trades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Vincite:</span>
                  <span className="text-green-400 font-semibold">{selectedStrategyData.wins}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Perdite:</span>
                  <span className="text-red-400 font-semibold">{selectedStrategyData.losses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Win Rate:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.winRate - 50)}`}>
                    {selectedStrategyData.winRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Profit Metrics */}
            <div className="bg-background/50 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Metriche Profitto</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Profit Totale:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.profit)}`}>
                    {selectedStrategyData.profit >= 0 ? '+' : ''}{formatCurrency(selectedStrategyData.profit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">ROI:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.roi)}`}>
                    {selectedStrategyData.roi >= 0 ? '+' : ''}{selectedStrategyData.roi.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Avg Win:</span>
                  <span className="text-green-400 font-semibold">
                    {formatCurrency(selectedStrategyData.avgWin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Avg Loss:</span>
                  <span className="text-red-400 font-semibold">
                    {formatCurrency(selectedStrategyData.avgLoss)}
                  </span>
                </div>
              </div>
            </div>

            {/* Advanced Metrics */}
            <div className="bg-background/50 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-400">Metriche Avanzate</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Profit Factor:</span>
                  <span className={`font-semibold ${
                    selectedStrategyData.profitFactor >= 1.5 ? 'text-green-400' :
                    selectedStrategyData.profitFactor >= 1 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {selectedStrategyData.profitFactor >= 999 ? '∞' : selectedStrategyData.profitFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Payoff Ratio:</span>
                  <span className="text-white font-semibold">
                    {selectedStrategyData.payoffRatio >= 999 ? '∞' : selectedStrategyData.payoffRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Expectancy:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.expectancy)}`}>
                    {selectedStrategyData.expectancy >= 0 ? '+' : ''}{formatCurrency(selectedStrategyData.expectancy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Max Drawdown:</span>
                  <span className="text-red-400 font-semibold">
                    {formatCurrency(selectedStrategyData.maxDrawdown)}
                  </span>
                </div>
              </div>
            </div>

            {/* Kelly Criterion */}
            <div className="bg-background/50 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Kelly Criterion</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Kelly %:</span>
                  <span className={`font-semibold ${
                    selectedStrategyData.kellyPercent > 0 && selectedStrategyData.kellyPercent <= 25 ? 'text-green-400' :
                    selectedStrategyData.kellyPercent > 25 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {selectedStrategyData.kellyPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Fractional Kelly:</span>
                  <span className="text-white font-semibold">
                    {selectedStrategyData.fractionalKelly.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Avg Stake %:</span>
                  <span className="text-white font-semibold">
                    {selectedStrategyData.avgStakePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Avg Odds:</span>
                  <span className="text-white font-semibold">
                    {selectedStrategyData.avgOdds.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawdown & Yield */}
            <div className="bg-background/50 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-400">Drawdown & Yield</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Max Drawdown:</span>
                  <span className="text-red-400 font-semibold">
                    {formatCurrency(selectedStrategyData.maxDrawdown)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Max DD %:</span>
                  <span className="text-red-400 font-semibold">
                    {selectedStrategyData.maxDrawdownPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Yield:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.yield)}`}>
                    {selectedStrategyData.yield.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Normalized Yield:</span>
                  <span className={`font-semibold ${getColorClass(selectedStrategyData.normalizedYield)}`}>
                    {selectedStrategyData.normalizedYield.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

          </>
      )}

      {/* Strategy Form Modal */}
      <StrategyFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingStrategy(null);
        }}
        onSuccess={handleFormSuccess}
        editStrategy={editingStrategy}
      />

      {/* Strategy View Modal */}
      <StrategyViewModal
        isOpen={viewingStrategy !== null}
        onClose={() => setViewingStrategy(null)}
        strategy={viewingStrategy}
        onEdit={handleEditStrategy}
        onDelete={handleDeleteStrategy}
      />
    </div>
  );
};

export default Strategies;

