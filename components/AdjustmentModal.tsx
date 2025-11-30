import React, { useState } from 'react';
import { X, Save, TrendingUp, TrendingDown } from 'lucide-react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { BankrollAdjustment, AdjustmentType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({ isOpen, onClose }) => {
  const addAdjustment = useSupabaseStore((state) => state.addAdjustment);
  const [type, setType] = useState<AdjustmentType>(AdjustmentType.DEPOSIT);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const adjustment: BankrollAdjustment = {
      id: uuidv4(),
      date,
      type,
      amount: numAmount,
      notes: notes.trim() || undefined,
    };

    addAdjustment(adjustment);
    onClose();
    
    // Reset form
    setAmount('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {type === AdjustmentType.DEPOSIT ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            {type === AdjustmentType.DEPOSIT ? 'Deposit' : 'Withdrawal'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Type Selection */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-400">Operation Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType(AdjustmentType.DEPOSIT)}
                className={`p-2.5 rounded-lg border-2 transition-all ${
                  type === AdjustmentType.DEPOSIT
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-border bg-background text-gray-400 hover:border-green-500/50'
                }`}
              >
                <TrendingUp className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs font-medium">Deposit</span>
              </button>
              <button
                type="button"
                onClick={() => setType(AdjustmentType.WITHDRAWAL)}
                className={`p-2.5 rounded-lg border-2 transition-all ${
                  type === AdjustmentType.WITHDRAWAL
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-border bg-background text-gray-400 hover:border-red-500/50'
                }`}
              >
                <TrendingDown className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs font-medium">Withdrawal</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-400">Amount</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 500"
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:border-primary outline-none pr-8"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="absolute right-3 top-2.5 text-gray-500 text-sm">€</span>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-400">Date</label>
            <input
              type="date"
              required
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:border-primary outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm text-gray-400">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Extra deposit for new capital..."
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:border-primary outline-none resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Info Box */}
          <div className={`p-2.5 rounded-lg border ${
            type === AdjustmentType.DEPOSIT 
              ? 'bg-green-500/10 border-green-500/30 text-green-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <p className="text-xs">
              {type === AdjustmentType.DEPOSIT 
                ? '✓ Deposit will increase total invested capital without affecting real ROI.'
                : '⚠ Withdrawal will decrease invested capital and will be considered in ROI calculation.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors ${
                type === AdjustmentType.DEPOSIT
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Save className="w-4 h-4" />
              Save {type === AdjustmentType.DEPOSIT ? 'Deposit' : 'Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

