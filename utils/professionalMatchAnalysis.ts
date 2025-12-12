// utils/professionalMatchAnalysis.ts

import { MatchPreMatchStats } from './dailyPlanService';
import { UserStrategy } from '../types';
import { supabase } from '../lib/supabase';

export interface ProfessionalMatchAnalysis {
  recommendedStrategy: {
    name: string;
    description: string;
    timing: 'FIRST_HALF' | 'SECOND_HALF' | 'FULL_MATCH' | 'LIVE_FLEXIBLE';
    probability: number; // 0-100
    confidence: number; // 0-100
  };
  reasoning: string; // Reasoning professionale dettagliato
  betfairAdvice: {
    market: string; // Es. "Over 0.5 First Half", "BTTS", "Over 2.5", etc.
    entryTiming: string; // Quando entrare (es. "Minuto 0", "Dopo primo goal", etc.)
    exitStrategy: string; // Quando uscire (es. "Al minuto 45", "Se 2-0", etc.)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    stakeSuggestion?: string; // Suggerimento stake (opzionale)
  };
  keyFactors: string[]; // Fattori chiave che supportano la strategia
  warnings?: string[]; // Avvertimenti o rischi
  alternativeStrategies?: Array<{
    name: string;
    description: string;
    probability: number;
    reasoning: string;
  }>;
}

interface MatchWithStats {
  match: any;
  stats: MatchPreMatchStats;
}

/**
 * Recupera le strategie attive dell'utente dal database
 */
