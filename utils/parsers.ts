import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeResult } from '../types';
import { parseLocaleNumber } from './helpers';

// Helper to normalize dates
const normalizeDate = (rawDate: string): string => {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  
  const cleanDate = rawDate.trim();
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  if (cleanDate.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/)) {
    const separator = cleanDate.includes('/') ? '/' : '-';
    const parts = cleanDate.split(separator);
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Handle "23-nov" format (assuming current year or inferring)
  const months: { [key: string]: string } = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    gen: '01', feb_it: '02', mar_it: '03', apr_it: '04', mag: '05', giu: '06',
    lug: '07', ago: '08', set: '09', ott: '10', nov_it: '11', dic: '12'
  };

  const parts = cleanDate.split('-');
  if (parts.length >= 2) {
    const day = parts[0].padStart(2, '0');
    const monthStr = parts[1].toLowerCase().substring(0, 3);
    const month = months[monthStr] || '01';
    const year = parts.length === 3 ? parts[2] : new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }

  return cleanDate; // Return as is if unknown, UI might show it raw
};

// Helper to fuzzy find column value
const getValue = (row: any, possibleHeaders: string[]): string => {
  if (!row) return '';
  
  // 1. Try exact match
  for (const h of possibleHeaders) {
    if (row[h] !== undefined && row[h] !== null) return String(row[h]).trim();
  }
  
  // 2. Try case-insensitive trim match
  const rowKeys = Object.keys(row);
  for (const h of possibleHeaders) {
    const foundKey = rowKeys.find(k => k.toLowerCase().trim() === h.toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }
  return '';
};

// Helper to find bankroll values in the raw CSV data
const extractBankrollFromMetadata = (text: string): { initialBank?: number; currentBank?: number } => {
  const lines = text.split(/\r\n|\n|\r/);
  let initialBank: number | undefined;
  let currentBank: number | undefined;

  // Definizione delle possibili varianti per capitale iniziale/attuale
  const initialBankHeaders = [
    'cassa iniziale', 'capitale iniziale', 'stake iniziale', 'bankroll iniziale',
    'initial bank', 'initial bankroll', 'starting balance', 'initial balance',
    'initial capital', 'starting capital', 'starting bankroll', 'saldo iniziale'
  ];

  const currentBankHeaders = [
    'cassa attuale', 'cassa finale', 'capitale attuale', 'capitale finale',
    'stake attuale', 'bankroll attuale', 'current bank', 'current bankroll',
    'current balance', 'final balance', 'ending balance', 'saldo attuale',
    'saldo finale', 'bankroll finale'
  ];

  // Scansioniamo le prime 20 righe per trovare i valori del bankroll
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    const cells = line.split(/[,;]/);
    
    if (cells.length < 2) continue;
    
    const firstCell = cells[0].toLowerCase().trim();
    const secondCell = cells[1].trim();
    
    // Controllo per capitale iniziale
    if (initialBank === undefined) {
      for (const header of initialBankHeaders) {
        if (firstCell.includes(header)) {
          const value = parseLocaleNumber(secondCell);
          if (value > 0) {
            initialBank = value;
            break;
          }
        }
      }
    }
    
    // Controllo per capitale attuale
    if (currentBank === undefined) {
      for (const header of currentBankHeaders) {
        if (firstCell.includes(header)) {
          const value = parseLocaleNumber(secondCell);
          if (value > 0) {
            currentBank = value;
            break;
          }
        }
      }
    }
    
    // Se abbiamo trovato entrambi, possiamo fermarci
    if (initialBank !== undefined && currentBank !== undefined) break;
  }

  return { initialBank, currentBank };
};

// Return type: { trades, initialBank?, currentBank? }
export interface ParsedCSVData {
  trades: Trade[];
  initialBank?: number;
  currentBank?: number;
}

