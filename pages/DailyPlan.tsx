import React, { useState, useEffect } from 'react';
import { fetchTodayMatches, fetchPreMatchStats, MatchPreMatchStats, TodayMatch } from '../utils/dailyPlanService';
import { generateProfessionalMatchAnalysis, ProfessionalMatchAnalysis } from '../utils/professionalMatchAnalysis';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Calendar, TrendingUp, X, Clock, AlertCircle, Sparkles, TrendingDown, Target, AlertTriangle, Filter } from 'lucide-react';

interface MatchWithStats {
  match: any;
  stats: MatchPreMatchStats;
}

interface MatchWithoutStats {
  match: TodayMatch;
  stats: null;
}

type MatchData = MatchWithStats | MatchWithoutStats;

const DailyPlan: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ProfessionalMatchAnalysis | null>(null);
  const [strategyNames, setStrategyNames] = useState<Record<number, string>>({});
  const [loadingStats, setLoadingStats] = useState<Record<number, boolean>>({});
  
  // Stati per i filtri
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedTime, setSelectedTime] = useState<string>('all');

  // Helper per verificare se una partita ha statistiche
  const hasStats = (matchData: MatchData): matchData is MatchWithStats => {
    return matchData.stats !== null;
  };

  // Funzioni per estrarre competizioni e orari unici dalle partite
  const getAvailableLeagues = (): string[] => {
    const leagues = new Set<string>();
    matches.forEach(matchData => {
      if (hasStats(matchData)) {
        leagues.add(matchData.stats.match.leagueName);
      } else {
        const matchWithoutStats = matchData as MatchWithoutStats;
        if (matchWithoutStats.match.league?.name) {
          leagues.add(matchWithoutStats.match.league.name);
        }
      }
    });
    return Array.from(leagues).sort();
  };

  const getAvailableTimes = (): string[] => {
    const times = new Set<string>();
    matches.forEach(matchData => {
      if (hasStats(matchData)) {
        times.add(matchData.stats.match.time);
      } else {
        const matchWithoutStats = matchData as MatchWithoutStats;
        if (matchWithoutStats.match.fixture?.date) {
          const time = new Date(matchWithoutStats.match.fixture.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          times.add(time);
        }
      }
    });
    return Array.from(times).sort();
  };

  // Funzione per filtrare le partite
  const getFilteredMatches = (): MatchData[] => {
    // Se entrambi i filtri sono su 'all', restituisci tutte le partite
    if (selectedLeague === 'all' && selectedTime === 'all') {
      return matches;
    }

    return matches.filter(matchData => {
      // Filtro per competizione
      let leagueMatch = true;
      if (selectedLeague !== 'all') {
        if (hasStats(matchData)) {
          leagueMatch = matchData.stats.match.leagueName === selectedLeague;
        } else {
          const matchWithoutStats = matchData as MatchWithoutStats;
          leagueMatch = matchWithoutStats.match.league?.name === selectedLeague;
        }
      }

      // Filtro per orario
      let timeMatch = true;
      if (selectedTime !== 'all') {
        if (hasStats(matchData)) {
          timeMatch = matchData.stats.match.time === selectedTime;
        } else {
          const matchWithoutStats = matchData as MatchWithoutStats;
          if (matchWithoutStats.match.fixture?.date) {
            const time = new Date(matchWithoutStats.match.fixture.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            timeMatch = time === selectedTime;
          } else {
            timeMatch = false;
          }
        }
      }

      return leagueMatch && timeMatch;
    });
  };

  // Salva le partite nel database (solo quelle con statistiche)
  const saveMatchesToDatabase = async (matches: MatchWithStats[], strategyNames: Record<number, string>) => {
    if (!user?.id) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Cerca se esiste già un piano per oggi
      const { data: existingPlan } = await supabase
        .from('trading_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .single();

      const matchesData = {
        matches: matches,
        strategyNames: strategyNames,
        date: today
      };

      if (existingPlan) {
        // Aggiorna il piano esistente
        const { error } = await supabase
          .from('trading_plans')
          .update({
            matches_analyzed: matchesData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPlan.id);

        if (error) throw error;
        console.log('✅ Partite aggiornate nel database');
      } else {
        // Crea un nuovo piano
        const { error } = await supabase
          .from('trading_plans')
          .insert({
            user_id: user.id,
            plan_date: today,
            plan_content: `Piano giornaliero con ${matches.length} partite`,
            matches_analyzed: matchesData
          });

        if (error) throw error;
        console.log('✅ Partite salvate nel database');
      }
    } catch (error) {
      console.error('❌ Errore salvataggio partite nel database:', error);
    }
  };

  // Salva le partite in localStorage e nel database
  const saveMatchesToStorage = async (matches: MatchData[], strategyNames: Record<number, string>) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('daily_plan_matches', JSON.stringify({
        date: today,
        matches: matches,
        strategyNames: strategyNames
      }));
      
      // Salva anche nel database solo le partite con statistiche
      const matchesWithStats = matches.filter(hasStats) as MatchWithStats[];
      if (matchesWithStats.length > 0) {
        await saveMatchesToDatabase(matchesWithStats, strategyNames);
      }
    } catch (error) {
      console.error('Errore salvataggio:', error);
    }
  };

  // Carica le partite da localStorage
  const loadMatchesFromStorage = () => {
    try {
      const stored = localStorage.getItem('daily_plan_matches');
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      
      // Se sono di oggi, le carico
      if (data.date === today && data.matches?.length > 0) {
        return data;
      }
      
      // Altrimenti elimino i dati vecchi
      localStorage.removeItem('daily_plan_matches');
      return null;
    } catch (error) {
      return null;
    }
  };

  // Carica le partite dal database
  const loadMatchesFromDatabase = async (): Promise<{ matches: MatchData[], strategyNames: Record<number, string> } | null> => {
    if (!user?.id) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('trading_plans')
        .select('matches_analyzed')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nessun piano trovato per oggi
          return null;
        }
        throw error;
      }

      if (data?.matches_analyzed) {
        const matchesData = data.matches_analyzed as any;
        // Verifica che la data corrisponda a oggi
        if (matchesData.date === today && matchesData.matches?.length > 0) {
          return {
            matches: matchesData.matches,
            strategyNames: matchesData.strategyNames || {}
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Errore caricamento partite dal database:', error);
      return null;
    }
  };

  // Carica automaticamente le partite salvate quando il componente si monta
  useEffect(() => {
    const loadMatches = async () => {
      // Prima prova a caricare da localStorage
      const saved = loadMatchesFromStorage();
      if (saved) {
        setMatches(saved.matches);
        setStrategyNames(saved.strategyNames || {});
        
        if (user?.id && saved.matches.length > 0) {
          const matchesWithStats = saved.matches.filter(hasStats) as MatchWithStats[];
          if (matchesWithStats.length > 0) {
            const matchIds = matchesWithStats.map(m => m.stats.match.id);
            await loadStrategyNames(user.id, matchIds, matchesWithStats);
          }
        }
        return;
      }

      // Se non ci sono in localStorage, prova a caricare dal database
      if (user?.id) {
        const dbMatches = await loadMatchesFromDatabase();
        if (dbMatches) {
          setMatches(dbMatches.matches);
          setStrategyNames(dbMatches.strategyNames || {});
          
          // Salva anche in localStorage per performance future
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('daily_plan_matches', JSON.stringify({
            date: today,
            matches: dbMatches.matches,
            strategyNames: dbMatches.strategyNames
          }));
          
          if (dbMatches.matches.length > 0) {
            const matchesWithStats = dbMatches.matches.filter(hasStats) as MatchWithStats[];
            if (matchesWithStats.length > 0) {
              const matchIds = matchesWithStats.map(m => m.stats.match.id);
              await loadStrategyNames(user.id, matchIds, matchesWithStats);
            }
          }
        }
      }
    };

    loadMatches();
  }, [user]);

  // Reset filtri quando cambiano le partite
  useEffect(() => {
    setSelectedLeague('all');
    setSelectedTime('all');
  }, [matches.length]);

  // Funzioni per salvare e caricare le analisi
  const saveMatchAnalysis = async (
    userId: string,
    matchId: number,
    matchDate: string,
    analysis: ProfessionalMatchAnalysis
  ) => {
    try {
      const { error } = await supabase
        .from('match_analyses')
        .upsert({
          user_id: userId,
          match_id: matchId,
          match_date: matchDate,
          analysis_data: analysis,
        }, {
          onConflict: 'user_id,match_id'
        });

      if (error) throw error;
      console.log('✅ Analisi salvata con successo');
    } catch (error) {
      console.error('❌ Errore salvataggio analisi:', error);
    }
  };

  const loadMatchAnalysis = async (
    userId: string,
    matchId: number
  ): Promise<ProfessionalMatchAnalysis | null> => {
    try {
      const { data, error } = await supabase
        .from('match_analyses')
        .select('analysis_data')
        .eq('user_id', userId)
        .eq('match_id', matchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nessuna analisi trovata
          return null;
        }
        throw error;
      }

      return data?.analysis_data as ProfessionalMatchAnalysis || null;
    } catch (error) {
      console.error('❌ Errore caricamento analisi:', error);
      return null;
    }
  };

  const getStrategyShortName = (analysis: ProfessionalMatchAnalysis): string => {
    const market = analysis.betfairAdvice?.market || '';
    const strategyName = analysis.recommendedStrategy?.name || market;
    
    // Abbreviazioni comuni
    if (market.toLowerCase().includes('over 0.5 first half') || market.toLowerCase().includes('over 0.5 fh')) {
      return 'Over 0.5 FH';
    }
    if (market.toLowerCase().includes('over 0.5 second half') || market.toLowerCase().includes('over 0.5 sh')) {
      return 'Over 0.5 SH';
    }
    if (market.toLowerCase().includes('over 2.5')) {
      return 'Over 2.5';
    }
    if (market.toLowerCase().includes('over 1.5')) {
      return 'Over 1.5';
    }
    if (market.toLowerCase().includes('btts') || market.toLowerCase().includes('both teams to score')) {
      return 'BTTS';
    }
    if (market.toLowerCase().includes('under 2.5')) {
      return 'Under 2.5';
    }
    
    // Se il nome è troppo lungo, accorcialo
    if (strategyName.length > 20) {
      return strategyName.substring(0, 17) + '...';
    }
    return strategyName;
  };

  const loadStrategyNames = async (userId: string, matchIds: number[], matchesToSave?: MatchWithStats[]) => {
    if (matchIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('match_analyses')
        .select('match_id, analysis_data')
        .eq('user_id', userId)
        .in('match_id', matchIds);

      if (error) throw error;

      if (data) {
        const namesMap: Record<number, string> = {};
        data.forEach((item) => {
          const analysis = item.analysis_data as ProfessionalMatchAnalysis;
          namesMap[item.match_id] = getStrategyShortName(analysis);
        });
        setStrategyNames(namesMap);
        
        // Salva anche in localStorage se ci sono partite da salvare
        if (matchesToSave && matchesToSave.length > 0) {
          await saveMatchesToStorage(matchesToSave, namesMap);
        }
      }
    } catch (error) {
      console.error('❌ Errore caricamento nomi strategie:', error);
    }
  };

  const handleLoadMatches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Recupera partite del giorno (già filtrate per top campionati)
      const todayMatches = await fetchTodayMatches();
      
      if (todayMatches.length === 0) {
        setError('Nessuna partita trovata per oggi nei top campionati');
        setLoading(false);
        return;
      }

      // 2. Crea array di partite senza statistiche
      const matchesWithoutStats: MatchWithoutStats[] = todayMatches.map(match => ({
        match,
        stats: null
      }));

      setMatches(matchesWithoutStats);

      // Salva in localStorage
      await saveMatchesToStorage(matchesWithoutStats, strategyNames);
    } catch (error: any) {
      setError(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzione per caricare statistiche per una singola partita
  const handleLoadStats = async (matchData: MatchWithoutStats) => {
    const matchId = matchData.match.fixture.id;
    setLoadingStats(prev => ({ ...prev, [matchId]: true }));
    
    try {
      const stats = await fetchPreMatchStats(matchData.match);
      const matchWithStats: MatchWithStats = {
        match: matchData.match,
        stats
      };

      // Aggiorna la partita nello stato
      setMatches(prev => prev.map(m => 
        m.match.fixture.id === matchId ? matchWithStats : m
      ));

      // Salva le partite aggiornate
      const updatedMatches = matches.map(m => 
        m.match.fixture.id === matchId ? matchWithStats : m
      );
      await saveMatchesToStorage(updatedMatches, strategyNames);

      // Carica i nomi delle strategie se necessario
      if (user?.id) {
        const matchesWithStats = updatedMatches.filter(hasStats) as MatchWithStats[];
        if (matchesWithStats.length > 0) {
          const matchIds = matchesWithStats.map(m => m.stats.match.id);
          await loadStrategyNames(user.id, matchIds, matchesWithStats);
        }
      }
    } catch (error: any) {
      console.error(`Errore caricamento statistiche:`, error);
      setError(`Errore caricamento statistiche per ${matchData.match.teams?.home?.name} vs ${matchData.match.teams?.away?.name}: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoadingStats(prev => ({ ...prev, [matchId]: false }));
    }
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'FIRST_HALF': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'SECOND_HALF': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'BALANCED': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'FULL_MATCH': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'LIVE_FLEXIBLE': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPatternLabel = (pattern: string) => {
    switch (pattern) {
      case 'FIRST_HALF': return 'Primo Tempo';
      case 'SECOND_HALF': return 'Secondo Tempo';
      case 'BALANCED': return 'Bilanciato';
      default: return pattern;
    }
  };

  const safeNumber = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined) return '0.00';
    return value.toFixed(decimals);
  };

  const handleGenerateAnalysis = async () => {
    if (!selectedMatch) return;
    
    setLoadingAnalysis(true);
    setAnalysisError(null);
    
    try {
      const analysis = await generateProfessionalMatchAnalysis(
        selectedMatch
      );
      
      setCurrentAnalysis(analysis);
      
      // Aggiorna il nome della strategia nello stato
      if (selectedMatch.stats.match.id) {
        setStrategyNames(prev => {
          const updated = {
            ...prev,
            [selectedMatch.stats.match.id]: getStrategyShortName(analysis)
          };
          
          // Salva anche in localStorage se ci sono partite caricate
          if (matches.length > 0) {
            const matchesWithStats = matches.filter(hasStats) as MatchWithStats[];
            if (matchesWithStats.length > 0) {
              saveMatchesToStorage(matches, updated).catch(err => 
                console.error('Errore salvataggio partite:', err)
              );
            }
          }
          
          return updated;
        });
      }
      
      // Salva l'analisi nel database
      if (user?.id && selectedMatch.stats.match.id) {
        await saveMatchAnalysis(
          user.id,
          selectedMatch.stats.match.id,
          selectedMatch.stats.match.date,
          analysis
        );
      }
    } catch (error: any) {
      console.error('Errore generazione analisi:', error);
      setAnalysisError(error.message || 'Errore durante la generazione dell\'analisi');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTimingLabel = (timing: string) => {
    switch (timing) {
      case 'FIRST_HALF': return 'Primo Tempo';
      case 'SECOND_HALF': return 'Secondo Tempo';
      case 'FULL_MATCH': return 'Partita Intera';
      case 'LIVE_FLEXIBLE': return 'Live Flessibile';
      default: return timing;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            Partite di Oggi
          </h1>
          <p className="text-gray-400 mt-1">
            Carica le partite dei top campionati prefiltrate
          </p>
        </div>
        <button
          onClick={handleLoadMatches}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Caricamento in corso...
            </>
          ) : (
            <>
              <TrendingUp className="w-5 h-5" />
              Carica Partite Oggi
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

      {/* Filtri */}
      {matches.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Filtri</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro Competizione */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Competizione
              </label>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tutte le competizioni</option>
                {getAvailableLeagues().map(league => (
                  <option key={league} value={league}>
                    {league}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Orario */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Orario
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tutti gli orari</option>
                {getAvailableTimes().map(time => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Pulsante Reset Filtri */}
          <div className="mt-4 flex items-center justify-between">
            {(selectedLeague !== 'all' || selectedTime !== 'all') && (
              <span className="text-xs text-gray-500">
                Filtri attivi
              </span>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                setSelectedLeague('all');
                setSelectedTime('all');
              }}
              disabled={selectedLeague === 'all' && selectedTime === 'all'}
              className="text-sm text-blue-400 hover:text-blue-300 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-blue-400 transition-colors"
              type="button"
            >
              Reset filtri
            </button>
          </div>
        </div>
      )}

      {/* Contatore Partite */}
      {matches.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span>
            {getFilteredMatches().length} di {matches.length} partite
            {(selectedLeague !== 'all' || selectedTime !== 'all') && ' (filtrate)'}
          </span>
        </div>
      )}

      {/* Matches Grid */}
      {matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getFilteredMatches().map((matchData) => {
            const matchId = matchData.match.fixture.id;
            const isLoadingStats = loadingStats[matchId] || false;
            
            // Se la partita ha statistiche, mostra i dati completi
            if (hasStats(matchData)) {
              const { match, stats } = matchData;
              return (
                <div
                  key={stats.match.id}
                  onClick={async () => {
                    setSelectedMatch(matchData);
                    setCurrentAnalysis(null);
                    
                    if (user?.id && stats.match.id) {
                      const savedAnalysis = await loadMatchAnalysis(
                        user.id,
                        stats.match.id
                      );
                      if (savedAnalysis) {
                        setCurrentAnalysis(savedAnalysis);
                      }
                    }
                  }}
                  className="bg-surface rounded-xl border border-border p-5 cursor-pointer hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg">
                        {stats.homeTeam.name}
                      </h3>
                      <p className="text-gray-400 text-sm">vs</p>
                      <h3 className="text-white font-semibold text-lg">
                        {stats.awayTeam.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">{stats.match.leagueName}</p>
                      <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
                        <Clock className="w-3 h-3" />
                        {stats.match.time}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Media Goal:</span>
                      <span className="text-white font-medium">{safeNumber(stats.combined.avgGoalsPerMatch)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Goal FH (ultimi 5):</span>
                      <span className="text-white font-medium">{stats.combined.goalsFirstHalf}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Goal SH (ultimi 5):</span>
                      <span className="text-white font-medium">{stats.combined.goalsSecondHalf}</span>
                    </div>
                    {stats.combined.goalsFirstHalf + stats.combined.goalsSecondHalf > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Distribuzione:</span>
                        <span className="text-white font-medium text-xs">
                          {Math.round((stats.combined.goalsFirstHalf / (stats.combined.goalsFirstHalf + stats.combined.goalsSecondHalf)) * 100)}% FH / 
                          {Math.round((stats.combined.goalsSecondHalf / (stats.combined.goalsFirstHalf + stats.combined.goalsSecondHalf)) * 100)}% SH
                        </span>
                      </div>
                    )}
                    <div className="mt-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPatternColor(stats.combined.scoringPattern)}`}>
                        Pattern: {getPatternLabel(stats.combined.scoringPattern)}
                      </span>
                    </div>
                    {strategyNames[stats.match.id] && (
                      <div className="mt-2">
                        <span className="inline-block px-3 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {strategyNames[stats.match.id]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            
            // Se la partita NON ha statistiche, mostra card semplice con pulsante per caricare statistiche
            const matchWithoutStats = matchData as MatchWithoutStats;
            return (
              <div
                key={matchId}
                className="bg-surface rounded-xl border border-border p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg">
                      {matchWithoutStats.match.teams?.home?.name || 'Squadra Casa'}
                    </h3>
                    <p className="text-gray-400 text-sm">vs</p>
                    <h3 className="text-white font-semibold text-lg">
                      {matchWithoutStats.match.teams?.away?.name || 'Squadra Ospiti'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">{matchWithoutStats.match.league?.name || 'Campionato'}</p>
                    <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
                      <Clock className="w-3 h-3" />
                      {matchWithoutStats.match.fixture?.date ? new Date(matchWithoutStats.match.fixture.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadStats(matchWithoutStats);
                    }}
                    disabled={isLoadingStats}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg text-white font-medium transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingStats ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Caricamento statistiche...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Carica Statistiche
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dettagli Partita */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMatch(null)}>
          <div className="bg-surface rounded-xl border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-border p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedMatch.stats.homeTeam.name} vs {selectedMatch.stats.awayTeam.name}
                </h2>
                <p className="text-gray-400 mt-1">
                  {selectedMatch.stats.match.leagueName} - {selectedMatch.stats.match.time}
                </p>
                {selectedMatch.stats.match.venue && (
                  <p className="text-gray-400 text-sm mt-1">
                    📍 {selectedMatch.stats.match.venue}
                  </p>
                )}
                <p className="text-gray-400 text-sm mt-1">
                  📅 {new Date(selectedMatch.stats.match.date).toLocaleDateString('it-IT', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                </p>
            </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
          </div>

            <div className="p-6 space-y-6">
              {/* Statistiche HOME */}
              <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                <h3 className="text-xl font-bold text-white mb-4">{selectedMatch.stats.homeTeam.name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Media Goal Fatti</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.homeTeam.avgGoalsFor)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Media Goal Subiti</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.homeTeam.avgGoalsAgainst)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Rapporto Fatti/Subiti</p>
                    <p className="text-white font-semibold text-lg">
                      {safeNumber(selectedMatch.stats.homeTeam.avgGoalsFor / selectedMatch.stats.homeTeam.avgGoalsAgainst, 2)}
                    </p>
                  </div>
                  {selectedMatch.stats.homeTeam.goalsFH + selectedMatch.stats.homeTeam.goalsSH > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Distribuzione Goal</p>
                      <p className="text-white font-semibold text-sm">
                        {Math.round((selectedMatch.stats.homeTeam.goalsFH / (selectedMatch.stats.homeTeam.goalsFH + selectedMatch.stats.homeTeam.goalsSH)) * 100)}% FH / 
                        {Math.round((selectedMatch.stats.homeTeam.goalsSH / (selectedMatch.stats.homeTeam.goalsFH + selectedMatch.stats.homeTeam.goalsSH)) * 100)}% SH
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Primo Tempo (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.homeTeam.goalsFH}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Secondo Tempo (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.homeTeam.goalsSH}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">xG Primo Tempo Medio</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.homeTeam.xGFirstHalfAvg)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Pattern</p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getPatternColor(selectedMatch.stats.homeTeam.scoringPattern)}`}>
                      {getPatternLabel(selectedMatch.stats.homeTeam.scoringPattern)}
                    </span>
                  </div>
                  {selectedMatch.stats.homeTeam.position && (
                    <>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Posizione Classifica</p>
                        <p className="text-white font-semibold text-lg">{selectedMatch.stats.homeTeam.position}°</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Punti</p>
                        <p className="text-white font-semibold text-lg">{selectedMatch.stats.homeTeam.points || '-'}</p>
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <p className="text-gray-400 text-sm mb-2">Form (ultimi 5 match)</p>
                    <div className="flex gap-2">
                      {selectedMatch.stats.homeTeam.form.map((result, idx) => (
                        <span key={idx} className={`w-10 h-10 rounded flex items-center justify-center text-sm font-bold ${
                          result === 'W' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          result === 'D' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {result}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistiche AWAY */}
              <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                <h3 className="text-xl font-bold text-white mb-4">{selectedMatch.stats.awayTeam.name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Media Goal Fatti</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.awayTeam.avgGoalsFor)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Media Goal Subiti</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.awayTeam.avgGoalsAgainst)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Rapporto Fatti/Subiti</p>
                    <p className="text-white font-semibold text-lg">
                      {safeNumber(selectedMatch.stats.awayTeam.avgGoalsFor / selectedMatch.stats.awayTeam.avgGoalsAgainst, 2)}
                    </p>
                  </div>
                  {selectedMatch.stats.awayTeam.goalsFH + selectedMatch.stats.awayTeam.goalsSH > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Distribuzione Goal</p>
                      <p className="text-white font-semibold text-sm">
                        {Math.round((selectedMatch.stats.awayTeam.goalsFH / (selectedMatch.stats.awayTeam.goalsFH + selectedMatch.stats.awayTeam.goalsSH)) * 100)}% FH / 
                        {Math.round((selectedMatch.stats.awayTeam.goalsSH / (selectedMatch.stats.awayTeam.goalsFH + selectedMatch.stats.awayTeam.goalsSH)) * 100)}% SH
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Primo Tempo (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.awayTeam.goalsFH}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Secondo Tempo (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.awayTeam.goalsSH}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">xG Primo Tempo Medio</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.awayTeam.xGFirstHalfAvg)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Pattern</p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getPatternColor(selectedMatch.stats.awayTeam.scoringPattern)}`}>
                      {getPatternLabel(selectedMatch.stats.awayTeam.scoringPattern)}
                    </span>
                  </div>
                  {selectedMatch.stats.awayTeam.position && (
                    <>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Posizione Classifica</p>
                        <p className="text-white font-semibold text-lg">{selectedMatch.stats.awayTeam.position}°</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Punti</p>
                        <p className="text-white font-semibold text-lg">{selectedMatch.stats.awayTeam.points || '-'}</p>
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <p className="text-gray-400 text-sm mb-2">Form (ultimi 5 match)</p>
                    <div className="flex gap-2">
                      {selectedMatch.stats.awayTeam.form.map((result, idx) => (
                        <span key={idx} className={`w-10 h-10 rounded flex items-center justify-center text-sm font-bold ${
                          result === 'W' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          result === 'D' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {result}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistiche COMBINATE */}
              <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                <h3 className="text-xl font-bold text-white mb-4">Statistiche Combinate</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Media Goal per Partita</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.combined.avgGoalsPerMatch)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">xG Primo Tempo Medio Combinato</p>
                    <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.combined.xGFirstHalfAvg)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Primo Tempo Combinati (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.combined.goalsFirstHalf}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Goal Secondo Tempo Combinati (ultimi 5)</p>
                    <p className="text-white font-semibold text-lg">{selectedMatch.stats.combined.goalsSecondHalf}</p>
                  </div>
                  {selectedMatch.stats.combined.goalsFirstHalf + selectedMatch.stats.combined.goalsSecondHalf > 0 && (
                    <div className="col-span-2">
                      <p className="text-gray-400 text-sm mb-2">Distribuzione Goal Combinata</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Primo Tempo</span>
                            <span>{Math.round((selectedMatch.stats.combined.goalsFirstHalf / (selectedMatch.stats.combined.goalsFirstHalf + selectedMatch.stats.combined.goalsSecondHalf)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(selectedMatch.stats.combined.goalsFirstHalf / (selectedMatch.stats.combined.goalsFirstHalf + selectedMatch.stats.combined.goalsSecondHalf)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Secondo Tempo</span>
                            <span>{Math.round((selectedMatch.stats.combined.goalsSecondHalf / (selectedMatch.stats.combined.goalsFirstHalf + selectedMatch.stats.combined.goalsSecondHalf)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full" 
                              style={{ width: `${(selectedMatch.stats.combined.goalsSecondHalf / (selectedMatch.stats.combined.goalsFirstHalf + selectedMatch.stats.combined.goalsSecondHalf)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-gray-400 text-sm mb-2">Pattern Combinato</p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getPatternColor(selectedMatch.stats.combined.scoringPattern)}`}>
                      {getPatternLabel(selectedMatch.stats.combined.scoringPattern)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Head to Head */}
              {selectedMatch.stats.headToHead && (
                <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                  <h3 className="text-xl font-bold text-white mb-4">📊 Head to Head</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Vittorie {selectedMatch.stats.homeTeam.name}</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.headToHead.homeWins}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Pareggi</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.headToHead.draws}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Vittorie {selectedMatch.stats.awayTeam.name}</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.headToHead.awayWins}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Totale Confronti</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.headToHead.totalMatches}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Media Goal {selectedMatch.stats.homeTeam.name}</p>
                      <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.headToHead.homeAvgGoals)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Media Goal {selectedMatch.stats.awayTeam.name}</p>
                      <p className="text-white font-semibold text-lg">{safeNumber(selectedMatch.stats.headToHead.awayAvgGoals)}</p>
                    </div>
                  </div>
                  {selectedMatch.stats.headToHead.recentMatches.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Ultimi Confronti</p>
                      <div className="space-y-2">
                        {selectedMatch.stats.headToHead.recentMatches.map((match, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-background/30 rounded p-2">
                            <span className="text-gray-400">
                              {new Date(match.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="text-white">
                              {selectedMatch.stats.homeTeam.name} {match.homeScore} - {match.awayScore} {selectedMatch.stats.awayTeam.name}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              match.result === 'W' ? 'bg-green-500/20 text-green-400' :
                              match.result === 'D' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {match.result === 'W' ? 'V' : match.result === 'D' ? 'N' : 'P'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Infortuni */}
              {(selectedMatch.stats.homeTeam.injuries && selectedMatch.stats.homeTeam.injuries.length > 0) || 
               (selectedMatch.stats.awayTeam.injuries && selectedMatch.stats.awayTeam.injuries.length > 0) ? (
                <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                  <h3 className="text-xl font-bold text-white mb-4">🏥 Infortuni e Squalifiche</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedMatch.stats.homeTeam.injuries && selectedMatch.stats.homeTeam.injuries.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2 font-medium">{selectedMatch.stats.homeTeam.name}</p>
                        <div className="space-y-1">
                          {selectedMatch.stats.homeTeam.injuries.map((injury, idx) => (
                            <p key={idx} className="text-red-400 text-sm">⚠️ {injury}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedMatch.stats.awayTeam.injuries && selectedMatch.stats.awayTeam.injuries.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2 font-medium">{selectedMatch.stats.awayTeam.name}</p>
                        <div className="space-y-1">
                          {selectedMatch.stats.awayTeam.injuries.map((injury, idx) => (
                            <p key={idx} className="text-red-400 text-sm">⚠️ {injury}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Quote */}
              {selectedMatch.stats.odds && (
                <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                  <h3 className="text-xl font-bold text-white mb-4">💰 Quote Pre-Partita</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">1 (Casa)</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.home ? safeNumber(selectedMatch.stats.odds.home, 2) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">X (Pareggio)</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.draw ? safeNumber(selectedMatch.stats.odds.draw, 2) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">2 (Ospiti)</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.away ? safeNumber(selectedMatch.stats.odds.away, 2) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Over 2.5</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.over25 ? safeNumber(selectedMatch.stats.odds.over25, 2) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Under 2.5</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.under25 ? safeNumber(selectedMatch.stats.odds.under25, 2) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">BTTS (Sì)</p>
                      <p className="text-white font-semibold text-lg">{selectedMatch.stats.odds.btts ? safeNumber(selectedMatch.stats.odds.btts, 2) : '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analisi Professionale AI */}
              <div className="bg-background/50 rounded-lg p-5 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Analisi Professionale AI
                    </h3>
                  </div>
                  {!currentAnalysis && !loadingAnalysis && (
                    <button
                      onClick={handleGenerateAnalysis}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-white font-medium transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      Genera Analisi
                    </button>
                  )}
                </div>

                <>
                  {/* Loading State */}
                  {loadingAnalysis && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-3" />
                      <p className="text-gray-400 text-sm">Generazione analisi professionale in corso...</p>
                      <p className="text-gray-500 text-xs mt-2">Questo potrebbe richiedere alcuni secondi</p>
                    </div>
                  )}

                  {/* Error State */}
                  {analysisError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-red-400 font-medium">Errore</p>
                          <p className="text-red-300 text-sm mt-1">{analysisError}</p>
                          <button
                            onClick={handleGenerateAnalysis}
                            className="mt-3 text-red-400 hover:text-red-300 text-sm underline"
                          >
                            Riprova
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analisi Generata */}
                  {currentAnalysis && !loadingAnalysis && (
                    <div className="space-y-6">
                      {/* Strategia Consigliata */}
                      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-white mb-1">{currentAnalysis.recommendedStrategy.name}</h4>
                            <p className="text-gray-300 text-sm">{currentAnalysis.recommendedStrategy.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getPatternColor(currentAnalysis.recommendedStrategy.timing)}`}>
                              {getTimingLabel(currentAnalysis.recommendedStrategy.timing)}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-gray-400 text-xs">Probabilità</p>
                                <p className="text-white font-bold text-lg">{currentAnalysis.recommendedStrategy.probability}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-gray-400 text-xs">Confidence</p>
                                <p className="text-white font-bold text-lg">{currentAnalysis.recommendedStrategy.confidence}%</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reasoning Professionale */}
                      <div className="bg-background/30 rounded-lg p-5 border border-border/30">
                        <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                          <Target className="w-5 h-5 text-blue-400" />
                          Analisi Professionale
                        </h4>
                        <div className="prose prose-invert max-w-none">
                          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                            {currentAnalysis.reasoning}
                          </p>
                        </div>
                      </div>

                      {/* Consigli Betfair */}
                      <div className="bg-background/30 rounded-lg p-5 border border-border/30">
                        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-400" />
                          Consigli Operativi Betfair Exchange
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm mb-1">Market</p>
                            <p className="text-white font-semibold">{currentAnalysis.betfairAdvice.market}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm mb-1">Timing Entrata</p>
                            <p className="text-white font-semibold">{currentAnalysis.betfairAdvice.entryTiming}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm mb-1">Strategia Uscita</p>
                            <p className="text-white font-semibold">{currentAnalysis.betfairAdvice.exitStrategy}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm mb-1">Livello Rischio</p>
                            <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getRiskColor(currentAnalysis.betfairAdvice.riskLevel)}`}>
                              {currentAnalysis.betfairAdvice.riskLevel}
                            </span>
                          </div>
                          {currentAnalysis.betfairAdvice.stakeSuggestion && (
                            <div className="md:col-span-2">
                              <p className="text-gray-400 text-sm mb-1">Suggerimento Stake</p>
                              <p className="text-white font-semibold">{currentAnalysis.betfairAdvice.stakeSuggestion}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fattori Chiave */}
                      {currentAnalysis.keyFactors && currentAnalysis.keyFactors.length > 0 && (
                        <div className="bg-background/30 rounded-lg p-5 border border-border/30">
                          <h4 className="text-lg font-bold text-white mb-3">Fattori Chiave</h4>
                          <ul className="space-y-2">
                            {currentAnalysis.keyFactors.map((factor, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Avvertimenti */}
                      {currentAnalysis.warnings && currentAnalysis.warnings.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-5">
                          <h4 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Avvertimenti
                          </h4>
                          <ul className="space-y-2">
                            {currentAnalysis.warnings.map((warning, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-yellow-300 text-sm">
                                <span className="text-yellow-400 mt-1">⚠</span>
                                <span>{warning}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Strategie Alternative */}
                      {currentAnalysis.alternativeStrategies && currentAnalysis.alternativeStrategies.length > 0 && (
                        <div className="bg-background/30 rounded-lg p-5 border border-border/30">
                          <h4 className="text-lg font-bold text-white mb-3">Strategie Alternative</h4>
                          <div className="space-y-4">
                            {currentAnalysis.alternativeStrategies.map((alt, idx) => (
                              <div key={idx} className="bg-background/50 rounded p-4 border border-border/20">
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="text-white font-semibold">{alt.name}</h5>
                                  <span className="text-gray-400 text-sm">{alt.probability}% probabilità</span>
                                </div>
                                <p className="text-gray-300 text-sm mb-2">{alt.description}</p>
                                <p className="text-gray-400 text-xs">{alt.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bottone per rigenerare */}
                      <div className="flex justify-center pt-4 border-t border-border/30">
                        <button
                          onClick={handleGenerateAnalysis}
                          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Rigenera Analisi
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty State - Mostra anche predizioni API se disponibili */}
                  {!currentAnalysis && !loadingAnalysis && !analysisError && selectedMatch.stats.predictions && (
                    <div className="space-y-3 pt-4 border-t border-border/30">
                      <p className="text-gray-400 text-sm mb-3">Predizioni API-Football:</p>
                      {selectedMatch.stats.predictions.winner && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Vincitore Previsto</p>
                          <p className="text-white font-semibold">{selectedMatch.stats.predictions.winner.name}</p>
                          {selectedMatch.stats.predictions.winner.comment && (
                            <p className="text-gray-400 text-xs mt-1">{selectedMatch.stats.predictions.winner.comment}</p>
                          )}
                        </div>
                      )}
                      {selectedMatch.stats.predictions.goals && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Risultato Previsto</p>
                          <p className="text-white font-semibold">
                            {selectedMatch.stats.predictions.goals.home} - {selectedMatch.stats.predictions.goals.away}
                          </p>
                        </div>
                      )}
                      {selectedMatch.stats.predictions.under_over && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Over/Under</p>
                          <p className="text-white font-semibold">{selectedMatch.stats.predictions.under_over}</p>
                        </div>
                      )}
                      {selectedMatch.stats.predictions.btts !== undefined && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Entrambe Segnano</p>
                          <p className="text-white font-semibold">{selectedMatch.stats.predictions.btts ? 'Sì' : 'No'}</p>
                        </div>
                      )}
                      {selectedMatch.stats.predictions.advice && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-blue-400 text-sm font-medium">💡 Consiglio</p>
                          <p className="text-white text-sm mt-1">{selectedMatch.stats.predictions.advice}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && matches.length === 0 && !error && (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2 text-lg">
            Nessuna partita caricata
          </p>
          <p className="text-sm text-gray-500">
            Clicca il pulsante sopra per caricare le partite di oggi prefiltrate
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyPlan;
