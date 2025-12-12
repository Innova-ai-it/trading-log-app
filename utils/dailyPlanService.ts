// utils/dailyPlanService.ts

export const TOP_LEAGUE_IDS = [
  39, 140, 135, 78, 61, 263, 94, 866, 88, 40, 144, 128, 180, 169, 98, 236, 203, 233, 136,
  2, 3, 848, 15
];

export interface MatchPreMatchStats {
  homeTeam: {
    name: string;
    id: number;
    avgGoalsFor: number;
    avgGoalsAgainst: number;
    goalsFH: number; // Goal primo tempo ultimi 5
    goalsSH: number; // Goal secondo tempo ultimi 5
    scoringPattern: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
    form: string[]; // Ultimi 5 risultati (W/D/L)
    xGFirstHalfAvg: number;
    // Nuovi dati
    position?: number; // Posizione in classifica
    points?: number; // Punti in classifica
    goalDifference?: number; // Differenza reti
    injuries?: string[]; // Lista infortuni/squalifiche
  };
  awayTeam: {
    name: string;
    id: number;
    avgGoalsFor: number;
    avgGoalsAgainst: number;
    goalsFH: number;
    goalsSH: number;
    scoringPattern: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
    form: string[];
    xGFirstHalfAvg: number;
    // Nuovi dati
    position?: number;
    points?: number;
    goalDifference?: number;
    injuries?: string[];
  };
  match: {
    id: number;
    leagueId: number;
    leagueName: string;
    date: string;
    time: string;
    venue?: string;
  };
  combined: {
    avgGoalsPerMatch: number;
    goalsFirstHalf: number; // Combinato ultimi 5
    goalsSecondHalf: number;
    scoringPattern: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
    xGFirstHalfAvg: number;
  };
  // Nuovi dati aggiuntivi
  headToHead?: {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    homeAvgGoals: number;
    awayAvgGoals: number;
    recentMatches: Array<{
      date: string;
      homeScore: number;
      awayScore: number;
      result: string; // "W", "D", "L" per home team
    }>;
  };
  odds?: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    btts: number;
  };
  predictions?: {
    winner?: {
      id: number;
      name: string;
      comment: string;
    };
    under_over?: string; // "over 2.5" o "under 2.5"
    goals?: {
      home: number;
      away: number;
    };
    btts?: boolean;
    advice?: string;
  };
}

