import React, { useState, useEffect } from 'react';
import { X, Save, Calculator } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeResult } from '../types';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { calculateProfitLoss } from '../utils/helpers';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTrade?: Trade | null;
}

const emptyTrade: Partial<Trade> = {
  date: new Date().toISOString().split('T')[0],
  competition: '',
  homeTeam: '',
  awayTeam: '',
  strategy: '',
  odds: 2.00,
  stakePercent: 1.0,
  stakeEuro: 0,
  position: '',
  result: TradeResult.OPEN,
  profitLoss: 0,
  notes: ''
};

export const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, editTrade }) => {
  const [formData, setFormData] = useState<Partial<Trade>>(emptyTrade);
  const { addTrade, updateTrade, settings } = useSupabaseStore();
  const initialBankroll = settings.initialBank;
  const [isManualPL, setIsManualPL] = useState(false);

  useEffect(() => {
    if (editTrade) {
      setFormData(editTrade);
      // If editing a closed trade, assume P/L is set. We don't enable manual flag by default
      // to allow auto-recalc if they change odds, unless they specifically touch the P/L input.
      setIsManualPL(false);
    } else {
      setFormData({
        ...emptyTrade,
        date: new Date().toISOString().split('T')[0]
      });
      setIsManualPL(false);
    }
  }, [editTrade, isOpen]);

  // Phase 1: Auto-calc stake € based on %
  useEffect(() => {
    if (formData.stakePercent && initialBankroll) {
      const calculatedStake = (initialBankroll * formData.stakePercent) / 100;
      setFormData(prev => ({ ...prev, stakeEuro: calculatedStake }));
    }
  }, [formData.stakePercent, initialBankroll]);

  // Phase 2: Auto-calc P/L based on Result, Odds, Stake
  // Only runs if the user hasn't manually edited the P/L field recently OR if they just changed the result type
  useEffect(() => {
    // If result is OPEN, P/L is 0
    if (formData.result === TradeResult.OPEN) {
      setFormData(prev => ({ ...prev, profitLoss: 0, roi: 0 }));
      return;
    }

    // If manual mode is OFF, calculate automatically
    if (!isManualPL && formData.stakeEuro && formData.odds && formData.result) {
      const pl = calculateProfitLoss(formData.stakeEuro, formData.odds, formData.result);
      const roi = formData.stakeEuro > 0 ? (pl / formData.stakeEuro) * 100 : 0;
      setFormData(prev => ({ ...prev, profitLoss: pl, roi }));
    }
  }, [formData.stakeEuro, formData.odds, formData.result, isManualPL]);

  // Recalculate ROI whenever P/L changes (manually or automatically)
  useEffect(() => {
     if (formData.result !== TradeResult.OPEN && formData.stakeEuro && formData.profitLoss !== undefined) {
        const roi = formData.stakeEuro > 0 ? (formData.profitLoss / formData.stakeEuro) * 100 : 0;
        // Only update ROI if it's different to avoid loops
        setFormData(prev => (prev.roi !== roi ? { ...prev, roi } : prev));
     }
  }, [formData.profitLoss, formData.stakeEuro]);


  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation before save
    const finalTrade = {
      ...formData,
      // Ensure P/L is 0 if Open
      profitLoss: formData.result === TradeResult.OPEN ? 0 : formData.profitLoss,
      roi: formData.result === TradeResult.OPEN ? 0 : formData.roi,
    };

    if (editTrade) {
      updateTrade(editTrade.id, finalTrade);
    } else {
      addTrade({
        ...finalTrade,
        id: uuidv4(),
        matchedParts: 100, // Default
      } as Trade);
    }
    onClose();
  };

  const handleChange = (field: keyof Trade, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleManualPLChange = (value: string) => {
    setIsManualPL(true);
    const num = parseFloat(value);
    setFormData(prev => ({ ...prev, profitLoss: isNaN(num) ? 0 : num }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold text-white">
            {editTrade ? 'Edit Trade' : 'Add New Trade'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* PHASE 1: DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Date *</label>
              <input
                type="date"
                required
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </div>

            {/* Competition */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Competition *</label>
              <input
                type="text"
                required
                placeholder="e.g. Premier League"
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.competition}
                onChange={(e) => handleChange('competition', e.target.value)}
              />
            </div>

            {/* Home Team */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Home Team *</label>
              <input
                type="text"
                required
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.homeTeam}
                onChange={(e) => handleChange('homeTeam', e.target.value)}
              />
            </div>

            {/* Away Team */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Away Team *</label>
              <input
                type="text"
                required
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.awayTeam}
                onChange={(e) => handleChange('awayTeam', e.target.value)}
              />
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Strategy *</label>
              <input
                type="text"
                required
                placeholder="e.g. Over 2.5"
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.strategy}
                onChange={(e) => handleChange('strategy', e.target.value)}
              />
            </div>

            {/* Odds */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Odds *</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.odds}
                onChange={(e) => handleChange('odds', parseFloat(e.target.value))}
              />
            </div>

            {/* Stake % */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Stake % *</label>
              <input
                type="number"
                step="0.1"
                required
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none"
                value={formData.stakePercent}
                onChange={(e) => handleChange('stakePercent', parseFloat(e.target.value))}
              />
            </div>

            {/* Stake € (Read Only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Stake €</label>
              <div className="w-full bg-background/50 border border-border rounded-lg p-2.5 text-gray-400">
                {formData.stakeEuro?.toFixed(2)} €
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 border-t border-border my-2"></div>

            {/* PHASE 2: RESULT & PL */}
            
            {/* Result */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Result</label>
              <select
                className={`w-full border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none
                  ${formData.result === TradeResult.WIN ? 'bg-green-900/30 border-green-500/50' : 
                    formData.result === TradeResult.LOSE ? 'bg-red-900/30 border-red-500/50' : 
                    'bg-background'}`}
                value={formData.result}
                onChange={(e) => {
                  setIsManualPL(false); // Reset manual flag to allow auto-calc for new result
                  handleChange('result', e.target.value as TradeResult);
                }}
              >
                <option value={TradeResult.OPEN}>OPEN (Pending)</option>
                <option value={TradeResult.WIN}>WIN</option>
                <option value={TradeResult.LOSE}>LOSE</option>
                <option value={TradeResult.VOID}>VOID</option>
              </select>
            </div>

            {/* Profit / Loss (Editable) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex justify-between">
                <span>Profit / Loss</span>
                {isManualPL && (
                  <button 
                    type="button" 
                    onClick={() => setIsManualPL(false)} // This will trigger the useEffect to auto-calc
                    className="text-xs text-primary hover:text-blue-300 flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" /> Auto-calc
                  </button>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                disabled={formData.result === TradeResult.OPEN}
                className={`w-full border border-border rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-primary
                  ${formData.result === TradeResult.OPEN ? 'bg-background/50 text-gray-500 cursor-not-allowed' : 'bg-background text-white'}
                  ${(formData.profitLoss || 0) > 0 ? 'text-success' : (formData.profitLoss || 0) < 0 ? 'text-danger' : ''}
                `}
                value={formData.profitLoss}
                onChange={(e) => handleManualPLChange(e.target.value)}
              />
            </div>
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Notes</label>
            <textarea
              rows={3}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none resize-none"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
             <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {editTrade ? 'Update Trade' : 'Save Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};