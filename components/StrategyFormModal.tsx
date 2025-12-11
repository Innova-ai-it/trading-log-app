import React, { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StrategyFormData {
  name: string;
  description: string;
  entryConditions: {
    odds: {
      optimalRange: string;
      preferredRange: string;
      avoidRange: string;
    };
    preMatch: {
      teamsStats: string;
      preferredCompetitions: string;
      avoidConditions: string;
    };
    live: {
      minuteRange: string;
      scoreMatch: string;
      liveStats1: string;
      liveStats2: string;
      avoidConditions: string;
    };
  };
  exitConditions: {
    exit1: string;
    exit2: string;
    exit3: string;
  };
  riskManagement: {
    stake: string;
    splitStaking: string;
    takeProfit: string;
    stopLoss: string;
  };
  notes: string;
}

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

interface StrategyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editStrategy?: Strategy | null;
}

const emptyFormData: StrategyFormData = {
  name: '',
  description: '',
  entryConditions: {
    odds: {
      optimalRange: '',
      preferredRange: '',
      avoidRange: '',
    },
    preMatch: {
      teamsStats: '',
      preferredCompetitions: '',
      avoidConditions: '',
    },
    live: {
      minuteRange: '',
      scoreMatch: '',
      liveStats1: '',
      liveStats2: '',
      avoidConditions: '',
    },
  },
  exitConditions: {
    exit1: '',
    exit2: '',
    exit3: '',
  },
  riskManagement: {
    stake: '',
    splitStaking: '',
    takeProfit: '',
    stopLoss: '',
  },
  notes: '',
};