export interface TodayMatch {
  fixture: {
    id: number;
    date: string;
    timezone: string;
    venue?: {
      name: string;
      city: string;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
}

/**
 * Recupera tutte le partite del giorno per i top campionati
 */
export async function fetchTodayMatches(): Promise<TodayMatch[]> {
  const apiKey = import.meta.env.VITE_FOOTBALL_API_KEY;
  const provider = import.meta.env.VITE_FOOTBALL_API_PROVIDER || 'api-football';

  if (!apiKey || provider === 'mock') {
    throw new Error('API key non configurata. Configura VITE_FOOTBALL_API_KEY nel file .env');
  }

  // Usa la data locale invece di UTC per evitare problemi di fuso orario
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in locale

  console.log('🔍 Cercando tutte le partite per la data:', dateStr);
  console.log('📅 Data locale completa:', today.toLocaleString('it-IT'));

  try {
    // 1. Recupera TUTTE le partite del giorno (senza filtro league)
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${dateStr}`;
    console.log(`📡 Richiesta tutte le partite: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `Status ${response.status}`;
      }
      throw new Error(`Errore API (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log(`📊 Risposta API:`, {
      hasResponse: !!data.response,
      responseType: typeof data.response,
      isArray: Array.isArray(data.response),
      totalMatches: data.response?.length || 0
    });

    if (!data.response || !Array.isArray(data.response)) {
      console.warn('⚠️ Risposta inattesa:', data);
      return [];
    }

    const allMatches = data.response;
    console.log(`✅ Trovate ${allMatches.length} partite totali per ${dateStr}`);

    // 2. Filtra solo le partite dei top campionati
    const filteredMatches = allMatches.filter((match: any) => 
      TOP_LEAGUE_IDS.includes(match.league?.id)
    );

    console.log(`🎯 Partite filtrate per top campionati: ${filteredMatches.length} su ${allMatches.length}`);

    // Mostra un esempio delle partite trovate
    if (filteredMatches.length > 0) {
      const sampleMatches = filteredMatches.slice(0, 5).map((m: any) => ({
        league: m.league?.name,
        leagueId: m.league?.id,
        match: `${m.teams?.home?.name} vs ${m.teams?.away?.name}`,
        time: m.fixture?.date ? new Date(m.fixture.date).toLocaleTimeString('it-IT') : 'N/A'
      }));
      console.log('📋 Esempio partite filtrate:', sampleMatches);
    } else {
      console.warn('⚠️ Nessuna partita trovata nei top campionati');
      // Mostra quali league sono presenti nelle partite totali per debug
      const leaguesInMatches = [...new Set(allMatches.map((m: any) => m.league?.id).filter(Boolean))];
      console.log(`ℹ️ League presenti nelle partite totali (prime 10):`, leaguesInMatches.slice(0, 10));
      console.log(`ℹ️ Top league IDs cercati:`, TOP_LEAGUE_IDS.slice(0, 10));
    }

    return filteredMatches;

  } catch (error: any) {
    console.error('❌ Errore recupero partite:', error);
    throw error;
  }
}

/**
 * Recupera statistiche pre-match complete per una partita (versione ottimizzata)
 */
export async function fetchPreMatchStats(match: TodayMatch): Promise<MatchPreMatchStats> {
  const apiKey = import.meta.env.VITE_FOOTBALL_API_KEY;
  const currentSeason = new Date().getFullYear();

  // Usa endpoint più efficienti: statistiche stagionali invece di ultimi 5 match
  // Promise.all esegue le chiamate in parallelo (più veloce)
  const [homeTeamStats, awayTeamStats] = await Promise.all([
    fetchTeamSeasonStats(match.teams.home.id, match.league.id, currentSeason, apiKey),
    fetchTeamSeasonStats(match.teams.away.id, match.league.id, currentSeason, apiKey)
  ]);

  // Recupera dati aggiuntivi in parallelo (con fallback se falliscono)
  const [standings, h2h, injuries, odds, predictions] = await Promise.allSettled([
    fetchStandings(match.league.id, currentSeason, apiKey),
    fetchHeadToHead(match.teams.home.id, match.teams.away.id, apiKey),
    fetchInjuries(match.teams.home.id, match.teams.away.id, apiKey),
    fetchOdds(match.fixture.id, apiKey),
    fetchPredictions(match.fixture.id, apiKey)
  ]);

  // Estrai dati standings per home e away
  const homeStanding = standings.status === 'fulfilled' 
    ? standings.value.find((s: any) => s.team.id === match.teams.home.id)
    : null;
  const awayStanding = standings.status === 'fulfilled'
    ? standings.value.find((s: any) => s.team.id === match.teams.away.id)
    : null;

  // Estrai infortuni
  const homeInjuries = injuries.status === 'fulfilled' ? injuries.value.home : [];
  const awayInjuries = injuries.status === 'fulfilled' ? injuries.value.away : [];

  // Calcola statistiche combinate
  const combinedGoalsFH = homeTeamStats.goalsFH + awayTeamStats.goalsFH;
  const combinedGoalsSH = homeTeamStats.goalsSH + awayTeamStats.goalsSH;
  const scoringPattern = 
    combinedGoalsFH > combinedGoalsSH ? 'FIRST_HALF' :
    combinedGoalsSH > combinedGoalsFH ? 'SECOND_HALF' : 'BALANCED';

  return {
    homeTeam: {
      name: match.teams.home.name,
      id: match.teams.home.id,
      ...homeTeamStats,
      position: homeStanding?.rank,
      points: homeStanding?.points,
      goalDifference: homeStanding?.goalsDiff,
      injuries: homeInjuries
    },
    awayTeam: {
      name: match.teams.away.name,
      id: match.teams.away.id,
      ...awayTeamStats,
      position: awayStanding?.rank,
      points: awayStanding?.points,
      goalDifference: awayStanding?.goalsDiff,
      injuries: awayInjuries
    },
    match: {
      id: match.fixture.id,
      leagueId: match.league.id,
      leagueName: match.league.name,
      date: match.fixture.date,
      time: new Date(match.fixture.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      venue: match.fixture.venue?.name
    },
    combined: {
      avgGoalsPerMatch: (homeTeamStats.avgGoalsFor + awayTeamStats.avgGoalsAgainst) / 2,
      goalsFirstHalf: combinedGoalsFH,
      goalsSecondHalf: combinedGoalsSH,
      scoringPattern,
      xGFirstHalfAvg: (homeTeamStats.xGFirstHalfAvg + awayTeamStats.xGFirstHalfAvg) / 2
    },
    headToHead: h2h.status === 'fulfilled' ? h2h.value : undefined,
    odds: odds.status === 'fulfilled' ? odds.value : undefined,
    predictions: predictions.status === 'fulfilled' ? predictions.value : undefined
  };
}

/**
 * Recupera statistiche stagionali squadra (1 chiamata invece di 5+)
 * Usa l'endpoint /v3/teams/statistics che restituisce statistiche complete
 */
async function fetchTeamSeasonStats(
  teamId: number,
  leagueId: number,
  season: number,
  apiKey: string
): Promise<{
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  goalsFH: number;
  goalsSH: number;
  scoringPattern: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
  form: string[];
  xGFirstHalfAvg: number;
}> {
  try {
    // 1 chiamata per statistiche stagionali complete
    const statsUrl = `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`;
    
    const statsResponse = await fetch(statsUrl, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!statsResponse.ok) {
      if (statsResponse.status === 429) {
        // Rate limit: aspetta e riprova una volta
        console.warn(`⏳ Rate limit per team ${teamId}, attendo 2 secondi...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Riprova
        const retryResponse = await fetch(statsUrl, {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
          }
        });
        if (!retryResponse.ok) {
          return getDefaultTeamStats();
        }
        const retryData = await retryResponse.json();
        return parseTeamStatistics(retryData.response, teamId);
      }
      return getDefaultTeamStats();
    }

