import React, { useState } from 'react';
import { fetchTodayMatches, fetchPreMatchStats, MatchPreMatchStats } from '../utils/dailyPlanService';
import { Loader2, Calendar, TrendingUp, X, Clock, AlertCircle } from 'lucide-react';

interface MatchWithStats {
  match: any;
  stats: MatchPreMatchStats;
}

const DailyPlan: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchWithStats[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      // 2. Recupera statistiche per ogni partita
      const matchesWithStats: MatchWithStats[] = [];
      
      console.log(`📊 Processando statistiche per ${todayMatches.length} partite`);
      
      for (let i = 0; i < todayMatches.length; i++) {
        const match = todayMatches[i];
        try {
          console.log(`📈 [${i + 1}/${todayMatches.length}] Recupero statistiche per ${match.teams?.home?.name} vs ${match.teams?.away?.name}`);
          
          const stats = await fetchPreMatchStats(match);
          matchesWithStats.push({ match, stats });
          
          // Pausa per evitare rate limiting
          if (i < todayMatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error: any) {
          console.error(`❌ Errore statistiche per ${match.teams?.home?.name} vs ${match.teams?.away?.name}:`, error.message || error);
          // Continua con le altre partite anche se una fallisce
        }
      }

      if (matchesWithStats.length === 0) {
        setError('Impossibile recuperare statistiche per le partite. Verifica la configurazione API.');
        setLoading(false);
        return;
      }

      setMatches(matchesWithStats);
    } catch (error: any) {
      setError(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'FIRST_HALF': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'SECOND_HALF': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'BALANCED': return 'bg-green-500/20 text-green-400 border-green-500/30';
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
            Carica le partite dei top campionati con statistiche dettagliate
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

      {/* Contatore Partite */}
      {matches.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span>{matches.length} partite caricate</span>
        </div>
      )}

      {/* Matches Grid */}
      {matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((matchWithStats) => {
            const { match, stats } = matchWithStats;
            return (
              <div
                key={stats.match.id}
                onClick={() => setSelectedMatch(matchWithStats)}
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
            Clicca il pulsante sopra per caricare le partite di oggi con statistiche dettagliate
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyPlan;
