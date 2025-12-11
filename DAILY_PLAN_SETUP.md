# 📅 Piano di Trading Giornaliero - Setup e Utilizzo

## 🎯 Funzionalità

Il sistema di **Piano di Trading Giornaliero** genera automaticamente un piano di trading personalizzato per le partite del giorno, analizzando:
- Partite dei top campionati del giorno
- Statistiche pre-match complete di entrambe le squadre
- Strategie di trading salvate nel database
- Matching AI-powered tra partite e strategie

## 📋 Prerequisiti

### 1. Database Setup

Esegui lo script SQL in Supabase per creare le tabelle necessarie:

```sql
-- Esegui il file: supabase_daily_plan_setup.sql
```

Questo creerà:
- `trading_plans`: Tabella per salvare i piani generati
- `plan_match_feedback`: Tabella per il feedback sui match

### 2. Configurazione API Keys

Assicurati di avere nel file `.env` (o `.env.local`):

```env
# API-Football (RapidAPI) - per recuperare partite e statistiche
VITE_FOOTBALL_API_PROVIDER=api-football
VITE_FOOTBALL_API_KEY=your-rapidapi-key-here

# OpenAI - per generazione piano AI
VITE_OPENAI_API_KEY=your-openai-api-key-here
```

**Dove ottenere le API keys:**
- **API-Football**: https://rapidapi.com/api-sports/api/api-football
- **OpenAI**: https://platform.openai.com/api-keys

### 3. Strategie Attive

Assicurati di avere almeno una strategia attiva salvata nel database:
- Vai su **Strategies**
- Crea una nuova strategia o attiva una esistente
- Le strategie devono essere attive (`is_active = true`) per essere utilizzate

## 🚀 Utilizzo

### Generare un Piano

1. Vai su **Daily Plan** nella sidebar
2. Clicca su **"Crea il tuo piano di trading giornaliero"**
3. Il sistema:
   - Recupera tutte le partite del giorno dai top campionati
   - Recupera statistiche pre-match per ogni partita
   - Analizza ogni partita con tutte le strategie disponibili
   - Seleziona le top 3-5 partite con confidence più alta
   - Genera un piano operativo dettagliato

### Feedback sui Match

Dopo aver generato un piano, puoi fornire feedback per ogni match:

1. **Trade effettuato**: Spunta se hai eseguito il trade
2. **Risultato**: Seleziona se è stato vincente, perdente o in attesa
3. **Note**: Aggiungi note aggiuntive sul trade

Il feedback viene salvato automaticamente e può essere utilizzato in futuro per migliorare le raccomandazioni AI.

## 📊 Top Campionati Supportati

Il sistema analizza automaticamente partite da questi campionati:

| ID | Campionato | Paese |
|----|------------|-------|
| 39 | Premier League | Inghilterra |
| 140 | LaLiga EA Sports | Spagna |
| 135 | Serie A | Italia |
| 78 | Bundesliga | Germania |
| 61 | Ligue 1 | Francia |
| 263 | Liga MX | Messico |
| 94 | Primeira Liga | Portogallo |
| 866 | Major League Soccer (MLS) | USA/Canada |
| 88 | Eredivisie | Paesi Bassi |
| 40 | Championship | Inghilterra (2° liv.) |
| 144 | Jupiler Pro League | Belgio |
| 128 | Argentine Primera División | Argentina |
| 308 | Saudi Pro League | Arabia Saudita |
| 180 | Scottish Premiership | Scozia |
| 169 | Super League | Cina |
| 98 | J1 League | Giappone |
| 236 | Russia Premier League | Russia |
| 203 | Super Lig | Turchia |
| 233 | Egyptian Premier League | Egitto |
| 136 | Serie B | Italia |
| 2 | UEFA Champions League | UEFA |
| 3 | UEFA Europa League | UEFA |
| 848 | UEFA Conference League | UEFA |
| 15 | FIFA Club World Cup | FIFA |

## 🔍 Come Funziona l'Analisi AI

1. **Raccolta Dati**:
   - Partite del giorno dai top campionati
   - Statistiche pre-match complete (goal, xG, pattern, forma)
   - Strategie attive dal database

2. **Analisi per Match**:
   - Per ogni partita, l'AI analizza tutte le strategie
   - Assegna un punteggio 0-100 basato su:
     - Allineamento statistiche vs requisiti strategia
     - Pertinenza strategia per tipo di match
     - Qualità e affidabilità dati
   - Seleziona la strategia con punteggio più alto

3. **Selezione Top Matches**:
   - Ordina partite per confidence (punteggio strategia migliore)
   - Seleziona top 3-5 partite

4. **Generazione Piano**:
   - Crea piano operativo in formato testo
   - Include analisi, consigli, entry/exit points
   - Formato simile all'esempio fornito

## 📝 Formato Output

Il piano generato include per ogni partita:

```
⏳ 21:00 - Juventus vs Pafos
📊 UEFA Champions League

Staking Plan: 3%

ANALISI:
[Analisi dettagliata delle statistiche delle squadre]

CONSIGLIO:
[Consiglio operativo dettagliato con entry/exit points]

Strategia consigliata: Over 0.5 First Half
Confidence: 85%
```

## ⚠️ Note Importanti

### Rate Limiting
- API-Football ha limiti di rate (300 chiamate/min per piano Basic)
- Il sistema include pause automatiche tra le chiamate
- Se ci sono molte partite, la generazione può richiedere 1-2 minuti

### Costi OpenAI
- Ogni generazione usa ~2000-5000 token
- Stima costo: ~$0.01-0.05 per piano (con GPT-4 Turbo)

### Caching
- Un piano può essere generato una volta al giorno
- Se rigeneri, il piano precedente viene sostituito

### Error Handling
- Se alcune partite falliscono nel recupero statistiche, vengono saltate
- Se non ci sono partite o strategie, viene mostrato un errore chiaro

## 🔧 Troubleshooting

### "Nessuna partita trovata"
- Verifica che ci siano partite oggi nei top campionati
- Controlla la configurazione API-Football

### "Nessuna strategia attiva"
- Vai su Strategies e crea/attiva almeno una strategia

### "Errore recupero statistiche"
- Verifica che la API key di API-Football sia valida
- Controlla i rate limits del tuo piano RapidAPI

### "OpenAI API error"
- Verifica che la API key di OpenAI sia valida
- Controlla che il tuo account OpenAI abbia crediti disponibili

## 🎯 Prossimi Sviluppi

- [ ] Caching intelligente delle statistiche pre-match
- [ ] Storico piani generati
- [ ] Analisi performance piani passati
- [ ] Miglioramento AI basato su feedback storico
- [ ] Notifiche per partite selezionate
- [ ] Export piano in PDF/CSV

