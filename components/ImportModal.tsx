import React, { useState } from 'react';
import { Upload, X, AlertCircle, FileText, Check, AlertTriangle } from 'lucide-react';
import { parseCSV, parseXML } from '../utils/parsers';
import { useStore } from '../store/useStore';
import { Trade } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const importTrades = useStore((state) => state.importTrades);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setWarning(null);
    setPreviewData([]);
    setIsProcessing(true);

    try {
      let data: Trade[] = [];
      if (selectedFile.name.toLowerCase().endsWith('.csv')) {
        data = await parseCSV(selectedFile);
      } else if (selectedFile.name.toLowerCase().endsWith('.xml')) {
        data = await parseXML(selectedFile);
      } else {
        throw new Error('Unsupported file format. Please use CSV or XML.');
      }

      if (data.length === 0) {
        setWarning('No valid trades found. Please check if the file format matches the columns or if the file is empty.');
      } else {
        setPreviewData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error parsing file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (previewData.length > 0) {
      importTrades(previewData);
      onClose();
      // Reset state
      setFile(null);
      setPreviewData([]);
      setWarning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Trades
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Input */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors bg-background/50">
            <input 
              type="file" 
              accept=".csv,.xml" 
              onChange={handleFileChange}
              className="hidden" 
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <FileText className="w-12 h-12 text-gray-500 mb-4" />
              <span className="text-lg font-medium text-white mb-1">
                {file ? file.name : "Click to upload CSV or XML"}
              </span>
              <span className="text-sm text-gray-400">
                Max file size: 5MB
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {warning && (
            <div className="bg-yellow-900/20 border border-yellow-500/50 text-yellow-200 p-4 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {warning}
            </div>
          )}

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-medium">Preview ({previewData.length} trades found)</h3>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left text-gray-400">
                  <thead className="bg-background text-xs uppercase text-gray-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Competition</th>
                      <th className="px-4 py-3">Match</th>
                      <th className="px-4 py-3">Strategy</th>
                      <th className="px-4 py-3 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {previewData.slice(0, 5).map((trade) => (
                      <tr key={trade.id} className="hover:bg-background/50">
                        <td className="px-4 py-3">{trade.date}</td>
                        <td className="px-4 py-3">{trade.competition || '-'}</td>
                        <td className="px-4 py-3">{trade.homeTeam} {trade.awayTeam ? 'vs ' + trade.awayTeam : ''}</td>
                        <td className="px-4 py-3">{trade.strategy || '-'}</td>
                        <td className={`px-4 py-3 text-right font-mono ${trade.profitLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                          {trade.profitLoss.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 5 && (
                  <div className="p-3 text-center text-xs text-gray-500 bg-surface border-t border-border">
                    ...and {previewData.length - 5} more rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-surface flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={previewData.length === 0}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
};