export const StrategyFormModal: React.FC<StrategyFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  editStrategy
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<StrategyFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse markdown content to form data when editing
  React.useEffect(() => {
    if (editStrategy && isOpen) {
      // Parse the markdown content to extract form data
      const content = editStrategy.content;
      const lines = content.split('\n');
      
      // Extract name
      const nameMatch = content.match(/# Strategia: (.+)/);
      if (nameMatch) {
        setFormData(prev => ({ ...prev, name: nameMatch[1].trim() }));
      }

      // Extract description
      const descMatch = content.match(/## Descrizione\n([\s\S]*?)(?=\n##|$)/);
      if (descMatch) {
        setFormData(prev => ({ ...prev, description: descMatch[1].trim() }));
      }

      // Extract entry conditions - odds
      const oddsMatch = content.match(/### Quote\n([\s\S]*?)(?=\n###|##|$)/);
      if (oddsMatch) {
        const oddsText = oddsMatch[1];
        const optimalRange = oddsText.match(/- \*\*Range ottimale:\*\* (.+)/)?.[1]?.trim() || 
                            oddsText.match(/Range ottimale: (.+)/)?.[1]?.trim() || '';
        const preferredRange = oddsText.match(/- \*\*Quote preferita:\*\* (.+)/)?.[1]?.trim() || 
                               oddsText.match(/Quote preferita: (.+)/)?.[1]?.trim() || '';
        const avoidRange = oddsText.match(/- \*\*Evitare quote:\*\* (.+)/)?.[1]?.trim() || 
                          oddsText.match(/Evitare quote: (.+)/)?.[1]?.trim() || '';
        setFormData(prev => ({
          ...prev,
          entryConditions: {
            ...prev.entryConditions,
            odds: { optimalRange, preferredRange, avoidRange }
          }
        }));
      }

      // Extract pre-match
      const preMatchMatch = content.match(/### Statistiche Pre-Match\n([\s\S]*?)(?=\n###|##|$)/);
      if (preMatchMatch) {
        const preMatchText = preMatchMatch[1];
        const teamsStats = preMatchText.split('\n').filter(l => 
          !l.includes('Competizioni preferite:') && 
          !l.includes('Evitare:') && 
          !l.startsWith('- **') &&
          !l.trim().startsWith('*')
        ).join('\n').trim();
        const preferredCompetitions = preMatchText.match(/- \*\*Competizioni preferite:\*\* (.+)/)?.[1]?.trim() || 
                                     preMatchText.match(/Competizioni preferite: (.+)/)?.[1]?.trim() || '';
        const avoidConditions = preMatchText.match(/- \*\*Evitare:\*\* (.+)/)?.[1]?.trim() || 
                               preMatchText.match(/Evitare: (.+)/)?.[1]?.trim() || '';
        setFormData(prev => ({
          ...prev,
          entryConditions: {
            ...prev.entryConditions,
            preMatch: { teamsStats, preferredCompetitions, avoidConditions }
          }
        }));
      }

      // Extract live stats
      const liveMatch = content.match(/### Statistiche Live\n([\s\S]*?)(?=\n##|$)/);
      if (liveMatch) {
        const liveText = liveMatch[1];
        const minuteRange = liveText.match(/- \*\*Minuto ingresso:\*\* (.+)/)?.[1]?.trim() || 
                           liveText.match(/Minuto ingresso: (.+)/)?.[1]?.trim() || '';
        const scoreMatch = liveText.match(/- \*\*Score match:\*\* (.+)/)?.[1]?.trim() || 
                          liveText.match(/Score match: (.+)/)?.[1]?.trim() || '';
        const liveStats1 = liveText.match(/- \*\*Statistiche Live 1:\*\* (.+)/)?.[1]?.trim() || 
                          liveText.match(/Statistiche Live 1: (.+)/)?.[1]?.trim() || '';
        const liveStats2 = liveText.match(/- \*\*Statistiche Live 2:\*\* (.+)/)?.[1]?.trim() || 
                          liveText.match(/Statistiche Live 2: (.+)/)?.[1]?.trim() || '';
        const avoidConditions = liveText.match(/- \*\*Evitare:\*\* (.+)/)?.[1]?.trim() || 
                               liveText.match(/Evitare: (.+)/)?.[1]?.trim() || '';
        setFormData(prev => ({
          ...prev,
          entryConditions: {
            ...prev.entryConditions,
            live: { minuteRange, scoreMatch, liveStats1, liveStats2, avoidConditions }
          }
        }));
      }

      // Extract exit conditions
      const exitMatch = content.match(/## Condizioni Exit\n([\s\S]*?)(?=\n##|$)/);
      if (exitMatch) {
        const exitText = exitMatch[1];
        const exit1 = exitText.match(/- \*\*Exit 1 \(Profitto\):\*\* (.+)/)?.[1]?.trim() || 
                     exitText.match(/Exit 1 \(Profitto\): (.+)/)?.[1]?.trim() || '';
        const exit2 = exitText.match(/- \*\*Exit 2 \(Stop Loss\):\*\* (.+)/)?.[1]?.trim() || 
                     exitText.match(/Exit 2 \(Stop Loss\): (.+)/)?.[1]?.trim() || '';
        const exit3 = exitText.match(/- \*\*Exit 3 \(Tempo\/Fine Mercato\):\*\* (.+)/)?.[1]?.trim() || 
                     exitText.match(/Exit 3 \(Tempo\/Fine Mercato\): (.+)/)?.[1]?.trim() || '';
        setFormData(prev => ({
          ...prev,
          exitConditions: { exit1, exit2, exit3 }
        }));
      }

      // Extract risk management
      const riskMatch = content.match(/## Gestione Rischio\n([\s\S]*?)(?=\n##|$)/);
      if (riskMatch) {
        const riskText = riskMatch[1];
        const stake = riskText.match(/- \*\*Stake:\*\* (.+)/)?.[1]?.trim() || 
                     riskText.match(/Stake: (.+)/)?.[1]?.trim() || '';
        const splitStaking = riskText.match(/- \*\*Split staking:\*\* (.+)/)?.[1]?.trim() || 
                            riskText.match(/Split staking: (.+)/)?.[1]?.trim() || '';
        const takeProfit = riskText.match(/- \*\*Take Profit:\*\* (.+)/)?.[1]?.trim() || 
                          riskText.match(/Take Profit: (.+)/)?.[1]?.trim() || '';
        const stopLoss = riskText.match(/- \*\*Stop Loss:\*\* (.+)/)?.[1]?.trim() || 
                        riskText.match(/Stop Loss: (.+)/)?.[1]?.trim() || '';
        setFormData(prev => ({
          ...prev,
          riskManagement: { stake, splitStaking, takeProfit, stopLoss }
        }));
      }

      // Extract notes
      const notesMatch = content.match(/## Note\n([\s\S]*?)(?=\n##|$)/);
      if (notesMatch) {
        setFormData(prev => ({ ...prev, notes: notesMatch[1].trim() }));
      }
    } else if (!editStrategy && isOpen) {
      // Reset form when opening for new strategy
      setFormData(emptyFormData);
    }
  }, [editStrategy, isOpen]);

  const handleChange = (path: string, value: string) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newData = { ...prev };
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const generateMarkdown = (data: StrategyFormData): string => {
    return `# Strategia: ${data.name}

## Descrizione
${data.description}

## Condizioni Entry

### Quote
- **Range ottimale:** ${data.entryConditions.odds.optimalRange || 'Non specificato'}
- **Quote preferita:** ${data.entryConditions.odds.preferredRange || 'Non specificato'}
- **Evitare quote:** ${data.entryConditions.odds.avoidRange || 'Non specificato'}

### Statistiche Pre-Match
${data.entryConditions.preMatch.teamsStats || 'Non specificato'}

- **Competizioni preferite:** ${data.entryConditions.preMatch.preferredCompetitions || 'Non specificato'}
- **Evitare:** ${data.entryConditions.preMatch.avoidConditions || 'Non specificato'}

### Statistiche Live
- **Minuto ingresso:** ${data.entryConditions.live.minuteRange || 'Non specificato'}
- **Score match:** ${data.entryConditions.live.scoreMatch || 'Non specificato'}
- **Statistiche Live 1:** ${data.entryConditions.live.liveStats1 || 'Non specificato'}
- **Statistiche Live 2:** ${data.entryConditions.live.liveStats2 || 'Non specificato'}
- **Evitare:** ${data.entryConditions.live.avoidConditions || 'Non specificato'}

## Condizioni Exit
- **Exit 1 (Profitto):** ${data.exitConditions.exit1 || 'Non specificato'}
- **Exit 2 (Stop Loss):** ${data.exitConditions.exit2 || 'Non specificato'}
- **Exit 3 (Tempo/Fine Mercato):** ${data.exitConditions.exit3 || 'Non specificato'}

## Gestione Rischio
- **Stake:** ${data.riskManagement.stake || 'Non specificato'}
- **Split staking:** ${data.riskManagement.splitStaking || 'Non specificato'}
- **Take Profit:** ${data.riskManagement.takeProfit || 'Non specificato'}
- **Stop Loss:** ${data.riskManagement.stopLoss || 'Non specificato'}

## Note
${data.notes || 'Nessuna nota aggiuntiva.'}`;
  };

  const generateStructuredData = (data: StrategyFormData) => {
    return {
      name: data.name,
      description: data.description,
      entryConditions: {
        odds: {
          optimalRange: data.entryConditions.odds.optimalRange || null,
          preferredRange: data.entryConditions.odds.preferredRange || null,
          avoidRange: data.entryConditions.odds.avoidRange || null,
        },
        preMatch: {
          teamsStats: data.entryConditions.preMatch.teamsStats || null,
          preferredCompetitions: data.entryConditions.preMatch.preferredCompetitions || null,
          avoidConditions: data.entryConditions.preMatch.avoidConditions || null,
        },
        live: {
          minuteRange: data.entryConditions.live.minuteRange || null,
          scoreMatch: data.entryConditions.live.scoreMatch || null,
          liveStats1: data.entryConditions.live.liveStats1 || null,
          liveStats2: data.entryConditions.live.liveStats2 || null,
          avoidConditions: data.entryConditions.live.avoidConditions || null,
        },
      },
      exitConditions: {
        exit1: data.exitConditions.exit1 || null,
        exit2: data.exitConditions.exit2 || null,
        exit3: data.exitConditions.exit3 || null,
      },
      riskManagement: {
        stake: data.riskManagement.stake || null,
        splitStaking: data.riskManagement.splitStaking || null,
        takeProfit: data.riskManagement.takeProfit || null,
        stopLoss: data.riskManagement.stopLoss || null,
      },
      notes: data.notes || null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Devi essere autenticato per salvare una strategia');
      return;
    }

    if (!formData.name.trim()) {
      setError('Il nome della strategia è obbligatorio');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const markdownContent = generateMarkdown(formData);
      const structuredData = generateStructuredData(formData);
      
      if (editStrategy) {
        // Update existing strategy
        const { error: updateError } = await supabase
          .from('user_strategies')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            content: markdownContent,
            structured_data: structuredData,
            version: editStrategy.version + 1,
          })
          .eq('id', editStrategy.id)
          .eq('user_id', user.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Insert new strategy
        const { error: insertError } = await supabase
          .from('user_strategies')
          .insert({
            user_id: user.id,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            content: markdownContent,
            structured_data: structuredData,
            is_active: true,
            version: 1,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
      }

      // Reset form
      setFormData(emptyFormData);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error saving strategy:', err);
      setError(err.message || 'Errore nel salvataggio della strategia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(emptyFormData);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            {editStrategy ? 'Modifica Strategia' : 'Aggiungi Nuova Strategia'}
          </h2>
          <button 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Nome Strategia */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Nome Strategia *
            </label>
            <input
              type="text"
              required
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="es. Lay the Draw"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          {/* Descrizione */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Descrizione *
            </label>
            <textarea
              required
              rows={4}
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              placeholder="Descrizione dettagliata della strategia..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Condizioni Entry - Quote */}
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-white mb-4">Condizioni Entry - Quote</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Range Ottimale</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Quote intorno a 2.0 o inferiori"
                  value={formData.entryConditions.odds.optimalRange}
                  onChange={(e) => handleChange('entryConditions.odds.optimalRange', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Quote Preferita</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Circa 1.6 a 2.0"
                  value={formData.entryConditions.odds.preferredRange}
                  onChange={(e) => handleChange('entryConditions.odds.preferredRange', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Evitare Quote</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Quote significativamente sopra 2.0"
                  value={formData.entryConditions.odds.avoidRange}
                  onChange={(e) => handleChange('entryConditions.odds.avoidRange', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Condizioni Entry - Pre-Match */}
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-white mb-4">Condizioni Entry - Statistiche Pre-Match</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Statistiche Squadre</label>
                <textarea
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none resize-none"
                  placeholder="es. Le squadre devono avere alte tendenze a segnare..."
                  value={formData.entryConditions.preMatch.teamsStats}
                  onChange={(e) => handleChange('entryConditions.preMatch.teamsStats', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Competizioni Preferite</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Spain Segunda, Swedish second division"
                  value={formData.entryConditions.preMatch.preferredCompetitions}
                  onChange={(e) => handleChange('entryConditions.preMatch.preferredCompetitions', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Evitare</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Partite di inizio stagione, match con squadre non motivate"
                  value={formData.entryConditions.preMatch.avoidConditions}
                  onChange={(e) => handleChange('entryConditions.preMatch.avoidConditions', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Condizioni Entry - Live */}
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-white mb-4">Condizioni Entry - Statistiche Live</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Minuto Ingresso</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Ideale tra il 60° e l'85° minuto"
                  value={formData.entryConditions.live.minuteRange}
                  onChange={(e) => handleChange('entryConditions.live.minuteRange', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Score Match</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Ingresso tipicamente a 0-0 o 1-1"
                  value={formData.entryConditions.live.scoreMatch}
                  onChange={(e) => handleChange('entryConditions.live.scoreMatch', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Statistiche Live 1</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Alta pressione offensiva (es. almeno 3-4 tiri in porta)"
                  value={formData.entryConditions.live.liveStats1}
                  onChange={(e) => handleChange('entryConditions.live.liveStats1', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Statistiche Live 2</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Alto rating live da strumenti dedicati"
                  value={formData.entryConditions.live.liveStats2}
                  onChange={(e) => handleChange('entryConditions.live.liveStats2', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Evitare (Live)</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Mercato con quote Lay Draw gonfiate ben oltre 2.0"
                  value={formData.entryConditions.live.avoidConditions}
                  onChange={(e) => handleChange('entryConditions.live.avoidConditions', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Condizioni Exit */}
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-white mb-4">Condizioni Exit</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Exit 1 (Profitto)</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Exit immediato dopo che un goal viene segnato"
                  value={formData.exitConditions.exit1}
                  onChange={(e) => handleChange('exitConditions.exit1', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Exit 2 (Stop Loss)</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Accettare la perdita se nessun goal arriva"
                  value={formData.exitConditions.exit2}
                  onChange={(e) => handleChange('exitConditions.exit2', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Exit 3 (Tempo/Fine Mercato)</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Chiudere le posizioni alla fine della partita"
                  value={formData.exitConditions.exit3}
                  onChange={(e) => handleChange('exitConditions.exit3', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Gestione Rischio */}
          <div className="bg-background/50 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-white mb-4">Gestione Rischio</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Stake</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Generalmente 1% - 2% del bankroll per trade"
                  value={formData.riskManagement.stake}
                  onChange={(e) => handleChange('riskManagement.stake', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Split Staking</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Piccoli ingressi incrementali o Lay extra"
                  value={formData.riskManagement.splitStaking}
                  onChange={(e) => handleChange('riskManagement.splitStaking', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Take Profit</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Si realizza con l'evento goal e cash out immediato"
                  value={formData.riskManagement.takeProfit}
                  onChange={(e) => handleChange('riskManagement.takeProfit', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Stop Loss</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="es. Le perdite sono limitate dalla dimensione dello stake"
                  value={formData.riskManagement.stopLoss}
                  onChange={(e) => handleChange('riskManagement.stopLoss', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Note</label>
            <textarea
              rows={4}
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              placeholder="Note aggiuntive sulla strategia..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSubmitting ? 'Salvataggio...' : 'Salva Strategia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

