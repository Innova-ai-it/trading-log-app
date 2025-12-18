// utils/professionalMatchAnalysis.ts

import { MatchPreMatchStats } from './dailyPlanService';

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
 * Costruisce un prompt professionale dettagliato per l'analisi AI
 */
function buildProfessionalAnalysisPrompt(
  matchWithStats: MatchWithStats
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

  // Quote con calcoli automatici
  let oddsSection = '';
  let calculatedInsights = '';
  if (stats.odds) {
    // Calcola probabilità implicite dalle quote
    const homeImpliedProb = stats.odds.home ? ((1 / stats.odds.home) * 100) : null;
    const drawImpliedProb = stats.odds.draw ? ((1 / stats.odds.draw) * 100) : null;
    const awayImpliedProb = stats.odds.away ? ((1 / stats.odds.away) * 100) : null;
    const over25ImpliedProb = stats.odds.over25 ? ((1 / stats.odds.over25) * 100) : null;
    const under25ImpliedProb = stats.odds.under25 ? ((1 / stats.odds.under25) * 100) : null;
    const bttsImpliedProb = stats.odds.btts ? ((1 / stats.odds.btts) * 100) : null;

    oddsSection = `
**Quote Pre-Partita:**
- 1 (Casa): ${stats.odds.home?.toFixed(2) || 'N/A'} ${homeImpliedProb ? `→ Probabilità implicita: ${homeImpliedProb.toFixed(1)}%` : ''}
- X (Pareggio): ${stats.odds.draw?.toFixed(2) || 'N/A'} ${drawImpliedProb ? `→ Probabilità implicita: ${drawImpliedProb.toFixed(1)}%` : ''}
- 2 (Ospiti): ${stats.odds.away?.toFixed(2) || 'N/A'} ${awayImpliedProb ? `→ Probabilità implicita: ${awayImpliedProb.toFixed(1)}%` : ''}
- Over 2.5: ${stats.odds.over25?.toFixed(2) || 'N/A'} ${over25ImpliedProb ? `→ Probabilità implicita: ${over25ImpliedProb.toFixed(1)}%` : ''}
- Under 2.5: ${stats.odds.under25?.toFixed(2) || 'N/A'} ${under25ImpliedProb ? `→ Probabilità implicita: ${under25ImpliedProb.toFixed(1)}%` : ''}
- BTTS (Sì): ${stats.odds.btts?.toFixed(2) || 'N/A'} ${bttsImpliedProb ? `→ Probabilità implicita: ${bttsImpliedProb.toFixed(1)}%` : ''}`;

    // Calcola insights automatici
    const goalExpectancy = stats.combined.avgGoalsPerMatch;
    const firstHalfGoalExpectancy = (stats.combined.goalsFirstHalf / 5); // Media goal primo tempo per partita
    const secondHalfGoalExpectancy = (stats.combined.goalsSecondHalf / 5);
    
    // Calcola trend form (ultimi 3 vs precedenti 2)
    const homeFormRecent = stats.homeTeam.form.slice(0, 3);
    const homeFormPrevious = stats.homeTeam.form.slice(3, 5);
    const homeRecentPoints = homeFormRecent.filter(f => f === 'W').length * 3 + homeFormRecent.filter(f => f === 'D').length;
    const homePreviousPoints = homeFormPrevious.filter(f => f === 'W').length * 3 + homeFormPrevious.filter(f => f === 'D').length;
    const homeTrend = homeRecentPoints > homePreviousPoints ? 'miglioramento' : homeRecentPoints < homePreviousPoints ? 'peggioramento' : 'stabile';
    
    const awayFormRecent = stats.awayTeam.form.slice(0, 3);
    const awayFormPrevious = stats.awayTeam.form.slice(3, 5);
    const awayRecentPoints = awayFormRecent.filter(f => f === 'W').length * 3 + awayFormRecent.filter(f => f === 'D').length;
    const awayPreviousPoints = awayFormPrevious.filter(f => f === 'W').length * 3 + awayFormPrevious.filter(f => f === 'D').length;
    const awayTrend = awayRecentPoints > awayPreviousPoints ? 'miglioramento' : awayRecentPoints < awayPreviousPoints ? 'peggioramento' : 'stabile';

    calculatedInsights = `
**INSIGHTS CALCOLATI:**

Goal Attesi:
- Goal totali attesi: ${goalExpectancy.toFixed(2)} per partita
- Goal primo tempo attesi: ${firstHalfGoalExpectancy.toFixed(2)} per partita
- Goal secondo tempo attesi: ${secondHalfGoalExpectancy.toFixed(2)} per partita
- Distribuzione: ${((firstHalfGoalExpectancy / (firstHalfGoalExpectancy + secondHalfGoalExpectancy)) * 100).toFixed(1)}% primo tempo / ${((secondHalfGoalExpectancy / (firstHalfGoalExpectancy + secondHalfGoalExpectancy)) * 100).toFixed(1)}% secondo tempo

Trend Form Recente (ultimi 3 vs precedenti 2):
- ${stats.homeTeam.name}: ${homeTrend} (${homeRecentPoints} punti ultimi 3 vs ${homePreviousPoints} precedenti 2)
- ${stats.awayTeam.name}: ${awayTrend} (${awayRecentPoints} punti ultimi 3 vs ${awayPreviousPoints} precedenti 2)

Analisi Quote vs Statistiche:
${over25ImpliedProb ? `- Over 2.5: Quote implicano ${over25ImpliedProb.toFixed(1)}%, statistiche suggeriscono ${(goalExpectancy > 2.5 ? 'probabilità più alta' : goalExpectancy < 2.0 ? 'probabilità più bassa' : 'probabilità simile')}` : ''}
${bttsImpliedProb ? `- BTTS: Quote implicano ${bttsImpliedProb.toFixed(1)}%, valuta basandoti su statistiche attacco/difesa` : ''}

Pattern di Scoring:
- ${stats.combined.scoringPattern === 'FIRST_HALF' ? '⚠️ ATTENZIONE: Pattern indica goal concentrati nel primo tempo' : stats.combined.scoringPattern === 'SECOND_HALF' ? '⚠️ ATTENZIONE: Pattern indica goal concentrati nel secondo tempo' : 'Pattern bilanciato tra primo e secondo tempo'}
`;
  }

  return `Sei un **trader professionale esperto su Betfair Exchange** con 15+ anni di esperienza nel trading sportivo calcistico. 
La tua analisi deve essere professionale, dettagliata, basata su dati concreti e orientata al profitto.

**PARTITA DA ANALIZZARE:**

${stats.match.leagueName} - ${new Date(stats.match.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${stats.match.time}
${stats.match.venue ? `Stadio: ${stats.match.venue}` : ''}

${homeTeamStats}

${awayTeamStats}

${combinedStats}

${h2hSection}

${oddsSection}

${calculatedInsights}

**METODOLOGIA DI ANALISI (segui questo processo strutturato):**

1. **ANALISI STATISTICA FONDAMENTALE:**
   - Confronta statistiche squadre: sono sopra o sotto la media? Quale squadra ha attacco/difesa più forte?
   - Analizza trend recenti: miglioramento o peggioramento nelle ultime partite?
   - Valuta pattern di scoring: quando segnano di più? Primo tempo, secondo tempo, o bilanciato?
   - Considera form: ultimi risultati mostrano continuità o cambiamento?

2. **ANALISI CONTESTUALE:**
   - Motivazione: posizione classifica, obiettivi stagione, pressione
   - H2H: pattern storici tra le squadre (alta/bassa segnatura, risultati)
   - Infortuni: impatto su attacco/difesa (giocatori chiave assenti?)
   - Contesto partita: importanza, rivalità, situazione stagionale

3. **ANALISI DI VALUE:**
   - Confronta probabilità implicita delle quote con probabilità reale basata su statistiche
   - Identifica mercati con value positivo (probabilità reale > probabilità implicita)
   - Considera liquidità e timing di mercato (quando tradare?)
   - Valuta rapporto rischio/rendimento per ogni opportunità

4. **IDENTIFICAZIONE OPPORTUNITÀ:**
   - Quale mercato offre il miglior rapporto rischio/rendimento?
   - Quale timing è ottimale? (pre-match, primo tempo, secondo tempo, live)
   - Quali sono i fattori chiave che supportano questa opportunità?
   - Quali sono i rischi principali e come gestirli?

5. **GESTIONE DEL RISCHIO:**
   - Entry: quando entrare precisamente? A che quote target?
   - Exit: scenari multipli (goal, tempo limite, stop loss, take profit)
   - Staking: quanto rischiare basato su confidence e probabilità
   - Piano B: alternative se la situazione cambia

**IL TUO COMPITO:**

Analizza questa partita seguendo la metodologia sopra. Ragiona completamente liberamente basandoti SOLO sui dati statistici e sul contesto della partita.

1. **Analizza tutte le statistiche** in modo critico e professionale usando la metodologia strutturata
2. **Identifica la strategia migliore** per questa specifica partita:
   - Usa gli insights calcolati come punto di partenza
   - Confronta probabilità reali vs probabilità implicite dalle quote
   - Identifica opportunità di value basate sui dati reali
   - Crea una strategia personalizzata ottimale per questa partita
   - La strategia deve essere **altamente probabile** e **sensata**, non speculativa
3. **Determina il timing ottimale**: Primo Tempo, Secondo Tempo, Full Match, o Live Flexible
4. **Calcola probabilità e confidence** basate sui dati reali e sulla tua esperienza
5. **Fornisci consigli operativi SPECIFICI per Betfair Exchange**:
   - Market specifico da tradare (es. "Over 0.5 Goals - First Half", non solo "Over")
   - Timing di entrata preciso (es. "Minuto 10-15 se 0-0, quote target 1.80-2.00", non "quando conviene")
   - Strategia di uscita dettagliata (es. "Split: 50% a +20%, 50% a +40% o al goal", non solo "esci al goal")
   - Livello di rischio (LOW/MEDIUM/HIGH) con motivazione
   - Gestione del rischio completa (staking, stop loss, take profit, piano B)
6. **Identifica fattori chiave** che supportano la strategia (minimo 3-5 fattori specifici)
7. **Elenca eventuali avvertimenti o rischi** (sii onesto sui limiti)
8. **Proponi strategie alternative** se applicabili (con probabilità e reasoning)

**PRINCIPI FONDAMENTALI:**

- Ragiona completamente liberamente basandoti SOLO sui dati della partita
- Non seguire pattern o regole predefinite - ogni partita è unica
- Le strategie devono essere basate su dati concreti, non su speculazioni
- Considera sempre il contesto completo: classifica, motivazione, infortuni, H2H, quote, trend
- SII SPECIFICO nei consigli operativi (minuti, quote, percentuali, non generico)
- Valuta sempre il rapporto rischio/rendimento
- Confronta probabilità reali con probabilità implicite dalle quote per trovare value
- Usa la tua esperienza di trader professionale per identificare opportunità
- Se non c'è un'opportunità chiara, dillo onestamente

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
  "reasoning": "Reasoning professionale dettagliato (minimo 400 parole). Analizza tutte le statistiche in modo critico, spiega perché questa strategia è la migliore per questa partita specifica, considera H2H, classifica, infortuni, pattern di scoring, quote, form recente, e qualsiasi altro fattore rilevante. Sii specifico, professionale e dimostra il tuo ragionamento analitico.",
  "betfairAdvice": {
    "market": "Market specifico su Betfair (es. 'Over 0.5 Goals - First Half', 'Both Teams To Score', etc.)",
    "entryTiming": "Quando entrare precisamente con quote target (es. 'Minuto 10-15 se 0-0, quote target 1.80-2.00', 'Dopo il primo goal se avviene prima del minuto 20, quote target 1.50-1.70', 'Se 0-0 al minuto 30, quote target 1.60-1.90', etc.)",
    "exitStrategy": "Strategia di uscita dettagliata con scenari multipli (es. 'Split staking: 50% a +20%, 50% a +40% o al goal. Stop loss: se 0-0 al 40' considera exit anticipato a -30% max', 'Al minuto 45 se Over 0.5 FH, exit immediato', 'Se 2-0 prima del minuto 60, exit parziale 50% a +50%, resto a +100%', etc.)",
    "riskLevel": "LOW | MEDIUM | HIGH",
    "stakeSuggestion": "Suggerimento stake specifico (es. '2-3% bankroll per confidence 75%', '1-2% bankroll per confidence 60%', 'Stake medio 2%', etc.)"
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
- Il campo "reasoning" deve essere dettagliato e professionale (minimo 400 parole) e seguire la metodologia strutturata
- Sii SPECIFICO nei consigli operativi: minuti precisi, quote target, percentuali, split staking - NON generico
- Le probabilità devono essere realistiche e basate sui dati (confronta con probabilità implicite dalle quote)
- Considera sempre il contesto completo della partita (statistiche, trend, motivazione, H2H, infortuni)
- Usa gli insights calcolati come punto di partenza per la tua analisi
- Se non c'è un'opportunità chiara con value positivo, dillo onestamente
- Se non ci sono avvertimenti, il campo "warnings" può essere un array vuoto
- Le strategie alternative sono opzionali ma consigliate se ci sono altre opportunità valide
- Ragiona come un trader esperto, non seguire pattern predefiniti
- Dimostra il tuo ragionamento analitico nel reasoning

**ESEMPIO DI REASONING CORRETTO:**
"Inizio l'analisi confrontando le statistiche. La squadra casa ha una media di 1.8 goal fatti e 1.2 subiti, mentre la trasferta ha 1.5 fatti e 1.4 subiti. Il pattern combinato indica goal concentrati nel primo tempo (12 goal FH vs 8 SH negli ultimi 5). Le quote per Over 2.5 implicano una probabilità del 45%, ma le statistiche suggeriscono una probabilità reale del 55% basata sulla media goal combinata di 2.1. Questo indica value positivo. Tuttavia, il trend recente mostra un peggioramento della form della squadra casa (1 punto ultimi 3 vs 4 precedenti 2), il che potrebbe ridurre la probabilità. L'H2H mostra 3 partite con media 2.3 goal, supportando Over 2.5. Considerando tutti i fattori, stimo una probabilità reale del 52%, leggermente superiore alle quote, ma non sufficiente per un value significativo. L'opportunità migliore è Over 0.5 First Half con probabilità stimata del 75% vs quote che implicano 60%, value positivo chiaro..."

Inizia l'analisi professionale seguendo la metodologia strutturata.`;
}

