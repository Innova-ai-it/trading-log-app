// utils/aiPlanGenerator.ts

import { MatchPreMatchStats } from './dailyPlanService';
import { UserStrategy } from '../types';

export interface StrategyScore {
  strategyId: string;
  strategyName: string;
  score: number; // 0-100
  reasoning: string;
}

export interface MatchAnalysis {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  bestStrategy: {
    strategyId: string;
    strategyName: string;
    confidence: number; // 0-100
    reasoning: string;
  };
  allScores: StrategyScore[];
}

export interface GeneratedPlan {
  planText: string; // Piano in formato testo
  matches: MatchAnalysis[];
  topMatches: MatchAnalysis[]; // Top 3-5
}

/**
 * Genera piano di trading giornaliero usando OpenAI
 */
export async function generateDailyPlan(
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>,
  strategies: UserStrategy[]
): Promise<GeneratedPlan> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurata. Configura VITE_OPENAI_API_KEY nel file .env');
  }

  // Prepara il prompt per OpenAI
  const prompt = buildAnalysisPrompt(matchesWithStats, strategies);

  // Chiama OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview', // Usa gpt-4-turbo-preview per analisi complesse
      messages: [
        {
          role: 'system',
          content: `Sei un esperto analista di trading sportivo specializzato in calcio. Il tuo compito è analizzare partite di calcio e assegnare strategie di trading basate su statistiche pre-match dettagliate. 

Devi essere:
- Preciso e analitico
- Basarti esclusivamente sui dati forniti
- Fornire raccomandazioni operative chiare e dettagliate
- Assegnare punteggi da 0 a 100 basandoti sulla pertinenza statistica
- Fornire reasoning dettagliato per ogni valutazione

Il formato delle raccomandazioni deve essere simile a questo esempio:
"Consiglio un ingresso sugli Over 1.5 primo tempo, entrando ad ogni mezzo punto di distanza, in caso di nessun goal alla mezz'ora uscire ed aprire un back sugli over 0.5 primo tempo."

Oppure:
"Consiglio un ingresso in Both Teams to Score, in caso di goal primo tempo togliere 50% di rischio e restare a mercato."

Le raccomandazioni devono essere operative, con entry points, exit conditions e gestione del rischio.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  let aiResponse;
  
  try {
    aiResponse = JSON.parse(data.choices[0].message.content);
  } catch (parseError) {
    // Se la risposta non è JSON valido, prova a estrarre JSON dal testo
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResponse = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Risposta AI non valida: formato JSON non trovato');
    }
  }

  // Processa risposta AI
  const matches: MatchAnalysis[] = aiResponse.matches || [];
  
  // Ordina per confidence e seleziona top 3-5
  const sortedMatches = [...matches].sort((a, b) => 
    b.bestStrategy.confidence - a.bestStrategy.confidence
  );
  const topMatches = sortedMatches.slice(0, Math.min(5, Math.max(3, sortedMatches.length)));

  // Genera piano in formato testo
  const planText = generatePlanText(topMatches, matchesWithStats);

  return {
    planText,
    matches,
    topMatches
  };
}

/**
 * Costruisce il prompt per OpenAI
 */
function buildAnalysisPrompt(
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>,
  strategies: UserStrategy[]
): string {
  const strategiesText = strategies.map(s => {
    const parsed = s.parsedData || {};
    return `
STRATEGIA ID: ${s.id}
NOME: ${s.name}
${s.description ? `DESCRIZIONE: ${s.description}` : ''}
CONTENUTO COMPLETO:
${s.content}
${s.parsedData ? `DATI STRUTTURATI: ${JSON.stringify(parsed, null, 2)}` : ''}
`;
  }).join('\n\n---\n\n');

  // Helper per formattare numeri in modo sicuro
  const safeNumber = (value: any, decimals: number = 2, defaultValue: string = '0.00'): string => {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? defaultValue : num.toFixed(decimals);
  };

  const matchesText = matchesWithStats.map(({ match, stats }) => {
    return `
PARTITA ID: ${stats.match.id}
${stats.homeTeam.name} vs ${stats.awayTeam.name}
Lega: ${stats.match.leagueName}
Orario: ${stats.match.time}
Data: ${stats.match.date}

STATISTICHE HOME TEAM (${stats.homeTeam.name}):
- Media goal fatti: ${safeNumber(stats.homeTeam.avgGoalsFor)}
- Media goal subiti: ${safeNumber(stats.homeTeam.avgGoalsAgainst)}
- Goal primo tempo (ultimi 5 match): ${stats.homeTeam.goalsFH || 0}
- Goal secondo tempo (ultimi 5 match): ${stats.homeTeam.goalsSH || 0}
- Pattern segnatura: ${stats.homeTeam.scoringPattern || 'BALANCED'}
- Form ultimi 5 match: ${(stats.homeTeam.form || []).join(' ') || 'N/A'}
- xG primo tempo medio: ${safeNumber(stats.homeTeam.xGFirstHalfAvg)}

STATISTICHE AWAY TEAM (${stats.awayTeam.name}):
- Media goal fatti: ${safeNumber(stats.awayTeam.avgGoalsFor)}
- Media goal subiti: ${safeNumber(stats.awayTeam.avgGoalsAgainst)}
- Goal primo tempo (ultimi 5 match): ${stats.awayTeam.goalsFH || 0}
- Goal secondo tempo (ultimi 5 match): ${stats.awayTeam.goalsSH || 0}
- Pattern segnatura: ${stats.awayTeam.scoringPattern || 'BALANCED'}
- Form ultimi 5 match: ${(stats.awayTeam.form || []).join(' ') || 'N/A'}
- xG primo tempo medio: ${safeNumber(stats.awayTeam.xGFirstHalfAvg)}

STATISTICHE COMBINATE:
- Media goal per partita: ${safeNumber(stats.combined.avgGoalsPerMatch)}
- Goal primo tempo combinati (ultimi 5): ${stats.combined.goalsFirstHalf || 0}
- Goal secondo tempo combinati (ultimi 5): ${stats.combined.goalsSecondHalf || 0}
- Pattern combinato: ${stats.combined.scoringPattern || 'BALANCED'}
- xG primo tempo medio combinato: ${safeNumber(stats.combined.xGFirstHalfAvg)}
`;
  }).join('\n\n==========\n\n');

  return `
Analizza le seguenti partite di calcio e assegna per ciascuna la strategia di trading più adatta.

STRATEGIE DISPONIBILI:
${strategiesText}

PARTITE CON STATISTICHE PRE-MATCH:
${matchesText}

ISTRUZIONI DETTAGLIATE:
1. Per OGNI partita, analizza TUTTE le strategie disponibili una per una
2. Assegna un punteggio da 0 a 100 a ciascuna strategia basandoti su:
   - Quanto le statistiche pre-match si allineano con i requisiti della strategia
   - La pertinenza della strategia per questo tipo di match e queste squadre
   - La qualità e affidabilità dei dati disponibili
   - La probabilità di successo basata sui pattern storici
3. Seleziona la strategia con punteggio più alto come "bestStrategy"
4. La confidence del bestStrategy deve essere il punteggio più alto
5. Fornisci un reasoning dettagliato e operativo per ogni punteggio, spiegando PERCHÉ quella strategia è adatta o meno
6. Per il bestStrategy, fornisci un reasoning che includa:
   - Perché questa strategia è la migliore
   - Entry points suggeriti
   - Exit conditions
   - Gestione del rischio

FORMATO RISPOSTA JSON (STRICTO):
{
  "matches": [
    {
      "matchId": 12345,
      "homeTeam": "Juventus",
      "awayTeam": "Pafos",
      "league": "UEFA Champions League",
      "time": "21:00",
      "bestStrategy": {
        "strategyId": "uuid-strategia",
        "strategyName": "Over 0.5 First Half",
        "confidence": 85,
        "reasoning": "Entrambe le squadre segnano spesso nel primo tempo (Juventus 4 goal FH ultimi 5, Pafos 3 goal FH). Pattern combinato FIRST_HALF. Consiglio un ingresso sugli Over 1.5 primo tempo, entrando ad ogni mezzo punto di distanza, in caso di nessun goal alla mezz'ora uscire ed aprire un back sugli over 0.5 primo tempo."
      },
      "allScores": [
        {
          "strategyId": "uuid-1",
          "strategyName": "Over 0.5 FH",
          "score": 85,
          "reasoning": "Statistiche molto favorevoli: entrambe le squadre segnano spesso nel primo tempo..."
        },
        {
          "strategyId": "uuid-2",
          "strategyName": "BTTS",
          "score": 60,
          "reasoning": "Media goal combinata buona ma non eccezionale..."
        }
      ]
    }
  ]
}

IMPORTANTE: 
- Restituisci SOLO JSON valido, senza testo aggiuntivo prima o dopo
- Assicurati che tutti i matchId corrispondano a quelli nelle partite fornite
- Assicurati che tutti gli strategyId corrispondano a quelli nelle strategie fornite
- Il reasoning deve essere dettagliato e operativo
`;
}

/**
 * Genera piano in formato testo leggibile
 */
function generatePlanText(
  topMatches: MatchAnalysis[],
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>
): string {
  const today = new Date();
  let plan = `📅 PIANO DI TRADING GIORNALIERO\n`;
  plan += `Data: ${today.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
  plan += `Partite selezionate: ${topMatches.length}\n\n`;
  plan += `═══════════════════════════════════════\n\n`;

  for (const matchAnalysis of topMatches) {
    const matchData = matchesWithStats.find(m => 
      m.stats.match.id === matchAnalysis.matchId
    );

    if (!matchData) continue;

    const { stats } = matchData;
    const time = new Date(stats.match.date).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    plan += `⏳ ${time} - ${stats.homeTeam.name} vs ${stats.awayTeam.name}\n`;
    plan += `📊 ${stats.match.leagueName}\n\n`;
    plan += `Staking Plan: 3%\n\n`;

    // Helper per formattare numeri in modo sicuro
    const safeNumber = (value: any, decimals: number = 2): string => {
      if (value === null || value === undefined) return '0.00';
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? '0.00' : num.toFixed(decimals);
    };

    // Analisi match
    plan += `ANALISI:\n`;
    plan += `${stats.homeTeam.name} ha una media di ${safeNumber(stats.homeTeam.avgGoalsFor)} goal fatti e ${safeNumber(stats.homeTeam.avgGoalsAgainst)} subiti. `;
    plan += `Negli ultimi 5 match ha segnato ${stats.homeTeam.goalsFH || 0} goal nel primo tempo e ${stats.homeTeam.goalsSH || 0} nel secondo. `;
    plan += `Pattern di segnatura: ${stats.homeTeam.scoringPattern === 'FIRST_HALF' ? 'primo tempo' : stats.homeTeam.scoringPattern === 'SECOND_HALF' ? 'secondo tempo' : 'bilanciato'}. `;
    plan += `Forma recente: ${(stats.homeTeam.form || []).join(' ') || 'N/A'}.\n\n`;
    
    plan += `${stats.awayTeam.name} ha una media di ${safeNumber(stats.awayTeam.avgGoalsFor)} goal fatti e ${safeNumber(stats.awayTeam.avgGoalsAgainst)} subiti. `;
    plan += `Negli ultimi 5 match ha segnato ${stats.awayTeam.goalsFH || 0} goal nel primo tempo e ${stats.awayTeam.goalsSH || 0} nel secondo. `;
    plan += `Pattern di segnatura: ${stats.awayTeam.scoringPattern === 'FIRST_HALF' ? 'primo tempo' : stats.awayTeam.scoringPattern === 'SECOND_HALF' ? 'secondo tempo' : 'bilanciato'}. `;
    plan += `Forma recente: ${(stats.awayTeam.form || []).join(' ') || 'N/A'}.\n\n`;

    plan += `Statistiche combinate: media di ${safeNumber(stats.combined.avgGoalsPerMatch)} goal per partita, `;
    plan += `${stats.combined.goalsFirstHalf || 0} goal nel primo tempo e ${stats.combined.goalsSecondHalf || 0} nel secondo tempo negli ultimi 5 match combinati.\n\n`;

    plan += `CONSIGLIO:\n`;
    plan += `${matchAnalysis.bestStrategy.reasoning}\n\n`;
    plan += `Strategia consigliata: ${matchAnalysis.bestStrategy.strategyName}\n`;
    plan += `Confidence: ${matchAnalysis.bestStrategy.confidence}%\n\n`;

    plan += `═══════════════════════════════════════\n\n`;
  }

  plan += `\nNota: Questo piano è stato generato automaticamente basandosi su analisi statistica e strategie personalizzate. `;
  plan += `Valuta sempre le condizioni di mercato in tempo reale prima di eseguire i trade.\n`;

  return plan;
}

