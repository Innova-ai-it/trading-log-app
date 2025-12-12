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
 * Interfaccia per il risultato dello Stage 1 (Quick Filtering)
 */
interface QuickFilterResult {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  bestStrategy: {
    strategyId: string;
    strategyName: string;
    score: number; // Score semplificato 0-100
  };
}

/**
 * Genera piano di trading giornaliero usando Two-Stage Hybrid Approach
 * 
 * STAGE 1: Quick Filtering (gpt-4o-mini)
 *   - Analizza tutte le partite con score semplificato
 *   - Seleziona top 8-10 candidate
 * 
 * STAGE 2: Deep Analysis (gpt-4o)
 *   - Analisi completa solo sulle candidate selezionate
 *   - Reasoning dettagliato con consigli live trading
 */
export async function generateDailyPlan(
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>,
  strategies: UserStrategy[]
): Promise<GeneratedPlan> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key non configurata. Configura VITE_OPENAI_API_KEY nel file .env');
  }

  console.log(`🚀 STAGE 1: Quick Filtering - Analizzando ${matchesWithStats.length} partite...`);

  // ============================================
  // STAGE 1: QUICK FILTERING (gpt-4o-mini)
  // ============================================
  const quickFilterPrompt = buildQuickFilterPrompt(matchesWithStats, strategies);
  
  const stage1Response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Modello economico per filtraggio rapido
      messages: [
        {
          role: 'system',
          content: `Sei un esperto analista di trading sportivo. Il tuo compito è FILTRARE rapidamente le partite migliori usando uno SCORE SEMPLIFICATO (0-100).

SISTEMA DI SCORING SEMPLIFICATO:
Score = 50 (base) + TIMING_SCORE + PATTERN_SCORE + STATS_SCORE_SEMPLIFICATO + BONUS_MINIMI

TIMING SCORE (-25 a +25):
- FIRST_HALF + pattern FIRST_HALF = +25
- FIRST_HALF + pattern BALANCED = +10 (se goalsFH > goalsSH)
- FIRST_HALF + pattern SECOND_HALF = -15
- SECOND_HALF + pattern SECOND_HALF = +25
- SECOND_HALF + pattern BALANCED = +10 (se goalsSH > goalsFH)
- SECOND_HALF + pattern FIRST_HALF = -15
- FULL_MATCH / LIVE_FLEXIBLE = +15

PATTERN SCORE (-20 a +20):
- Pattern corrisponde = +20
- Pattern parziale (FIRST_HALF + BALANCED con goalsFH > SH) = +8
- Pattern opposto = -10
- ANY = +5

STATISTICHE SCORE SEMPLIFICATO (-20 a +15):
Verifica i requisiti principali (minAvgGoalsPerMatch, minXGFirstHalfAvg, minGoalsFirstHalf, minGoalsSecondHalf):
- 100% PASS = +15
- 80-99% PASS = +5
- 60-79% PASS = 0
- 40-59% PASS = -10
- <40% PASS = -20

BONUS MINIMI (-5 a +8):
- Form eccellente (entrambe >8/10) = +5
- Form scarsa (una <4/10) = -5
- Lega TOP = +3

Calcola score per ogni partita, seleziona la strategia migliore (score più alto), e restituisci solo le top 8-10 partite con score più alto.`
        },
        {
          role: 'user',
          content: quickFilterPrompt
        }
      ],
      temperature: 0.5, // Più deterministico per filtraggio
      response_format: { type: 'json_object' }
    })
  });

  if (!stage1Response.ok) {
    const error = await stage1Response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API error (Stage 1): ${error.error?.message || 'Unknown error'}`);
  }

  const stage1Data = await stage1Response.json();
  let stage1Result: { candidates: QuickFilterResult[] };
  
  try {
    stage1Result = JSON.parse(stage1Data.choices[0].message.content);
  } catch (parseError) {
    const content = stage1Data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      stage1Result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Risposta AI Stage 1 non valida: formato JSON non trovato');
    }
  }

  const candidates = stage1Result.candidates || [];
  console.log(`✅ STAGE 1 completato: selezionate ${candidates.length} candidate su ${matchesWithStats.length} partite`);

  if (candidates.length === 0) {
    throw new Error('Nessuna partita candidata trovata nello Stage 1');
  }

  // Filtra matchesWithStats per includere solo le candidate
  const candidateMatchIds = new Set(candidates.map(c => c.matchId));
  const candidateMatchesWithStats = matchesWithStats.filter(m => 
    candidateMatchIds.has(m.stats.match.id)
  );

  console.log(`🚀 STAGE 2: Deep Analysis - Analizzando ${candidateMatchesWithStats.length} candidate...`);
  console.log(`📋 Partite candidate per Stage 2:`, candidateMatchesWithStats.map(m => `${m.stats.homeTeam.name} vs ${m.stats.awayTeam.name}`).join(', '));

  // ============================================
  // STAGE 2: DEEP ANALYSIS (gpt-4o)
  // ============================================
  const deepAnalysisPrompt = buildAnalysisPrompt(candidateMatchesWithStats, strategies);

  const stage2Response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Modello potente per analisi completa
      messages: [
        {
          role: 'system',
          content: `Sei un esperto analista di trading sportivo specializzato in strategie calcistiche. 

Il tuo compito è ANALIZZARE ogni strategia in 3 STEP e assegnare uno SCORE TRASPARENTE (0-100).

═══════════════════════════════════════════════════════════════
STEP 1: COMPRENSIONE STRATEGIA
═══════════════════════════════════════════════════════════════

Per OGNI strategia, devi PRIMA estrarre:

1. **TIMING OPERATIVO** (quando si entra nel trade):
   - FIRST_HALF: Entry durante primo tempo (0'-45')
   - SECOND_HALF: Entry durante secondo tempo (45'-90')
   - FULL_MATCH: Entry pre-match o inizio partita
   - LIVE_FLEXIBLE: Entry variabile in base a momentum

2. **MERCATO TARGET** (su cosa si punta):
   - Over 0.5 FH / Over 1.5 / Over 2.5
   - Lay the Draw
   - BTTS (Both Teams To Score)
   - Back squadra favorita
   - Altro (specifica)

3. **PATTERN RICHIESTO** (che tipo di match cerca):
   - FIRST_HALF: Match con goal concentrati nel primo tempo
   - SECOND_HALF: Match con goal concentrati nel secondo tempo
   - BALANCED: Match con goal distribuiti
   - HIGH_SCORING: Match con molti goal totali
   - LATE_GOALS: Match con goal tardivi (75-90')
   - ANY: Qualsiasi pattern va bene

4. **REQUISITI STATISTICI OBBLIGATORI**:
   Estrai dal campo \`requiredPreMatchStats\` o dal testo della strategia:
   - minXGFirstHalfAvg: numero (es. 0.8)
   - minGoalsFirstHalf: numero (es. 3)
   - minGoalsSecondHalf: numero (es. 10)
   - minAvgGoalsPerMatch: numero (es. 2.5)
   - Altri requisiti specifici

5. **AGGRESSIVITÀ STRATEGIA**:
   - CONSERVATIVE: Richiede match perfetto, poche eccezioni
   - MODERATE: Accetta piccoli compromessi
   - AGGRESSIVE: Opportunistica, cerca value anche fuori target

═══════════════════════════════════════════════════════════════
STEP 2: ESTRAZIONE DATI MATCH
═══════════════════════════════════════════════════════════════

Dal match, estrai e CALCOLA:

1. **STATISTICHE CHIAVE**:
   - xGFirstHalfAvg_combined: (xGFH_home + xGFH_away) / 2
   - goalsFirstHalf_combined: goalsFH_home + goalsFH_away
   - goalsSecondHalf_combined: goalsSH_home + goalsSH_away
   - avgGoalsPerMatch_combined: (avgGoalsFor_home + avgGoalsFor_away) / 2

2. **PATTERN COMBINATO** (come segnano insieme):
   Se goalsFirstHalf > goalsSecondHalf * 1.3 → FIRST_HALF
   Se goalsSecondHalf > goalsFirstHalf * 1.3 → SECOND_HALF
   Altrimenti → BALANCED

3. **FORM E MOMENTUM**:
   - Form casa: W=+2, D=+1, L=0 → Score totale (max 10)
   - Form trasferta: W=+2, D=+1, L=0 → Score totale (max 10)

═══════════════════════════════════════════════════════════════
STEP 3: SISTEMA DI SCORING TRASPARENTE (0-100)
═══════════════════════════════════════════════════════════════

FORMULA BASE:
Score = 50 (base) + TIMING_SCORE + PATTERN_SCORE + STATS_SCORE + BONUS/PENALITÀ

---

**A) TIMING SCORE (-25 a +25)**

Confronta timing_strategia vs pattern_match:

| Strategia Timing | Pattern Match | Score | Reasoning |
|------------------|---------------|-------|-----------|
| FIRST_HALF | FIRST_HALF | +25 | Timing perfetto |
| FIRST_HALF | BALANCED | +10 | Accettabile se goalsFH > goalsSH |
| FIRST_HALF | SECOND_HALF | -20 (CONS), -10 (MOD), -5 (AGG) | Disallineamento |
| SECOND_HALF | SECOND_HALF | +25 | Timing perfetto |
| SECOND_HALF | BALANCED | +10 | Accettabile se goalsSH > goalsFH |
| SECOND_HALF | FIRST_HALF | -20 (CONS), -10 (MOD), -5 (AGG) | Disallineamento |
| FULL_MATCH | ANY | +15 | Strategia flessibile |
| LIVE_FLEXIBLE | ANY | +15 | Da valutare live |

---

**B) PATTERN SCORE (-20 a +20)**

Se strategia ha campo \`requiredScoringPattern\`:

| Pattern Richiesto | Pattern Match | Score |
|-------------------|---------------|-------|
| Stesso | Stesso | +20 |
| FIRST_HALF | BALANCED | +8 (se goalsFH > goalsSH) |
| SECOND_HALF | BALANCED | +8 (se goalsSH > goalsFH) |
| ANY | Qualsiasi | +10 |
| Opposto | Opposto | -15 (CONS), -8 (MOD), -3 (AGG) |

---

**C) STATISTICHE SCORE (-50 a +30)**

**METODO RIGOROSO:**

1. Per OGNI requisito in \`requiredPreMatchStats\`, verifica:

\`\`\`
SE valore_match >= valore_richiesto → ✅ PASS
ALTRIMENTI → ❌ FAIL
\`\`\`

2. Conta quanti PASS vs FAIL:
   - % soddisfatti = (PASS / TOTALE) * 100

3. Applica punteggio base:
   - 100% PASS: +15
   - 80-99% PASS: +5 (AGG), 0 (MOD), -10 (CONS)
   - 60-79% PASS: 0 (AGG), -10 (MOD), -20 (CONS)
   - 40-59% PASS: -10 (AGG), -20 (MOD), -30 (CONS)
   - 20-39% PASS: -20 (AGG), -30 (MOD), -40 (CONS)
   - 0-19% PASS: -30 (AGG), -40 (MOD), -50 (CONS)

4. **BONUS per superamento significativo:**
   Se un requisito è superato di 2x o più:
   - +5 per ogni requisito (max +15 totale)

   Esempio: Richiesto goalsFH ≥ 3, Match ha 19 → 19/3 = 6.3x → +5 bonus

5. **PENALITÀ CRITICA per requisiti fondamentali:**
   - minAvgGoalsPerMatch FAIL: -10 (AGG), -15 (MOD), -20 (CONS)
   - minXGFirstHalfAvg FAIL (se strategia FH): -5 (AGG), -10 (MOD), -15 (CONS)

---

**D) BONUS/PENALITÀ FINALI (-15 a +15)**

- **Form eccellente** (entrambe >8/10): +10
- **Form buona** (entrambe >6/10): +5
- **Form scarsa** (una <4/10): -5
- **Lega TOP** (Champions, Premier, Serie A, etc.): +5
- **Gap qualitativo favorevole**: +5

---

**CALCOLO FINALE:**

\`\`\`javascript
Score = 50 + timing_score + pattern_score + stats_score + bonus_penalità

// Cap tra 0-100
Score = Math.max(0, Math.min(100, Score))
\`\`\`

═══════════════════════════════════════════════════════════════
REASONING OBBLIGATORIO - FORMATO STANDARD
═══════════════════════════════════════════════════════════════

Il tuo reasoning DEVE seguire questa struttura:

\`\`\`
**TIMING ANALYSIS:**
Strategia richiede: [FIRST_HALF/SECOND_HALF/etc]
Match pattern: [FIRST_HALF/SECOND_HALF/BALANCED]
→ [Allineato/Parzialmente allineato/Non allineato]
→ Score timing: [+25/+10/-20/etc]

**PATTERN ANALYSIS:**
Pattern richiesto: [FIRST_HALF/SECOND_HALF/etc o "Nessuno specifico"]
Pattern match: [FIRST_HALF/SECOND_HALF/BALANCED]
→ [Corrisponde/Parziale/Non corrisponde]
→ Score pattern: [+20/+8/-15/etc]

**STATISTICHE PRE-MATCH:**
Requisiti strategia:
1. minXGFirstHalfAvg >= 0.8 | Match: 0.95 | ✅ PASS (+5 bonus: 0.95/0.8 = 1.19x)
2. minGoalsFirstHalf >= 3 | Match: 19 | ✅ PASS (+5 bonus: 19/3 = 6.3x)
3. minAvgGoalsPerMatch >= 2.0 | Match: 1.5 | ❌ FAIL

Risultato: 2/3 requisiti soddisfatti = 66.7%
Punteggio base statistiche: +5 (MODERATE, 60-79%)
Bonus superamento: +10 (2 requisiti con 2x+)
Penalità minAvgGoalsPerMatch: -15 (MODERATE)
→ Score statistiche totale: +5 +10 -15 = 0

**BONUS/PENALITÀ:**
- Form casa: 8/10 (WWLWL) → +5
- Form trasferta: 4/10 (WLLWL) → 0
- Lega: UEFA Champions League → +5
→ Score bonus: +10

**CALCOLO FINALE:**
50 (base) + 25 (timing) + 20 (pattern) + 0 (statistiche) + 10 (bonus) = 105
→ Capped a 100
→ **SCORE FINALE: 100**

**MOTIVAZIONE STRATEGIA:**
Perché questa strategia ha vinto:
- Top 2-3 alternative con score
- Punti di forza: timing, statistiche, pattern
- Rischi/limitazioni (requisiti mancanti, pattern parziale)

**CONSIGLI LIVE TRADING:**
- Entry: minuto, quote target, condizioni
- Exit: goal, tempo limite, quote, stop loss
- Rischio: split staking, stop loss, take profit
- Monitoraggio: momenti chiave, segnali +/- 
- Piano B: alternative se cambia situazione

**RACCOMANDAZIONE OPERATIVA:**
[Riassunto pratico: entry, exit, staking]
Es: "Over 0.5 FH: entry 10'-20' (1.80-2.00), exit al goal o 45', split 50% a 1.90/2.10"
\`\`\`

═══════════════════════════════════════════════════════════════
REGOLE CRITICHE - NON VIOLARE MAI
═══════════════════════════════════════════════════════════════

1. **COERENZA:** "timing perfetto" → +25, "statistiche soddisfatte" → 100% PASS, "2/3 requisiti" → 66.7%

2. **CALCOLO:** Mostra 50 + X + Y + Z = Risultato, verifica aritmetica, cap 0-100

3. **NESSUNA NORMALIZZAZIONE:** Calcolo dà 48 → score 48, 105 → 100, -10 → 0

4. **DATI MANCANTI:** Requisito non verificabile → FAIL, pattern indeterminato → BALANCED

5. **AGGRESSIVITÀ:** CONSERVATIVE max 30 se non allineato, MODERATE bilanciato, AGGRESSIVE opportunista

═══════════════════════════════════════════════════════════════

Analizza strategie e match seguendo questo framework.`
        },
        {
          role: 'user',
          content: deepAnalysisPrompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!stage2Response.ok) {
    const error = await stage2Response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API error (Stage 2): ${error.error?.message || 'Unknown error'}`);
  }

  const stage2Data = await stage2Response.json();
  let aiResponse;
  
  try {
    aiResponse = JSON.parse(stage2Data.choices[0].message.content);
  } catch (parseError) {
    const content = stage2Data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResponse = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Risposta AI Stage 2 non valida: formato JSON non trovato');
    }
  }

  // Processa risposta AI
  const matches: MatchAnalysis[] = aiResponse.matches || [];
  console.log(`✅ STAGE 2 completato: analizzate ${matches.length} partite`);
  
  // Valida reasoning per ogni match (solo bestStrategy)
  matches.forEach(match => {
    if (!validateReasoning(match.bestStrategy.reasoning)) {
      console.warn(`⚠️ Reasoning incompleto per match ${match.matchId} (${match.homeTeam} vs ${match.awayTeam})`);
    }
  });
  
  // Ordina per confidence e seleziona top 3-5
  const sortedMatches = [...matches].sort((a, b) => 
    b.bestStrategy.confidence - a.bestStrategy.confidence
  );
  const topMatches = sortedMatches.slice(0, Math.min(5, Math.max(3, sortedMatches.length)));

  console.log(`📊 Partite finali selezionate: ${topMatches.length}`);

  // Genera piano in formato testo (usa candidateMatchesWithStats che contiene solo le partite analizzate)
  const planText = generatePlanText(topMatches, candidateMatchesWithStats);

  return {
    planText,
    matches,
    topMatches
  };
}

/**
 * Valida che il reasoning contenga le sezioni obbligatorie
 */
function validateReasoning(reasoning: string): boolean {
  if (!reasoning || reasoning.trim().length === 0) {
    return false;
  }
  
  const required = [
    'TIMING ANALYSIS',
    'PATTERN ANALYSIS',
    'STATISTICHE PRE-MATCH',
    'CALCOLO FINALE',
    'MOTIVAZIONE STRATEGIA',
    'CONSIGLI LIVE TRADING'
  ];
  
  // Verifica che tutte le sezioni siano presenti (case insensitive)
  const reasoningUpper = reasoning.toUpperCase();
  return required.every(section => reasoningUpper.includes(section.toUpperCase()));
}

/**
 * Costruisce il prompt semplificato per Stage 1 (Quick Filtering)
 */
function buildQuickFilterPrompt(
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>,
  strategies: UserStrategy[]
): string {
  // Formato semplificato delle strategie (solo info essenziali)
  const strategiesText = strategies.map(s => {
    const parsed = s.parsedData || {};
    const metadata = (parsed as any).strategyMetadata || {};
    
    let metadataSection = '';
    if (metadata.timing) {
      metadataSection += `TIMING: ${metadata.timing}`;
    }
    if (metadata.requiredScoringPattern) {
      metadataSection += ` | PATTERN: ${metadata.requiredScoringPattern}`;
    }
    metadataSection += ` | AGGRESSIVITÀ: ${metadata.aggressiveness || 'MODERATE'}`;
    
    if (metadata.requiredPreMatchStats) {
      const stats = metadata.requiredPreMatchStats;
      metadataSection += `\nREQUISITI:`;
      if (stats.minXGFirstHalfAvg !== undefined) metadataSection += ` xG_FH>=${stats.minXGFirstHalfAvg}`;
      if (stats.minGoalsFirstHalf !== undefined) metadataSection += ` Goals_FH>=${stats.minGoalsFirstHalf}`;
      if (stats.minGoalsSecondHalf !== undefined) metadataSection += ` Goals_SH>=${stats.minGoalsSecondHalf}`;
      if (stats.minAvgGoalsPerMatch !== undefined) metadataSection += ` AvgGoals>=${stats.minAvgGoalsPerMatch}`;
    }
    
    return `ID: ${s.id} | NOME: ${s.name}${metadataSection ? `\n${metadataSection}` : ''}`;
  }).join('\n\n');

  // Helper per formattare numeri in modo sicuro
  const safeNumber = (value: any, decimals: number = 2, defaultValue: string = '0.00'): string => {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? defaultValue : num.toFixed(decimals);
  };

  // Formato semplificato delle partite (solo statistiche chiave)
  const matchesText = matchesWithStats.map(({ match, stats }) => {
    // Calcola pattern combinato
    const goalsFH = stats.combined.goalsFirstHalf || 0;
    const goalsSH = stats.combined.goalsSecondHalf || 0;
    let pattern = 'BALANCED';
    if (goalsFH > goalsSH * 1.3) pattern = 'FIRST_HALF';
    else if (goalsSH > goalsFH * 1.3) pattern = 'SECOND_HALF';

    return `ID: ${stats.match.id}
${stats.homeTeam.name} vs ${stats.awayTeam.name} | ${stats.match.leagueName} | ${stats.match.time}
Pattern: ${pattern}
xG_FH_combined: ${safeNumber(stats.combined.xGFirstHalfAvg)}
Goals_FH_combined: ${goalsFH}
Goals_SH_combined: ${goalsSH}
AvgGoals: ${safeNumber(stats.combined.avgGoalsPerMatch)}
Form_H: ${(stats.homeTeam.form || []).join('')} | Form_A: ${(stats.awayTeam.form || []).join('')}`;
  }).join('\n\n');

  return `Analizza tutte le partite e calcola uno SCORE SEMPLIFICATO (0-100) per ogni strategia.

STRATEGIE:
${strategiesText}

PARTITE:
${matchesText}

═══════════════════════════════════════════════════════════════
SCORING SEMPLIFICATO
═══════════════════════════════════════════════════════════════

Per ogni partita:
1. Analizza tutte le strategie
2. Calcola score semplificato per ogni strategia:
   - BASE: 50
   - TIMING: +25 (allineato), +10 (parziale), -15 (opposto), +15 (FULL_MATCH/LIVE)
   - PATTERN: +20 (corrisponde), +8 (parziale), -10 (opposto), +5 (ANY)
   - STATISTICHE: +15 (100% requisiti), +5 (80-99%), 0 (60-79%), -10 (40-59%), -20 (<40%)
   - BONUS: +5 (form eccellente), -5 (form scarsa), +3 (lega TOP)
3. Seleziona la strategia con score più alto come bestStrategy
4. Restituisci solo le TOP 8-10 partite con score più alto

FORMATO JSON:
{
  "candidates": [
    {
      "matchId": 12345,
      "homeTeam": "Juventus",
      "awayTeam": "Pafos",
      "league": "UEFA Champions League",
      "time": "21:00",
      "bestStrategy": {
        "strategyId": "uuid",
        "strategyName": "Over 0.5 First Half",
        "score": 85
      }
    }
  ]
}

IMPORTANTE: Restituisci SOLO le 8-10 partite con score più alto. Ordina per score decrescente.`;
}

/**
 * Costruisce il prompt completo per Stage 2 (Deep Analysis)
 */
function buildAnalysisPrompt(
  matchesWithStats: Array<{ match: any; stats: MatchPreMatchStats }>,
  strategies: UserStrategy[]
): string {
  const strategiesText = strategies.map(s => {
    const parsed = s.parsedData || {};
    const metadata = (parsed as any).strategyMetadata || {};
    
    // Costruisci sezione metadati strutturata
    let metadataSection = '';
    if (metadata.timing) {
      metadataSection += `\nTIMING: ${metadata.timing}`;
      const timingDesc = {
        'FIRST_HALF': 'Strategia per primo tempo',
        'SECOND_HALF': 'Strategia per secondo tempo',
        'FULL_MATCH': 'Strategia per intera partita',
        'LIVE_FLEXIBLE': 'Strategia live flessibile'
      };
      metadataSection += ` (${timingDesc[metadata.timing as keyof typeof timingDesc] || metadata.timing})`;
    }
    
    if (metadata.requiredScoringPattern) {
      metadataSection += `\nPATTERN RICHIESTO: ${metadata.requiredScoringPattern}`;
    }
    
    metadataSection += `\nAGGRESSIVITÀ: ${metadata.aggressiveness || 'MODERATE'}`;
    
    if (metadata.requiredPreMatchStats) {
      const stats = metadata.requiredPreMatchStats;
      metadataSection += `\n\nSTATISTICHE PRE-MATCH MINIME RICHIESTE:`;
      if (stats.minXGFirstHalfAvg !== undefined) metadataSection += `\n- xG primo tempo medio combinato: >= ${stats.minXGFirstHalfAvg}`;
      if (stats.minGoalsFirstHalf !== undefined) metadataSection += `\n- Goal primo tempo (ultimi 5, combinati): >= ${stats.minGoalsFirstHalf}`;
      if (stats.minGoalsSecondHalf !== undefined) metadataSection += `\n- Goal secondo tempo (ultimi 5, combinati): >= ${stats.minGoalsSecondHalf}`;
      if (stats.minAvgGoalsPerMatch !== undefined) metadataSection += `\n- Media goal per partita: >= ${stats.minAvgGoalsPerMatch}`;
      if (stats.minGoalsFHHome !== undefined) metadataSection += `\n- Goal primo tempo casa (ultimi 5): >= ${stats.minGoalsFHHome}`;
      if (stats.minGoalsFHAway !== undefined) metadataSection += `\n- Goal primo tempo trasferta (ultimi 5): >= ${stats.minGoalsFHAway}`;
      if (stats.minGoalsSHHome !== undefined) metadataSection += `\n- Goal secondo tempo casa (ultimi 5): >= ${stats.minGoalsSHHome}`;
      if (stats.minGoalsSHAway !== undefined) metadataSection += `\n- Goal secondo tempo trasferta (ultimi 5): >= ${stats.minGoalsSHAway}`;
    }
    
    if (metadata.howItWorks) {
      metadataSection += `\n\nCOME FUNZIONA:\n${metadata.howItWorks}`;
    }
    
    if (metadata.keyPoints) {
      metadataSection += `\n\nPUNTI CHIAVE PER MATCHING:\n${metadata.keyPoints}`;
    }
    
    return `
STRATEGIA ID: ${s.id}
NOME: ${s.name}
${s.description ? `DESCRIZIONE: ${s.description}` : ''}
${metadataSection ? `\n${metadataSection}` : ''}

CONTENUTO COMPLETO:
${s.content}
${s.parsedData && Object.keys(parsed).length > 0 ? `\nDATI STRUTTURATI COMPLETI: ${JSON.stringify(parsed, null, 2)}` : ''}
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
Analizza ogni strategia e assegna score (0-100) basandoti sull'allineamento tra strategia e statistiche match.

⚠️ IMPORTANTE: Devi analizzare e restituire TUTTE le partite fornite qui sotto. Non filtrare o escludere nessuna partita. Analizza tutte e restituisci tutte nel JSON. Se hai ricevuto ${matchesWithStats.length} partite, devi restituire ${matchesWithStats.length} partite nell'array "matches".

STRATEGIE:
${strategiesText}

PARTITE:
${matchesText}

═══════════════════════════════════════════════════════════════
METODOLOGIA DI SCORING
═══════════════════════════════════════════════════════════════

Per ogni strategia:
1. Comprendi: cosa fa, quando si entra, pattern richiesto, requisiti statistici, punti chiave
2. Analizza: confronta statistiche match con requisiti strategia, verifica timing e pattern
3. Calcola score:

BASE: 50 punti (strategia applicabile)

TIMING (valori fissi):
- ALLINEATO: strategia FIRST_HALF + pattern FIRST_HALF = +25 | strategia SECOND_HALF + pattern SECOND_HALF = +25
- PARZIALE: FIRST_HALF + BALANCED ma goal FH alti = +10
- NON ALLINEATO: FIRST_HALF + SECOND_HALF = -20
- LIVE_FLEXIBLE: +15 buone, +5 moderate, -5 scarse

PATTERN (valori fissi):
- CORRISPONDE: pattern richiesto = combinato = +20
- PARZIALE: FIRST_HALF + BALANCED ma goal FH > SH = +10
- NON CORRISPONDE: pattern ≠ combinato = -15
- ANY: +5 favorevole, 0 neutro

STATISTICHE - Verifica ogni requisito:

MAPPING: minXGFirstHalfAvg → xG primo tempo combinato | minGoalsFirstHalf → Goal primo tempo combinati | minGoalsSecondHalf → Goal secondo tempo combinati | minAvgGoalsPerMatch → Media goal | minGoalsFHHome → Goal primo tempo casa | minGoalsFHAway → Goal primo tempo trasferta | minGoalsSHHome → Goal secondo tempo casa | minGoalsSHAway → Goal secondo tempo trasferta

PROCEDURA:
1. Trova statistica corrispondente per ogni requisito
2. Se presente: confronta valore_match >= valore_richiesto → ✅ o ❌
3. Se mancante: ❌ NON VERIFICABILE (fondamentale = penalizza, secondario = escludi)
4. Calcola % requisiti soddisfatti (solo verificabili)
5. Applica punteggio:
   - 100% = +15 | 80-99% = +10 | 50-79% = -5 | 20-49% = -20 | 1-19% = -30 | 0% = -35
6. Penalità aggiuntive: minAvgGoalsPerMatch fallito = -15 | minXGFirstHalfAvg fallito = -10
7. Nel reasoning: elenca ogni requisito con confronto, conteggio finale, calcolo completo

PUNTI CHIAVE: Presenti e forti = +15 | Presenti = +10 | Assenti = 0

CALCOLO: Base (50) + Timing + Pattern + Statistiche + Punti Chiave = risultato (cap 0-100)

REGOLE:
- >50% requisiti falliti: max 40
- minAvgGoalsPerMatch fallito: max 35
- Score oggettivo, aggressività NON modifica score (solo staking: CONSERVATIVE score>=60, MODERATE score>=80, AGGRESSIVE score>=90)
- Reasoning coerente: mostra ogni confronto numerico, calcolo tracciabile

ESEMPIO REASONING CORRETTO:
"Timing: FIRST_HALF + pattern FIRST_HALF → ALLINEATO (+25). Pattern: richiesto FIRST_HALF = combinato FIRST_HALF → CORRISPONDE (+20). Statistiche: xG primo tempo 0.95 >= 0.70 → ✅, Goal primo tempo 19 >= 8 → ✅. 2/2 = 100% → +15. Punti chiave forti → +15. CALCOLO: 50+25+20+15+15 = 125 → 100 (cap). Score: 100."

FORMATO JSON:
{
  "matches": [
    {
      "matchId": 12345,
      "homeTeam": "Juventus",
      "awayTeam": "Pafos",
      "league": "UEFA Champions League",
      "time": "21:00",
      "bestStrategy": {
        "strategyId": "uuid",
        "strategyName": "Over 0.5 First Half",
        "confidence": 100,
        "reasoning": "[reasoning completo con calcolo]"
      },
      "allScores": [
        {
          "strategyId": "uuid",
          "strategyName": "Over 0.5 FH",
          "score": 100,
          "reasoning": "[reasoning completo]"
        }
      ]
    }
  ]
}

Per ogni partita: 
1. Analizza tutte le strategie disponibili
2. Calcola score per ogni strategia usando il sistema sopra
3. Seleziona bestStrategy (strategia con score più alto)
4. Confidence del bestStrategy = suo score
5. Nel reasoning del bestStrategy, DEVI includere OBBLIGATORIAMENTE:
   - TIMING ANALYSIS
   - PATTERN ANALYSIS
   - STATISTICHE PRE-MATCH
   - CALCOLO FINALE
   - MOTIVAZIONE STRATEGIA (perché questa strategia ha vinto rispetto alle altre)
   - CONSIGLI LIVE TRADING (entry, exit, gestione rischio, monitoraggio, piano B)
   - RACCOMANDAZIONE OPERATIVA (riassunto breve)

🔴 CRITICO: Restituisci TUTTE le partite fornite nell'array "matches". Non escludere nessuna partita. Se hai ricevuto ${matchesWithStats.length} partite, devi restituire esattamente ${matchesWithStats.length} partite nel JSON. L'ordinamento finale verrà fatto dal sistema, tu devi solo analizzare e restituire tutte le partite.
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

    // Estrai sezioni dal reasoning
    const reasoning = matchAnalysis.bestStrategy.reasoning;
    
    // Estrai MOTIVAZIONE STRATEGIA
    const motivationMatch = reasoning.match(/\*\*MOTIVAZIONE STRATEGIA:\*\*([\s\S]*?)(?=\*\*|$)/i);
    const motivationText = motivationMatch ? motivationMatch[1].trim() : null;
    
    // Estrai CONSIGLI LIVE TRADING
    const liveMatch = reasoning.match(/\*\*CONSIGLI LIVE TRADING:\*\*([\s\S]*?)(?=\*\*|$)/i);
    const liveText = liveMatch ? liveMatch[1].trim() : null;
    
    // Estrai RACCOMANDAZIONE OPERATIVA
    const recommendationMatch = reasoning.match(/\*\*RACCOMANDAZIONE OPERATIVA:\*\*([\s\S]*?)(?=\*\*|$)/i);
    const recommendationText = recommendationMatch ? recommendationMatch[1].trim() : null;
    
    // Mostra analisi tecnica (se presente, altrimenti tutto il reasoning)
    const hasStructuredSections = motivationText || liveText || recommendationText;
    
    if (hasStructuredSections) {
      // Mostra solo le sezioni tecniche (TIMING, PATTERN, STATISTICHE, CALCOLO)
      const technicalSections = reasoning.match(/(\*\*TIMING ANALYSIS:\*\*[\s\S]*?\*\*CALCOLO FINALE:\*\*[\s\S]*?)(?=\*\*MOTIVAZIONE|\*\*CONSIGLI|\*\*RACCOMANDAZIONE|$)/i);
      if (technicalSections) {
        plan += `ANALISI TECNICA:\n${technicalSections[1].trim()}\n\n`;
      }
      
      // Mostra MOTIVAZIONE STRATEGIA
      if (motivationText) {
        plan += `🎯 MOTIVAZIONE SCELTA:\n${motivationText}\n\n`;
      }
      
      // Mostra CONSIGLI LIVE
      if (liveText) {
        plan += `⚡ CONSIGLI LIVE TRADING:\n${liveText}\n\n`;
      }
      
      // Mostra RACCOMANDAZIONE OPERATIVA
      if (recommendationText) {
        plan += `📋 RACCOMANDAZIONE:\n${recommendationText}\n\n`;
      }
    } else {
      // Fallback: mostra tutto il reasoning se non è strutturato
      plan += `CONSIGLIO:\n${reasoning}\n\n`;
    }
    
    plan += `Strategia consigliata: ${matchAnalysis.bestStrategy.strategyName}\n`;
    plan += `Confidence: ${matchAnalysis.bestStrategy.confidence}%\n\n`;

    plan += `═══════════════════════════════════════\n\n`;
  }

  plan += `\nNota: Questo piano è stato generato automaticamente basandosi su analisi statistica e strategie personalizzate. `;
  plan += `Valuta sempre le condizioni di mercato in tempo reale prima di eseguire i trade.\n`;

  return plan;
}

