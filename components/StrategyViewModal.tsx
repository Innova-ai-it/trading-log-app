import React from 'react';
import { X, Edit, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface StrategyViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: Strategy | null;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (id: string) => void;
}

export const StrategyViewModal: React.FC<StrategyViewModalProps> = ({
  isOpen,
  onClose,
  strategy,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !strategy) return null;

  const handleDelete = () => {
    if (window.confirm(`Sei sicuro di voler eliminare la strategia "${strategy.name}"?`)) {
      onDelete?.(strategy.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-white">{strategy.name}</h2>
            {strategy.description && (
              <p className="text-sm text-gray-400 mt-1">{strategy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(strategy)}
                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                title="Modifica"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Elimina"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              className="text-white"
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-white mb-3 mt-5">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium text-blue-400 mb-2 mt-4">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-gray-300">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="text-white font-semibold">{children}</strong>
                ),
              }}
            >
              {strategy.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between items-center text-xs text-gray-500">
          <div>
            Versione: {strategy.version} | 
            Creata: {new Date(strategy.created_at).toLocaleDateString('it-IT')} | 
            Aggiornata: {new Date(strategy.updated_at).toLocaleDateString('it-IT')}
          </div>
          <div className={`px-2 py-1 rounded ${strategy.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {strategy.is_active ? 'Attiva' : 'Inattiva'}
          </div>
        </div>
      </div>
    </div>
  );
};