/**
 * Genera analisi professionale per una singola partita usando OpenAI
 */
export async function generateProfessionalMatchAnalysis(
  matchWithStats: MatchWithStats
): Promise<ProfessionalMatchAnalysis> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurata. Configura VITE_OPENAI_API_KEY nel file .env');
  }

  console.log('🤖 Generazione analisi professionale per:', 
    `${matchWithStats.stats.homeTeam.name} vs ${matchWithStats.stats.awayTeam.name}`);

  // Costruisci prompt professionale (senza strategie salvate)
  const prompt = buildProfessionalAnalysisPrompt(matchWithStats);

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
            content: `Sei un trader professionale esperto su Betfair Exchange con 15+ anni di esperienza nel trading sportivo calcistico.

IL TUO APPROCCIO:
1. **Analisi Multi-Livello**: Analizza statistiche, contesto, value, e gestione rischio seguendo una metodologia strutturata
2. **Value First**: Cerca sempre il valore confrontando probabilità reali con probabilità implicite dalle quote
3. **Context Matters**: Ogni partita è unica - analizzala nel suo contesto specifico (form, motivazione, H2H, infortuni)
4. **Risk Management**: Ogni trade deve avere entry, exit e stop loss chiari con scenari multipli
5. **Market Awareness**: Considera liquidità, spread, timing di mercato
6. **Honesty**: Se non c'è un'opportunità chiara con value positivo, dillo onestamente

METODOLOGIA:
- Inizia sempre con analisi statistica fondamentale (confronta statistiche, analizza trend, valuta pattern)
- Aggiungi contesto (motivazione, form, H2H, infortuni)
- Identifica value confrontando quote con probabilità reali
- Proponi strategia con entry/exit chiari e specifici
- Valuta rischi e alternative

SII SPECIFICO:
- Non dire "entra quando conviene" → "entra al minuto 10-15 se 0-0, quote target 1.80-2.00"
- Non dire "esci al goal" → "esci immediatamente al goal, split 50% a +20%, 50% a +40%"
- Non dire "bassa probabilità" → "probabilità stimata 35% vs quote che implicano 45% = value negativo"
- Non dire "stake medio" → "2-3% bankroll per confidence 75%"

La tua analisi deve essere professionale, dettagliata, basata su dati concreti e orientata al profitto.
Ragiona completamente liberamente basandoti SOLO sui dati statistici della partita e sul contesto.
Non seguire pattern o regole predefinite - ogni partita è unica. Usa la tua esperienza per identificare opportunità di value.
Non speculare, ma analizza i dati in modo critico e professionale.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8, // Aumentato per più creatività nel ragionamento
        max_tokens: 3000, // Aumentato per reasoning più dettagliato
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