    const statsData = await statsResponse.json();
    const stats = statsData.response;

    if (!stats) {
      return getDefaultTeamStats();
    }

    return parseTeamStatistics(stats, teamId);
  } catch (error) {
    console.error(`Errore statistiche stagionali team ${teamId}:`, error);
    return getDefaultTeamStats();
  }
}

/**
 * Parsing delle statistiche squadra dalla risposta API
 */
function parseTeamStatistics(stats: any, teamId: number): {
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  goalsFH: number;
  goalsSH: number;
  scoringPattern: 'FIRST_HALF' | 'SECOND_HALF' | 'BALANCED';
  form: string[];
  xGFirstHalfAvg: number;
} {
  // Helper per convertire sempre in numero
  const toNumber = (value: any, defaultValue: number = 0): number => {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? defaultValue : num;
  };

  // Estrai dati dalle statistiche stagionali - assicura sempre numeri
  const avgGoalsFor = toNumber(
    stats.goals?.for?.average?.total || 
    (stats.goals?.for?.total && stats.fixtures?.played?.total 
      ? stats.goals.for.total / stats.fixtures.played.total 
      : null),
    1.5 // default
  );
  
  const avgGoalsAgainst = toNumber(
    stats.goals?.against?.average?.total || 
    (stats.goals?.against?.total && stats.fixtures?.played?.total 
      ? stats.goals.against.total / stats.fixtures.played.total 
      : null),
    1.2 // default
  );
  
  // Calcola goal primo/secondo tempo dai dati per minuto
  let goalsFH = 0;
  let goalsSH = 0;
  
  if (stats.goals?.for?.minute) {
    const minuteData = stats.goals.for.minute;
    // Somma goal da 0-15, 16-30, 31-45 per primo tempo
    goalsFH = toNumber(minuteData['0-15']?.total, 0) + 
              toNumber(minuteData['16-30']?.total, 0) + 
              toNumber(minuteData['31-45']?.total, 0);
    // Somma goal da 46-60, 61-75, 76-90, 91-105, 106-120 per secondo tempo
    goalsSH = toNumber(minuteData['46-60']?.total, 0) + 
              toNumber(minuteData['61-75']?.total, 0) + 
              toNumber(minuteData['76-90']?.total, 0) + 
              toNumber(minuteData['91-105']?.total, 0) + 
              toNumber(minuteData['106-120']?.total, 0);
  } else {
    // Fallback: stima basata su media (40% primo tempo, 60% secondo)
    const totalGoals = toNumber(stats.goals?.for?.total, avgGoalsFor * (toNumber(stats.fixtures?.played?.total, 1)));
    goalsFH = Math.round(totalGoals * 0.4);
    goalsSH = Math.round(totalGoals * 0.6);
  }
  
  // Form: usa gli ultimi risultati disponibili
  const form = stats.form?.split('') || ['W', 'D', 'L', 'W', 'D'];
  
  const scoringPattern = 
    goalsFH > goalsSH ? 'FIRST_HALF' :
    goalsSH > goalsFH ? 'SECOND_HALF' : 'BALANCED';

  // xG proxy: usa media goal primo tempo come stima
  const matchesPlayed = toNumber(stats.fixtures?.played?.total, 1);
  const xGFirstHalfAvg = matchesPlayed > 0 ? goalsFH / matchesPlayed : 0.6;

  return {
    avgGoalsFor,
    avgGoalsAgainst,
    goalsFH,
    goalsSH,
    scoringPattern,
    form,
    xGFirstHalfAvg
  };
}