async function fetchUserStrategies(userId: string): Promise<UserStrategy[]> {
  try {
    const { data, error } = await supabase
      .from('user_strategies')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('⚠️ Errore recupero strategie:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Converti in formato UserStrategy
    return data.map((s: any) => ({
      id: s.id,
      userId: s.user_id,
      name: s.name,
      description: s.description || undefined,
      content: s.content,
      parsedData: s.structured_data || undefined,
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      version: s.version
    }));
  } catch (error) {
    console.warn('⚠️ Errore recupero strategie:', error);
    return [];
  }
}

/**
 * Costruisce un prompt professionale dettagliato per l'analisi AI
 */
function buildProfessionalAnalysisPrompt(
  matchWithStats: MatchWithStats,
  userStrategies: UserStrategy[]
): string {
  const { match, stats } = matchWithStats;

  // Formatta statistiche squadra casa
  const homeTeamStats = `
**${stats.homeTeam.name}** (Casa):
- Media Goal Fatti: ${stats.homeTeam.avgGoalsFor.toFixed(2)}
- Media Goal Subiti: ${stats.homeTeam.avgGoalsAgainst.toFixed(2)}
- Rapporto Fatti/Subiti: ${(stats.homeTeam.avgGoalsFor / stats.homeTeam.avgGoalsAgainst).toFixed(2)}
- Goal Primo Tempo (ultimi 5): ${stats.homeTeam.goalsFH}
- Goal Secondo Tempo (ultimi 5): ${stats.homeTeam.goalsSH}
- Pattern: ${stats.homeTeam.scoringPattern}
- xG Primo Tempo Medio: ${stats.homeTeam.xGFirstHalfAvg.toFixed(2)}
- Form (ultimi 5): ${stats.homeTeam.form.join(' ')}
${stats.homeTeam.position ? `- Posizione Classifica: ${stats.homeTeam.position}° (${stats.homeTeam.points} punti, DR: ${stats.homeTeam.goalDifference || 0})` : ''}
${stats.homeTeam.injuries && stats.homeTeam.injuries.length > 0 ? `- ⚠️ Infortuni/Squalifiche: ${stats.homeTeam.injuries.join(', ')}` : ''}`;

  // Formatta statistiche squadra ospite
  const awayTeamStats = `
**${stats.awayTeam.name}** (Ospiti):
- Media Goal Fatti: ${stats.awayTeam.avgGoalsFor.toFixed(2)}
- Media Goal Subiti: ${stats.awayTeam.avgGoalsAgainst.toFixed(2)}
- Rapporto Fatti/Subiti: ${(stats.awayTeam.avgGoalsFor / stats.awayTeam.avgGoalsAgainst).toFixed(2)}
- Goal Primo Tempo (ultimi 5): ${stats.awayTeam.goalsFH}
- Goal Secondo Tempo (ultimi 5): ${stats.awayTeam.goalsSH}
- Pattern: ${stats.awayTeam.scoringPattern}
- xG Primo Tempo Medio: ${stats.awayTeam.xGFirstHalfAvg.toFixed(2)}
- Form (ultimi 5): ${stats.awayTeam.form.join(' ')}
${stats.awayTeam.position ? `- Posizione Classifica: ${stats.awayTeam.position}° (${stats.awayTeam.points} punti, DR: ${stats.awayTeam.goalDifference || 0})` : ''}
${stats.awayTeam.injuries && stats.awayTeam.injuries.length > 0 ? `- ⚠️ Infortuni/Squalifiche: ${stats.awayTeam.injuries.join(', ')}` : ''}`;

  // Statistiche combinate
  const combinedStats = `
**Statistiche Combinate:**
- Media Goal per Partita: ${stats.combined.avgGoalsPerMatch.toFixed(2)}
- Goal Primo Tempo Combinati: ${stats.combined.goalsFirstHalf}
- Goal Secondo Tempo Combinati: ${stats.combined.goalsSecondHalf}
- Pattern Combinato: ${stats.combined.scoringPattern}
- xG Primo Tempo Medio Combinato: ${stats.combined.xGFirstHalfAvg.toFixed(2)}`;

  // Head to Head
  let h2hSection = '';
  if (stats.headToHead) {
    h2hSection = `
**Head to Head (Ultimi ${stats.headToHead.totalMatches} confronti):**
- Vittorie ${stats.homeTeam.name}: ${stats.headToHead.homeWins}
- Pareggi: ${stats.headToHead.draws}
- Vittorie ${stats.awayTeam.name}: ${stats.headToHead.awayWins}
- Media Goal ${stats.homeTeam.name}: ${stats.headToHead.homeAvgGoals.toFixed(2)}
- Media Goal ${stats.awayTeam.name}: ${stats.headToHead.awayAvgGoals.toFixed(2)}
${stats.headToHead.recentMatches.length > 0 ? `- Ultimi risultati: ${stats.headToHead.recentMatches.slice(0, 3).map(m => `${m.homeScore}-${m.awayScore}`).join(', ')}` : ''}`;
  }

  // Quote
  let oddsSection = '';
  if (stats.odds) {
    oddsSection = `
**Quote Pre-Partita:**
- 1 (Casa): ${stats.odds.home?.toFixed(2) || 'N/A'}
- X (Pareggio): ${stats.odds.draw?.toFixed(2) || 'N/A'}
- 2 (Ospiti): ${stats.odds.away?.toFixed(2) || 'N/A'}
- Over 2.5: ${stats.odds.over25?.toFixed(2) || 'N/A'}
- Under 2.5: ${stats.odds.under25?.toFixed(2) || 'N/A'}
- BTTS (Sì): ${stats.odds.btts?.toFixed(2) || 'N/A'}`;
  }

  // Strategie utente
  let strategiesSection = '';
  if (userStrategies.length > 0) {
    strategiesSection = `
**STRATEGIE DISPONIBILI NEL TUO DATABASE:**

${userStrategies.map((s, idx) => `
${idx + 1}. **${s.name}**
${s.description ? `   Descrizione: ${s.description}` : ''}
   Contenuto completo:
${s.content}
`).join('\n')}

**IMPORTANTE:** Valuta se una di queste strategie è applicabile a questa partita. Se sì, raccomandala. Se nessuna è perfettamente adatta, crea una strategia personalizzata basata sui principi delle tue strategie esistenti.`;
  } else {
    strategiesSection = `
**NOTA:** Non hai strategie salvate nel database. Crea una strategia professionale basata sulle statistiche disponibili.`;
  }

  return `Sei un **trader professionale esperto su Betfair Exchange** con anni di esperienza nel trading sportivo calcistico. La tua analisi deve essere professionale, dettagliata, basata su dati concreti e orientata al profitto.

**PARTITA DA ANALIZZARE:**

${stats.match.leagueName} - ${new Date(stats.match.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${stats.match.time}
${stats.match.venue ? `Stadio: ${stats.match.venue}` : ''}

${homeTeamStats}

${awayTeamStats}

${combinedStats}

${h2hSection}

${oddsSection}

${strategiesSection}

**IL TUO COMPITO:**

Analizza questa partita come un trader professionale su Betfair Exchange. Devi:

1. **Valutare tutte le statistiche** disponibili in modo critico e professionale
2. **Identificare la strategia migliore** per questa specifica partita:
   - Se una delle tue strategie è applicabile, raccomandala con reasoning dettagliato
   - Se nessuna strategia è perfetta, crea una strategia personalizzata basata sui principi delle tue strategie esistenti
   - La strategia deve essere **altamente probabile** e **sensata**, non speculativa
3. **Determinare il timing ottimale**: Primo Tempo, Secondo Tempo, Full Match, o Live Flexible
4. **Calcolare probabilità e confidence** basate sui dati reali
5. **Fornire consigli operativi per Betfair Exchange**:
   - Market specifico da tradare
   - Timing di entrata preciso
   - Strategia di uscita
   - Livello di rischio
6. **Identificare fattori chiave** che supportano la strategia
7. **Elencare eventuali avvertimenti o rischi**
8. **Proporre strategie alternative** se applicabili

**PRINCIPI FONDAMENTALI:**

- Ragiona liberamente ma sempre in modo logico e professionale
- Le strategie devono essere basate su dati concreti, non su speculazioni
- Considera sempre il contesto: classifica, motivazione, infortuni, H2H
- Sii specifico nei consigli operativi (non generico)
- Valuta il rapporto rischio/rendimento
- Considera le quote disponibili per valutare il valore

**FORMATO RISPOSTA (JSON):**

Rispondi SOLO con un JSON valido nel seguente formato:

\`\`\`json
{
  "recommendedStrategy": {
    "name": "Nome strategia (es. 'Over 0.5 First Half', 'BTTS + Over 2.5', etc.)",
    "description": "Descrizione dettagliata della strategia e perché è applicabile",
    "timing": "FIRST_HALF | SECOND_HALF | FULL_MATCH | LIVE_FLEXIBLE",
    "probability": 75,
    "confidence": 80
  },
  "reasoning": "Reasoning professionale dettagliato (minimo 300 parole). Analizza tutte le statistiche, spiega perché questa strategia è la migliore, considera H2H, classifica, infortuni, pattern di scoring, quote, e qualsiasi altro fattore rilevante. Sii specifico e professionale.",
  "betfairAdvice": {
    "market": "Market specifico su Betfair (es. 'Over 0.5 Goals - First Half', 'Both Teams To Score', etc.)",
    "entryTiming": "Quando entrare precisamente (es. 'Minuto 0', 'Dopo il primo goal se avviene prima del minuto 20', 'Se 0-0 al minuto 30', etc.)",
    "exitStrategy": "Quando uscire (es. 'Al minuto 45 se Over 0.5 FH', 'Se 2-0 prima del minuto 60', 'Al minuto 75 se ancora 0-0', etc.)",
    "riskLevel": "LOW | MEDIUM | HIGH",
    "stakeSuggestion": "Suggerimento stake (opzionale, es. '1-2% bankroll', 'Stake medio', etc.)"
  },
  "keyFactors": [
    "Fattore 1 che supporta la strategia",
    "Fattore 2",
    "Fattore 3",
    "..."
  ],
  "warnings": [
    "Avvertimento 1 se presente",
    "Avvertimento 2 se presente"
  ],
  "alternativeStrategies": [
    {
      "name": "Nome strategia alternativa",
      "description": "Descrizione",
      "probability": 65,
      "reasoning": "Perché questa alternativa"
    }
  ]
}
\`\`\`

**IMPORTANTE:**
- Il campo "reasoning" deve essere dettagliato e professionale (minimo 300 parole)
- Sii specifico nei consigli operativi, non generico
- Le probabilità devono essere realistiche e basate sui dati
- Considera sempre il contesto completo della partita
- Se non ci sono avvertimenti, il campo "warnings" può essere un array vuoto
- Le strategie alternative sono opzionali ma consigliate se ci sono altre opportunità valide

Inizia l'analisi professionale ora.`;
}

/**
 * Genera analisi professionale per una singola partita usando OpenAI
 */
export async function generateProfessionalMatchAnalysis(
  matchWithStats: MatchWithStats,
  userId?: string
): Promise<ProfessionalMatchAnalysis> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurata. Configura VITE_OPENAI_API_KEY nel file .env');
  }

  console.log('🤖 Generazione analisi professionale per:', 
    `${matchWithStats.stats.homeTeam.name} vs ${matchWithStats.stats.awayTeam.name}`);

  // Recupera strategie utente se userId disponibile
  let userStrategies: UserStrategy[] = [];
  if (userId) {
    console.log('📚 Recupero strategie utente...');
    userStrategies = await fetchUserStrategies(userId);
    console.log(`✅ Trovate ${userStrategies.length} strategie attive`);
  }

  // Costruisci prompt professionale
  const prompt = buildProfessionalAnalysisPrompt(matchWithStats, userStrategies);

  try {
    console.log('📡 Invio richiesta a OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Modello potente per analisi professionale
        messages: [
          {
            role: 'system',
            content: `Sei un trader professionale esperto su Betfair Exchange con anni di esperienza nel trading sportivo calcistico. 
            La tua analisi deve essere professionale, dettagliata, basata su dati concreti e orientata al profitto.
            Ragioni liberamente ma sempre in modo logico e sensato, applicando strategie altamente probabili e sensate.
            Non speculare, ma analizza i dati in modo critico e professionale.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7, // Bilanciamento creatività/precisione
        max_tokens: 2000, // Abbastanza per reasoning dettagliato
        response_format: { type: 'json_object' } // Forza output JSON
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Nessuna risposta da OpenAI');
    }

    console.log('✅ Risposta ricevuta, parsing JSON...');

    // Parse JSON response
    let analysis: ProfessionalMatchAnalysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      // Prova a estrarre JSON se è dentro markdown code block
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Impossibile parsare la risposta JSON');
      }
    }

    // Validazione base
    if (!analysis.recommendedStrategy || !analysis.reasoning || !analysis.betfairAdvice) {
      throw new Error('Risposta incompleta da OpenAI');
    }

    console.log('✅ Analisi generata con successo!');
    return analysis;

  } catch (error: any) {
    console.error('❌ Errore generazione analisi:', error);
    throw new Error(`Errore generazione analisi professionale: ${error.message || 'Errore sconosciuto'}`);
  }
}