export const parseCSV = (file: File): Promise<ParsedCSVData> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        resolve({ trades: [] });
        return;
      }

      // 1. Heuristic Header Detection
      // We scan the first 50 lines to find the one that looks most like a header row.
      const lines = text.split(/\r\n|\n|\r/);
      let headerLineIndex = 0;
      let maxMatches = 0;
      
      // Extract Initial Bank and Current Bank using robust header matching
      const { initialBank, currentBank } = extractBankrollFromMetadata(text);
      
      const keywords = ['data', 'date', 'competizione', 'competition', 'strategia', 'strategy', 'quota', 'odds', 'profit', 'profitto'];

      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i].toLowerCase();
        let matches = 0;
        keywords.forEach(k => {
          if (line.includes(k)) matches++;
        });
        
        // We need at least 2 keywords to consider it a header row to avoid false positives in metadata
        if (matches > maxMatches && matches >= 2) {
          maxMatches = matches;
          headerLineIndex = i;
        }
      }

      // Prepare content for parsing starting from the detected header
      const contentToParse = lines.slice(headerLineIndex).join('\n');

      Papa.parse(contentToParse, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          const trades: Trade[] = [];
          
          results.data.forEach((row: any) => {
            // Extract core fields with extensive header variants
            const dateStr = getValue(row, [
              'Data', 'Date', 'Giorno', 'Day', 'Fecha', 'Datum'
            ]);
            
            const competition = getValue(row, [
              'Competizione', 'Competition', 'League', 'Lega', 'Campionato',
              'Tournament', 'Torneo', 'Championship'
            ]);
            
            const strategy = getValue(row, [
              'Strategia', 'Strategy', 'Type', 'Tipo', 'Metodo', 'Method',
              'Sistema', 'System', 'Mercato', 'Market'
            ]);
            
            const home = getValue(row, [
              'Casa', 'Home', 'Team1', 'Team 1', 'Squadra Casa', 'Home Team',
              'HomeTeam', 'Casa Team', 'Local'
            ]);
            
            const away = getValue(row, [
              'Trasferta', 'Away', 'Team2', 'Team 2', 'Squadra Trasferta',
              'Away Team', 'AwayTeam', 'Trasferta Team', 'Visitante', 'Visitor'
            ]);

            // ROBUST VALIDATION:
            // A valid trade line must have at least a Date OR (Competition AND Strategy).
            // We skip summary lines like "TOTALE", "CASSA", or empty lines that parsed weirdly.
            if (!dateStr && !competition && !strategy) return;
            
            // Skip rows that look like summaries
            if (competition.toUpperCase().includes('TOTALE') || 
                competition.toUpperCase().includes('CASSA') ||
                strategy.toUpperCase().includes('TOTALE')) {
              return;
            }

            // Normalize Result with extensive variants
            let result = TradeResult.OPEN;
            const resStr = getValue(row, [
              'W/L/V', 'Result', 'Risultato', 'Esito', 'Win', 'Status',
              'Outcome', 'State', 'Stato', 'Win/Loss', 'Vincita'
            ]).toUpperCase();
            
            if (resStr.includes('WIN') || resStr === '1' || resStr === 'W' || resStr === 'VINTA' || resStr === 'WON') result = TradeResult.WIN;
            else if (resStr.includes('LOSE') || resStr.includes('LOSS') || resStr === '0' || resStr === 'L' || resStr === 'PERSA' || resStr === 'LOST') result = TradeResult.LOSE;
            else if (resStr.includes('VOID') || resStr === 'V' || resStr === 'RIMBORSO' || resStr.includes('REFUND')) result = TradeResult.VOID;
            
            // Parse Numbers with extensive variants
            const odds = parseLocaleNumber(getValue(row, [
              'Quota', 'Odds', 'Price', 'Prezzo', 'Quotazione', 'Odd', 'Cota'
            ]));
            
            const stakePct = parseLocaleNumber(getValue(row, [
              'Stake %', 'StakePercent', 'StakePct', 'Stake Percentuale',
              'Percentuale Stake', '% Stake', 'Stake%', 'Puntata %'
            ]));
            
            const stakeEur = parseLocaleNumber(getValue(row, [
              'Stake €', 'StakeEuro', 'Stake', 'Importo', 'Puntata',
              'Stake EUR', 'Amount', 'Ammontare', 'Bet Amount', 'Bet'
            ]));
            
            const pl = parseLocaleNumber(getValue(row, [
              'Profit/Loss', 'Profitto', 'P/L', 'Netto', 'Profit',
              'ProfitLoss', 'Profit Loss', 'Guadagno', 'Utile',
              'Gain', 'Loss', 'Net', 'Net Profit', 'Rendimento'
            ]));
            
            const roi = parseLocaleNumber(getValue(row, [
              'ROI', 'Yield', 'Return', 'Ritorno', 'Rendimento %', 'ROI %'
            ]));
            
            // If the row has no financial info and no strategy, it's likely garbage
            if (odds === 0 && pl === 0 && !strategy) return;

            const trade: Trade = {
              id: uuidv4(),
              date: normalizeDate(dateStr),
              competition: competition,
              homeTeam: home,
              awayTeam: away,
              strategy: strategy,
              odds: odds,
              stakePercent: stakePct,
              stakeEuro: stakeEur,
              matchedParts: 100, // Default
              position: getValue(row, [
                'Posizione', 'Position', 'Side', 'Lato', 'Tipo Posizione',
                'Back/Lay', 'Bet Type', 'Tipo Scommessa'
              ]),
              result: result,
              profitLoss: pl,
              roi: roi,
              points: parseLocaleNumber(getValue(row, [
                'Punti', 'Points', 'Punteggio', 'Score', 'Pts'
              ])),
              notes: getValue(row, [
                'Note', 'Notes', 'Commenti', 'Comments', 'Descrizione',
                'Description', 'Memo', 'Remark', 'Osservazioni'
              ]),
            };

            trades.push(trade);
          });

          // Always resolve with whatever we found, never fail
          resolve({ trades, initialBank, currentBank });
        },
        error: (error) => {
          console.warn("CSV Parse error:", error);
          resolve({ trades: [] }); // Fallback to empty, don't throw
        }
      });
    };

    reader.onerror = () => resolve({ trades: [] });
    reader.readAsText(file, 'UTF-8');
  });
};

