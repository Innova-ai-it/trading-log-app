import React, { useState, useMemo } from 'react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { 
  Plus, Upload, Search, Filter, Trash2, Edit2, 
  ChevronLeft, ChevronRight, Clock
} from 'lucide-react';
import { TradeResult, Trade } from '../types';
import { formatCurrency } from '../utils/helpers';
import { ImportModal } from '../components/ImportModal';
import { TradeModal } from '../components/TradeModal';

const TradingLog: React.FC = () => {
  const { trades, deleteTrade, clearAllTrades } = useSupabaseStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isTradeModalOpen, setTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  // Filter & Search Logic
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const matchesSearch = 
        trade.competition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.strategy.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterResult === 'ALL' || trade.result === filterResult;

      return matchesSearch && matchesFilter;
    });
  }, [trades, searchTerm, filterResult]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredTrades.length / itemsPerPage);
  const paginatedTrades = filteredTrades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setTradeModalOpen(true);
  };

  const handleAdd = () => {
    setEditingTrade(null);
    setTradeModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Log</h1>
          <p className="text-gray-400 text-sm">Manage your daily trades</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-border border border-border rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 rounded-lg text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-surface p-4 rounded-xl border border-border flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search team, competition or strategy..."
            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              className="bg-transparent text-sm text-white outline-none cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white [&>option]:py-2"
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
            >
              <option value="ALL" className="bg-gray-900 text-white">All Results</option>
              <option value={TradeResult.WIN} className="bg-gray-900 text-white">Win</option>
              <option value={TradeResult.LOSE} className="bg-gray-900 text-white">Lose</option>
              <option value={TradeResult.VOID} className="bg-gray-900 text-white">Void</option>
              <option value={TradeResult.OPEN} className="bg-gray-900 text-white">Open</option>
            </select>
          </div>
          
          {trades.length > 0 && (
            <button 
              onClick={() => { if(confirm('Are you sure you want to delete ALL trades?')) clearAllTrades(); }}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Clear All"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-background/50 text-xs uppercase text-gray-400 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Match</th>
                <th className="px-6 py-4 font-semibold">Strategy</th>
                <th className="px-6 py-4 font-semibold text-right">Points</th>
                <th className="px-6 py-4 font-semibold text-right">Daily</th>
                <th className="px-6 py-4 font-semibold text-center">TP/SL</th>
                <th className="px-6 py-4 font-semibold text-right">P/L</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>No trades found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((trade) => (
                  <tr key={trade.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                      {trade.date}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{trade.homeTeam} v {trade.awayTeam}</span>
                        <span className="text-xs text-gray-500">{trade.competition}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-border text-xs text-gray-300">
                        {trade.strategy}
                      </span>
                    </td>
                    
                    {/* Points */}
                    <td className="px-6 py-4 text-right text-gray-400 font-mono">
                      {trade.result === TradeResult.OPEN ? '-' : (trade.points?.toFixed(2) || '0.00')}
                    </td>
                    
                    {/* Daily PL */}
                    <td className={`px-6 py-4 text-right font-mono font-medium ${
                       trade.result === TradeResult.OPEN ? 'text-gray-600' :
                      (trade.dailyPL || 0) > 0 ? 'text-blue-400' : (trade.dailyPL || 0) < 0 ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {trade.result === TradeResult.OPEN ? '-' : (trade.dailyPL !== undefined ? formatCurrency(trade.dailyPL) : '-')}
                    </td>
                    
                    {/* TP/SL */}
                    <td className="px-6 py-4 text-center">
                      {trade.tpSl === "TARGET PROFIT" && (
                         <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-success border border-green-500/30">
                           TP HIT
                         </span>
                      )}
                      {trade.tpSl === "STOP LOSS" && (
                         <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-danger border border-red-500/30">
                           SL HIT
                         </span>
                      )}
                    </td>
                    
                    {/* P/L Column - Distinct look for OPEN trades */}
                    <td className={`px-6 py-4 text-right font-bold font-mono`}>
                      {trade.result === TradeResult.OPEN ? (
                         <span className="flex items-center justify-end gap-1 text-gray-500 font-normal text-xs">
                           <Clock className="w-3 h-3" /> OPEN
                         </span>
                      ) : (
                        <span className={`${trade.profitLoss > 0 ? 'text-success' : trade.profitLoss < 0 ? 'text-danger' : 'text-gray-400'}`}>
                          {trade.profitLoss > 0 ? '+' : ''}{formatCurrency(trade.profitLoss)}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(trade)}
                          className="p-1.5 hover:bg-blue-500/20 hover:text-blue-500 rounded transition-colors"
                          title={trade.result === TradeResult.OPEN ? "Set Result" : "Edit Trade"}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteTrade(trade.id)}
                          className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-background/50 border-t border-border">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-border rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages}
                 className="p-2 border border-border rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} />
      <TradeModal 
        isOpen={isTradeModalOpen} 
        onClose={() => setTradeModalOpen(false)} 
        editTrade={editingTrade} 
      />
    </div>
  );
};

export default TradingLog;