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
 * Sistema di rate limiting globale per gestire le chiamate API
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelay = 1000; // 1 secondo minimo tra le chiamate
  private maxDelay = 5000; // 5 secondi massimo in caso di rate limit

  async execute<T>(fn: () => Promise<T>, priority: 'high' | 'low' = 'low'): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (priority === 'high') {
        this.queue.unshift(task); // Aggiungi in cima per priorità alta
      } else {
        this.queue.push(task); // Aggiungi in fondo per priorità bassa
      }

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      // Calcola delay basato su quanto tempo è passato dall'ultima richiesta
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const delay = Math.max(0, this.minDelay - timeSinceLastRequest);

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      this.lastRequestTime = Date.now();
      await task();
    }

    this.processing = false;
  }

  async waitAfterRateLimit(): Promise<void> {
    // Aspetta più a lungo dopo un rate limit
    await new Promise(resolve => setTimeout(resolve, this.maxDelay));
  }
}

const rateLimiter = new RateLimiter();

/**
 * Wrapper per fetch con retry e backoff esponenziale
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        // Rate limit: backoff esponenziale
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`⏳ Rate limit (tentativo ${attempt + 1}/${maxRetries}), attendo ${delay}ms...`);
        await rateLimiter.waitAfterRateLimit();
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Riprova
      }

      // Altri errori: non riprovare
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Errori server: riprova
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached');
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

  // PRIORITÀ ALTA: Statistiche squadre (essenziali) - sequenziali per evitare rate limit
  const homeTeamStats = await rateLimiter.execute(
    () => fetchTeamSeasonStats(match.teams.home.id, match.league.id, currentSeason, apiKey),
    'high'
  );
  
  const awayTeamStats = await rateLimiter.execute(
    () => fetchTeamSeasonStats(match.teams.away.id, match.league.id, currentSeason, apiKey),
    'high'
  );

  // PRIORITÀ BASSA: Dati aggiuntivi (non essenziali) - sequenziali
  const standings = await rateLimiter.execute(
    () => fetchStandings(match.league.id, currentSeason, apiKey).catch(() => []),
    'low'
  );

  const h2h = await rateLimiter.execute(
    () => fetchHeadToHead(match.teams.home.id, match.teams.away.id, apiKey).catch(() => undefined),
    'low'
  );

  const injuries = await rateLimiter.execute(
    () => fetchInjuries(match.teams.home.id, match.teams.away.id, apiKey).catch(() => ({ home: [], away: [] })),
    'low'
  );

  const odds = await rateLimiter.execute(
    () => fetchOdds(match.fixture.id, apiKey).catch(() => undefined),
    'low'
  );

  const predictions = await rateLimiter.execute(
    () => fetchPredictions(match.fixture.id, apiKey).catch(() => undefined),
    'low'
  );

  // Estrai dati standings per home e away
  const homeStanding = Array.isArray(standings)
    ? standings.find((s: any) => s.team.id === match.teams.home.id)
    : null;
  const awayStanding = Array.isArray(standings)
    ? standings.find((s: any) => s.team.id === match.teams.away.id)
    : null;

  // Estrai infortuni
  const homeInjuries = injuries?.home || [];
  const awayInjuries = injuries?.away || [];

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
    headToHead: h2h,
    odds: odds,
    predictions: predictions
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
    const statsUrl = `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`;
    
    console.log(`📡 [Team ${teamId}] Richiesta statistiche: ${statsUrl}`);
    
    const statsResponse = await fetchWithRetry(statsUrl, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const statsData = await statsResponse.json();
    
    // Debug: verifica struttura risposta
    if (!statsData.response) {
      console.error(`❌ [Team ${teamId}] Risposta API senza campo 'response':`, statsData);
      return getDefaultTeamStats();
    }
    
    const stats = statsData.response;
    
    // Verifica che stats sia un oggetto valido
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
      console.error(`❌ [Team ${teamId}] Stats non valido:`, stats);
      return getDefaultTeamStats();
    }

    return parseTeamStatistics(stats, teamId);
  } catch (error) {
    console.error(`❌ [Team ${teamId}] Errore statistiche stagionali:`, error);
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

  // Debug: log della struttura dati ricevuta
  console.log(`🔍 [Team ${teamId}] Struttura dati ricevuta:`, {
    hasGoalsFor: !!stats.goals?.for,
    hasMinuteData: !!stats.goals?.for?.minute,
    hasAverage: !!stats.goals?.for?.average,
    hasTotal: !!stats.goals?.for?.total,
    hasFixtures: !!stats.fixtures?.played
  });

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
  
  if (stats.goals?.for?.minute && typeof stats.goals.for.minute === 'object') {
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
    
    console.log(`✅ [Team ${teamId}] Goal estratti da minute data: FH=${goalsFH}, SH=${goalsSH}`);
  } else {
    // Fallback: stima basata su media (40% primo tempo, 60% secondo)
    const matchesPlayed = toNumber(stats.fixtures?.played?.total, 1);
    const totalGoals = toNumber(stats.goals?.for?.total, avgGoalsFor * matchesPlayed);
    goalsFH = Math.round(totalGoals * 0.4);
    goalsSH = Math.round(totalGoals * 0.6);
    
    console.warn(`⚠️ [Team ${teamId}] Usando fallback per goal: FH=${goalsFH}, SH=${goalsSH} (total=${totalGoals}, matches=${matchesPlayed})`);
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
    const response = await fetchWithRetry(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const data = await response.json();
    if (data.response && data.response[0]?.league?.standings?.[0]) {
      return data.response[0].league.standings[0];
    }
    return [];
  } catch (error) {
    console.warn(`⚠️ Errore standings:`, error);
    return [];
  }
}

/**
 * Recupera Head to Head (storico confronti diretti)
 */
async function fetchHeadToHead(homeId: number, awayId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures/headtohead?h2h=${homeId}-${awayId}`;
    const response = await fetchWithRetry(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

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
    console.warn(`⚠️ Errore H2H:`, error);
    return undefined;
  }
}

/**
 * Recupera infortuni e squalifiche per entrambe le squadre
 */
async function fetchInjuries(homeId: number, awayId: number, apiKey: string) {
  try {
    // Sequenziali invece di paralleli per evitare rate limit
    const homeResponse = await fetchWithRetry(
      `https://api-football-v1.p.rapidapi.com/v3/injuries?team=${homeId}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }
    );

    const awayResponse = await fetchWithRetry(
      `https://api-football-v1.p.rapidapi.com/v3/injuries?team=${awayId}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }
    );

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
    console.warn(`⚠️ Errore recupero infortuni:`, error);
    return { home: [], away: [] };
  }
}

/**
 * Recupera quote pre-partita
 */
async function fetchOdds(fixtureId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/odds?fixture=${fixtureId}`;
    const response = await fetchWithRetry(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

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
    console.warn(`⚠️ Errore recupero odds:`, error);
    return undefined;
  }
}

/**
 * Recupera predizioni AI
 */
async function fetchPredictions(fixtureId: number, apiKey: string) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/predictions?fixture=${fixtureId}`;
    const response = await fetchWithRetry(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

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
    console.warn(`⚠️ Errore recupero predictions:`, error);
    return undefined;
  }
}