export const parseXML = async (file: File): Promise<Trade[]> => {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const trades: Trade[] = [];

    // Try multiple selectors for trade rows
    const tradeNodes = xmlDoc.querySelectorAll('trade, row, item, Trade, Row, Item');
    
    tradeNodes.forEach(node => {
      const getTextMulti = (tags: string[]) => {
        for (const tag of tags) {
          const el = node.querySelector(tag) || node.getElementsByTagName(tag)[0];
          if (el && el.textContent) return el.textContent.trim();
        }
        return '';
      };

      // Basic XML mapping with extensive tag variants
      const dateStr = getTextMulti(['Data', 'date', 'Date', 'Giorno', 'Day']);
      if (!dateStr) return; // Skip if no date in XML

      const resultStr = getTextMulti(['Risultato', 'result', 'Result', 'Esito', 'Win', 'Status']).toUpperCase();
      let result = TradeResult.OPEN;
      if (resultStr.includes('WIN') || resultStr === 'W' || resultStr === 'VINTA' || resultStr === '1') result = TradeResult.WIN;
      else if (resultStr.includes('LOSE') || resultStr.includes('LOSS') || resultStr === 'L' || resultStr === 'PERSA' || resultStr === '0') result = TradeResult.LOSE;
      else if (resultStr.includes('VOID') || resultStr === 'V' || resultStr === 'RIMBORSO') result = TradeResult.VOID;

      trades.push({
        id: uuidv4(),
        date: normalizeDate(dateStr),
        competition: getTextMulti(['Competizione', 'competition', 'Competition', 'League', 'Lega', 'Campionato']),
        homeTeam: getTextMulti(['Casa', 'home', 'Home', 'Team1', 'HomeTeam']),
        awayTeam: getTextMulti(['Trasferta', 'away', 'Away', 'Team2', 'AwayTeam']),
        strategy: getTextMulti(['Strategia', 'strategy', 'Strategy', 'Type', 'Tipo', 'Mercato', 'Market']),
        odds: parseLocaleNumber(getTextMulti(['Quota', 'odds', 'Odds', 'Price', 'Prezzo'])),
        stakePercent: parseLocaleNumber(getTextMulti(['StakePercent', 'stakePercent', 'StakePct', 'Stake%'])),
        stakeEuro: parseLocaleNumber(getTextMulti(['Stake', 'stakeEuro', 'StakeEuro', 'Importo', 'Puntata', 'Amount'])),
        matchedParts: 100,
        position: getTextMulti(['Posizione', 'position', 'Position', 'Side', 'Lato']),
        result: result,
        profitLoss: parseLocaleNumber(getTextMulti(['Profitto', 'profitLoss', 'ProfitLoss', 'Profit', 'P/L', 'Netto'])),
        roi: parseLocaleNumber(getTextMulti(['ROI', 'roi', 'Yield', 'Return'])),
        notes: getTextMulti(['Note', 'notes', 'Notes', 'Commenti', 'Comments', 'Descrizione'])
      });
    });

    return trades;
  } catch (e) {
    console.warn("XML Parse error:", e);
    return [];
  }
};
