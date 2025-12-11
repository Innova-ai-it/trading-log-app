import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchTodayMatches, fetchPreMatchStats, MatchPreMatchStats } from '../utils/dailyPlanService';
import { generateDailyPlan, MatchAnalysis } from '../utils/aiPlanGenerator';
import { UserStrategy, TradingPlan } from '../types';
import { Sparkles, Loader2, CheckCircle2, XCircle, AlertCircle, Calendar, TrendingUp, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface PlanMatchFeedback {
  matchIdentifier: string;
  recommendationText: string;
  wasExecuted: boolean;
  wasProfitable?: boolean;
  actualResult?: string;
  feedbackNotes?: string;
}

const DailyPlan: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [todayPlan, setTodayPlan] = useState<TradingPlan | null>(null);
  const [planMatches, setPlanMatches] = useState<MatchAnalysis[]>([]);
  const [feedback, setFeedback] = useState<Record<string, PlanMatchFeedback>>({});
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Mostra 5 partite per pagina

  // Funzione di mapping database (snake_case) -> TypeScript (camelCase)
  const mapSupabaseToTradingPlan = (data: any): TradingPlan => {
    return {
      id: data.id,
      userId: data.user_id,
      planDate: data.plan_date,
      planContent: data.plan_content,
      matchesAnalyzed: data.matches_analyzed,
      contextSnapshot: data.context_snapshot,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  };

  // Carica piano del giorno se esiste
  useEffect(() => {
    if (user) {
      loadTodayPlan();
    }
  }, [user]);

  const loadTodayPlan = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('trading_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const mappedPlan = mapSupabaseToTradingPlan(data);
        setTodayPlan(mappedPlan);
        const planData = data.plan_data as any;
        if (planData?.topMatches) {
          setPlanMatches(planData.topMatches);
        }

        // Carica feedback esistenti con paginazione se necessario
        const { data: feedbackData, count: feedbackCount } = await supabase
          .from('plan_match_feedback')
          .select('*', { count: 'exact' })
          .eq('plan_id', data.id)
          .order('created_at', { ascending: false });

        if (feedbackData) {
          const feedbackMap: Record<string, PlanMatchFeedback> = {};
          feedbackData.forEach(f => {
            feedbackMap[f.match_identifier] = {
              matchIdentifier: f.match_identifier,
              recommendationText: f.recommendation_text || '',
              wasExecuted: f.was_executed || false,
              wasProfitable: f.was_profitable ?? undefined,
              actualResult: f.actual_result || undefined,
              feedbackNotes: f.feedback_notes || undefined
            };
          });
          setFeedback(feedbackMap);
        }
      }
    } catch (error: any) {
      console.error('Errore caricamento piano:', error);
      setError(`Errore caricamento: ${error.message}`);
    }
  };

  const handleGeneratePlan = async () => {
    if (!user) return;

    setGenerating(true);
    setError(null);
    try {
      // 1. Recupera partite del giorno
      setLoading(true);
      const matches = await fetchTodayMatches();
      
      if (matches.length === 0) {
        setError('Nessuna partita trovata per oggi nei top campionati');
        setGenerating(false);
        setLoading(false);
        return;
      }

      // 2. Recupera statistiche pre-match per ogni partita
      const matchesWithStats = [];
      let successCount = 0;
      
      console.log(`📊 Processando statistiche per ${matches.length} partite`);
      
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        try {
          console.log(`📈 [${i + 1}/${matches.length}] Recupero statistiche per ${match.teams?.home?.name} vs ${match.teams?.away?.name}`);
          
          const stats = await fetchPreMatchStats(match);
          matchesWithStats.push({ match, stats });
          successCount++;
          
          // Pausa tra le partite per evitare rate limiting (solo se non è l'ultima)
          if (i < matches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error: any) {
          console.error(`❌ Errore statistiche per ${match.teams?.home?.name} vs ${match.teams?.away?.name}:`, error.message || error);
          // Continua con le altre partite anche se una fallisce
        }
      }

      if (matchesWithStats.length === 0) {
        setError('Impossibile recuperare statistiche per le partite. Verifica la configurazione API.');
        setGenerating(false);
        setLoading(false);
        return;
      }

      // 3. Recupera strategie dal database
      const { data: strategies, error: strategiesError } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (strategiesError) throw strategiesError;

      if (!strategies || strategies.length === 0) {
        setError('Nessuna strategia attiva trovata. Crea almeno una strategia prima di generare un piano.');
        setGenerating(false);
        setLoading(false);
        return;
      }

      // 4. Genera piano con AI
      const generatedPlan = await generateDailyPlan(matchesWithStats, strategies);

      // 5. Salva piano nel database
      const today = new Date().toISOString().split('T')[0];
      
      // Cerca se esiste già un piano per oggi
      const { data: existingPlan } = await supabase
        .from('trading_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .maybeSingle();

      let savedPlan;

      if (existingPlan) {
        // Aggiorna piano esistente (mantiene i feedback collegati)
        const { data, error: updateError } = await supabase
          .from('trading_plans')
          .update({
            plan_content: generatedPlan.planText,
            plan_data: {
              matches: generatedPlan.matches,
              topMatches: generatedPlan.topMatches
            },
            matches_analyzed: matchesWithStats.map(m => ({
              matchId: m.stats.match.id,
              homeTeam: m.stats.homeTeam.name,
              awayTeam: m.stats.awayTeam.name,
              league: m.stats.match.leagueName
            })),
            context_snapshot: {
              totalMatches: matches.length,
              matchesWithStats: successCount,
              strategiesUsed: strategies.length,
              generatedAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPlan.id)
          .select()
          .single();

        if (updateError) throw updateError;
        savedPlan = data;
      } else {
        // Crea nuovo piano
        const { data, error: insertError } = await supabase
          .from('trading_plans')
          .insert({
            user_id: user.id,
            plan_date: today,
            plan_content: generatedPlan.planText,
            plan_data: {
              matches: generatedPlan.matches,
              topMatches: generatedPlan.topMatches
            },
            matches_analyzed: matchesWithStats.map(m => ({
              matchId: m.stats.match.id,
              homeTeam: m.stats.homeTeam.name,
              awayTeam: m.stats.awayTeam.name,
              league: m.stats.match.leagueName
            })),
            context_snapshot: {
              totalMatches: matches.length,
              matchesWithStats: successCount,
              strategiesUsed: strategies.length,
              generatedAt: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (insertError) throw insertError;
        savedPlan = data;
      }

      if (savedPlan) {
        const mappedPlan = mapSupabaseToTradingPlan(savedPlan);
        setTodayPlan(mappedPlan);
        
        // Mantieni i feedback esistenti (non resettare, servono per memoria AI futura)
        // I feedback rimangono nel database anche se rigeneri il piano
        const { data: feedbackData } = await supabase
          .from('plan_match_feedback')
          .select('*')
          .eq('plan_id', savedPlan.id);

        if (feedbackData && feedbackData.length > 0) {
          // Aggiungi i feedback esistenti senza sovrascrivere
          const feedbackMap: Record<string, PlanMatchFeedback> = {};
          feedbackData.forEach(f => {
            feedbackMap[f.match_identifier] = {
              matchIdentifier: f.match_identifier,
              recommendationText: f.recommendation_text || '',
              wasExecuted: f.was_executed || false,
              wasProfitable: f.was_profitable ?? undefined,
              actualResult: f.actual_result || undefined,
              feedbackNotes: f.feedback_notes || undefined
            };
          });
          // Merge con feedback esistenti nello state (non sovrascrive)
          setFeedback(prev => ({ ...prev, ...feedbackMap }));
        }
      }
      setPlanMatches(generatedPlan.topMatches);
      setCurrentPage(1); // Reset alla prima pagina quando generi un nuovo piano
      // NON resettare feedback - devono rimanere per memoria AI

    } catch (error: any) {
      console.error('Errore generazione piano:', error);
      setError(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleFeedbackUpdate = async (
    matchIdentifier: string,
    updates: Partial<PlanMatchFeedback>
  ) => {
    if (!user || !todayPlan) return;

    const currentFeedback = feedback[matchIdentifier] || {
      matchIdentifier,
      recommendationText: '',
      wasExecuted: false
    };

    const updatedFeedback = { ...currentFeedback, ...updates };
    setFeedback(prev => ({ ...prev, [matchIdentifier]: updatedFeedback }));

    try {
      // Cerca feedback esistente
      const { data: existing } = await supabase
        .from('plan_match_feedback')
        .select('id')
        .eq('plan_id', todayPlan.id)
        .eq('match_identifier', matchIdentifier)
        .maybeSingle();

      if (existing) {
        // Update
        await supabase
          .from('plan_match_feedback')
          .update({
            was_executed: updatedFeedback.wasExecuted,
            was_profitable: updatedFeedback.wasProfitable ?? null,
            actual_result: updatedFeedback.actualResult || null,
            feedback_notes: updatedFeedback.feedbackNotes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert
        const matchAnalysis = planMatches.find(m => 
          `${m.league} - ${m.homeTeam} vs ${m.awayTeam}` === matchIdentifier
        );
        
        await supabase
          .from('plan_match_feedback')
          .insert({
            plan_id: todayPlan.id,
            user_id: user.id,
            match_identifier: matchIdentifier,
            recommendation_text: matchAnalysis?.bestStrategy.reasoning || updatedFeedback.recommendationText,
            was_executed: updatedFeedback.wasExecuted,
            was_profitable: updatedFeedback.wasProfitable ?? null,
            actual_result: updatedFeedback.actualResult || null,
            feedback_notes: updatedFeedback.feedbackNotes || null
          });
      }
    } catch (error) {
      console.error('Errore salvataggio feedback:', error);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-500" />
            Piano di Trading Giornaliero
          </h1>
          <p className="text-gray-400 mt-1">
            Genera automaticamente il tuo piano di trading per le partite di oggi
          </p>
        </div>
        <button
          onClick={handleGeneratePlan}
          disabled={generating || loading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating || loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generazione in corso...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Crea il tuo piano di trading giornaliero
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">Errore</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Piano Generato */}
      {todayPlan && planMatches.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-white">
                Piano del {new Date(todayPlan.planDate).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <TrendingUp className="w-4 h-4" />
              {planMatches.length} partite selezionate
            </div>
          </div>

          {/* Piano Testo */}
          <div className="bg-background/50 rounded-lg p-6 mb-6 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-300">Piano Completo</h3>
            </div>
            {todayPlan.planContent ? (
              <div className="max-h-[600px] overflow-y-auto pr-2">
                <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {todayPlan.planContent}
                </pre>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Nessun contenuto disponibile</p>
            )}
          </div>

          {/* Match con Feedback */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Feedback Partite</h3>
              {planMatches.length > itemsPerPage && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>
                    Pagina {currentPage} di {Math.ceil(planMatches.length / itemsPerPage)}
                  </span>
                </div>
              )}
            </div>
            
            {/* Partite paginate */}
            {planMatches
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((match) => {
              const matchIdentifier = `${match.league} - ${match.homeTeam} vs ${match.awayTeam}`;
              const matchFeedback = feedback[matchIdentifier] || {
                matchIdentifier,
                recommendationText: match.bestStrategy.reasoning,
                wasExecuted: false
              };

              return (
                <div
                  key={match.matchId}
                  className="bg-background/50 rounded-lg p-4 border border-border"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold">
                        {match.homeTeam} vs {match.awayTeam}
                      </h4>
                      <p className="text-sm text-gray-400">{match.league} - {match.time}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-blue-400">
                          Strategia: {match.bestStrategy.strategyName}
                        </span>
                        <span className="text-xs text-gray-500">
                          (Confidence: {match.bestStrategy.confidence}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {matchFeedback.wasExecuted ? (
                        matchFeedback.wasProfitable === true ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" title="Vincente" />
                        ) : matchFeedback.wasProfitable === false ? (
                          <XCircle className="w-5 h-5 text-red-500" title="Perdente" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500" title="In attesa" />
                        )
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-500 rounded-full" title="Non eseguito" />
                      )}
                    </div>
                  </div>

                  {/* Controlli Feedback */}
                  <div className="space-y-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={matchFeedback.wasExecuted}
                          onChange={(e) =>
                            handleFeedbackUpdate(matchIdentifier, {
                              wasExecuted: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                        />
                        Trade effettuato
                      </label>
                    </div>

                    {matchFeedback.wasExecuted && (
                      <>
                        <div className="flex items-center gap-4">
                          <label className="text-sm text-gray-300">Risultato:</label>
                          <select
                            value={
                              matchFeedback.wasProfitable === true
                                ? 'win'
                                : matchFeedback.wasProfitable === false
                                ? 'lose'
                                : 'pending'
                            }
                            onChange={(e) =>
                              handleFeedbackUpdate(matchIdentifier, {
                                wasProfitable:
                                  e.target.value === 'win'
                                    ? true
                                    : e.target.value === 'lose'
                                    ? false
                                    : undefined
                              })
                            }
                            className="bg-background border border-border rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pending">In attesa</option>
                            <option value="win">Vincente</option>
                            <option value="lose">Perdente</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-300 mb-1">
                            Note (opzionale):
                          </label>
                          <textarea
                            value={matchFeedback.feedbackNotes || ''}
                            onChange={(e) =>
                              handleFeedbackUpdate(matchIdentifier, {
                                feedbackNotes: e.target.value
                              })
                            }
                            placeholder="Aggiungi note sul trade..."
                            className="w-full bg-background border border-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={2}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Controlli Paginazione */}
            {planMatches.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/50">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background/80 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Precedente
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.ceil(planMatches.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-background border border-border text-gray-300 hover:bg-background/80'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(planMatches.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(planMatches.length / itemsPerPage)}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background/80 transition-colors"
                >
                  Successiva
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nessun Piano */}
      {!todayPlan && !generating && !loading && (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2 text-lg">
            Nessun piano generato per oggi
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Clicca il pulsante sopra per generare automaticamente il tuo piano di trading basato sulle partite di oggi e le tue strategie
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyPlan;

