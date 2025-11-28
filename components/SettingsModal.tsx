import React, { useState, useEffect } from 'react';
import { X, Save, Settings as SettingsIcon } from 'lucide-react';
import { useSupabaseStore } from '../store/useSupabaseStore';
import { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, setSettings } = useSupabaseStore();
  const [formData, setFormData] = useState<Settings>(settings);

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(formData);
    onClose();
  };

  const handleChange = (field: keyof Settings, value: string) => {
    const numValue = parseFloat(value);
    setFormData(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? 0 : numValue
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Configuration
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Initial Bankroll */}
          <div className="space-y-3 border border-border p-3 rounded-lg bg-background/30">
            <h3 className="text-sm font-semibold text-green-400">Initial Bankroll</h3>
            <p className="text-[10px] text-gray-400">Enter your starting capital (if not importing CSV)</p>
            
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Starting Bankroll</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1000"
                  className="w-full bg-background border border-border rounded p-2 text-sm text-white focus:border-green-500 outline-none pr-6"
                  value={formData.initialBank}
                  onChange={(e) => handleChange('initialBank', e.target.value)}
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">€</span>
              </div>
              <p className="text-[10px] text-gray-500">Will be overwritten if CSV contains initial balance</p>
            </div>
          </div>

          {/* Daily Settings */}
          <div className="space-y-3 border border-border p-3 rounded-lg bg-background/30">
            <h3 className="text-sm font-semibold text-blue-400">Daily Targets (%)</h3>
            <p className="text-[10px] text-gray-400">Calculated on daily starting bankroll (Compound)</p>
            
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Target Profit %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3"
                  className="w-full bg-background border border-border rounded p-2 text-sm text-white focus:border-success outline-none pr-6"
                  value={formData.dailyTP}
                  onChange={(e) => handleChange('dailyTP', e.target.value)}
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">%</span>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Stop Loss %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. -5"
                  className="w-full bg-background border border-border rounded p-2 text-sm text-white focus:border-danger outline-none pr-6"
                  value={formData.dailySL}
                  onChange={(e) => handleChange('dailySL', e.target.value)}
                />
                  <span className="absolute right-2 top-2 text-gray-500 text-xs">%</span>
              </div>
              <p className="text-[10px] text-gray-500">Use negative value (e.g. -5%)</p>
            </div>
          </div>

          {/* Weekly Settings */}
          <div className="space-y-3 border border-border p-3 rounded-lg bg-background/30">
            <h3 className="text-sm font-semibold text-purple-400">Weekly Targets (%)</h3>
            <p className="text-[10px] text-gray-400">Calculated on weekly starting bankroll</p>
            
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Target Profit %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10"
                  className="w-full bg-background border border-border rounded p-2 text-sm text-white focus:border-purple-500 outline-none pr-6"
                  value={formData.weeklyTP}
                  onChange={(e) => handleChange('weeklyTP', e.target.value)}
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">%</span>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Stop Loss %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. -15"
                  className="w-full bg-background border border-border rounded p-2 text-sm text-white focus:border-danger outline-none pr-6"
                  value={formData.weeklySL}
                  onChange={(e) => handleChange('weeklySL', e.target.value)}
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">%</span>
              </div>
              <p className="text-[10px] text-gray-500">Use negative value (e.g. -15%)</p>
            </div>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3 flex-shrink-0 bg-surface">
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
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};