/**
 * Restituisce statistiche di default quando non è possibile recuperare dati
 */
function getDefaultTeamStats() {
  return {
    avgGoalsFor: 1.5,
    avgGoalsAgainst: 1.2,
    goalsFH: 3,
    goalsSH: 4,
    scoringPattern: 'BALANCED' as const,
    form: ['W', 'D', 'L', 'W', 'D'],
    xGFirstHalfAvg: 0.6
  };
}

/**
 * Recupera la classifica della lega
 */
async function fetchStandings(leagueId: number, season: number, apiKey: string): Promise<any[]> {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=${season}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Errore standings (${response.status})`);
      return [];
    }

    const data = await response.json();
    if (data.response && data.response[0]?.league?.standings?.[0]) {
      return data.response[0].league.standings[0];
    }
    return [];
  } catch (error) {
    console.error('Errore recupero standings:', error);
    return [];
  }
}

/**
 * Recupera Head to Head (storico confronti diretti)
 */
async function fetchHeadToHead(homeId: number, awayId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures/headtohead?h2h=${homeId}-${awayId}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Errore H2H (${response.status})`);
      return undefined;
    }

    const data = await response.json();
    if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
      return undefined;
    }

    // Prendi ultimi 5 match
    const recentMatches = data.response.slice(0, 5);
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let homeGoals = 0;
    let awayGoals = 0;

    const h2hMatches = recentMatches.map((match: any) => {
      const homeScore = match.goals?.home || 0;
      const awayScore = match.goals?.away || 0;
      homeGoals += homeScore;
      awayGoals += awayScore;

      let result = 'D';
      if (homeScore > awayScore) {
        homeWins++;
        result = 'W';
      } else if (awayScore > homeScore) {
        awayWins++;
        result = 'L';
      } else {
        draws++;
      }

      return {
        date: match.fixture?.date || '',
        homeScore,
        awayScore,
        result
      };
    });

    return {
      totalMatches: recentMatches.length,
      homeWins,
      draws,
      awayWins,
      homeAvgGoals: recentMatches.length > 0 ? homeGoals / recentMatches.length : 0,
      awayAvgGoals: recentMatches.length > 0 ? awayGoals / recentMatches.length : 0,
      recentMatches: h2hMatches
    };
  } catch (error) {
    console.error('Errore recupero H2H:', error);
    return undefined;
  }
}

/**
 * Recupera infortuni e squalifiche per entrambe le squadre
 */
async function fetchInjuries(homeId: number, awayId: number, apiKey: string) {
  try {
    const [homeResponse, awayResponse] = await Promise.all([
      fetch(`https://api-football-v1.p.rapidapi.com/v3/injuries?team=${homeId}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }),
      fetch(`https://api-football-v1.p.rapidapi.com/v3/injuries?team=${awayId}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })
    ]);

    const homeInjuries: string[] = [];
    const awayInjuries: string[] = [];

    if (homeResponse.ok) {
      const homeData = await homeResponse.json();
      if (homeData.response && Array.isArray(homeData.response)) {
        homeData.response.forEach((injury: any) => {
          if (injury.player?.name && injury.player?.reason) {
            homeInjuries.push(`${injury.player.name} (${injury.player.reason})`);
          }
        });
      }
    }

    if (awayResponse.ok) {
      const awayData = await awayResponse.json();
      if (awayData.response && Array.isArray(awayData.response)) {
        awayData.response.forEach((injury: any) => {
          if (injury.player?.name && injury.player?.reason) {
            awayInjuries.push(`${injury.player.name} (${injury.player.reason})`);
          }
        });
      }
    }

    return { home: homeInjuries, away: awayInjuries };
  } catch (error) {
    console.error('Errore recupero infortuni:', error);
    return { home: [], away: [] };
  }
}

/**
 * Recupera quote pre-partita
 */
async function fetchOdds(fixtureId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/odds?fixture=${fixtureId}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Errore odds (${response.status})`);
      return undefined;
    }

    const data = await response.json();
    if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
      return undefined;
    }

    // Prendi il primo bookmaker (di solito il più affidabile)
    const bookmaker = data.response[0]?.bookmakers?.[0];
    if (!bookmaker) {
      return undefined;
    }

    const odds: any = {};
    bookmaker.bets?.forEach((bet: any) => {
      if (bet.id === 1) { // Match Winner (1X2)
        bet.values?.forEach((value: any) => {
          if (value.value === 'Home') odds.home = parseFloat(value.odd);
          if (value.value === 'Draw') odds.draw = parseFloat(value.odd);
          if (value.value === 'Away') odds.away = parseFloat(value.odd);
        });
      }
      if (bet.id === 5) { // Over/Under 2.5
        bet.values?.forEach((value: any) => {
          if (value.value === 'Over 2.5') odds.over25 = parseFloat(value.odd);
          if (value.value === 'Under 2.5') odds.under25 = parseFloat(value.odd);
        });
      }
      if (bet.id === 8) { // Both Teams To Score
        bet.values?.forEach((value: any) => {
          if (value.value === 'Yes') odds.btts = parseFloat(value.odd);
        });
      }
    });

    return Object.keys(odds).length > 0 ? odds : undefined;
  } catch (error) {
    console.error('Errore recupero odds:', error);
    return undefined;
  }
}

/**
 * Recupera predizioni AI
 */
async function fetchPredictions(fixtureId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/predictions?fixture=${fixtureId}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Errore predictions (${response.status})`);
      return undefined;
    }

    const data = await response.json();
    if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
      return undefined;
    }

    const prediction = data.response[0];
    return {
      winner: prediction.winner ? {
        id: prediction.winner.id,
        name: prediction.winner.name,
        comment: prediction.winner.comment || ''
      } : undefined,
      under_over: prediction.under_over || undefined,
      goals: prediction.goals ? {
        home: prediction.goals.home,
        away: prediction.goals.away
      } : undefined,
      btts: prediction.btts ? prediction.btts === 'Yes' : undefined,
      advice: prediction.advice || undefined
    };
  } catch (error) {
    console.error('Errore recupero predictions:', error);
    return undefined;
  }
}

