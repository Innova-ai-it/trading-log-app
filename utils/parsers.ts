import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeResult } from '../types';
import { parseLocaleNumber } from './helpers';

// Helper to normalize dates
const normalizeDate = (rawDate: string | number): string => {
  if (!rawDate && rawDate !== 0) return new Date().toISOString().split('T')[0];
  
  // Handle Excel serial date numbers (days since 1900-01-01)
  if (typeof rawDate === 'number') {
    // Excel date serial number (with 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // 30 Dec 1899
    const date = new Date(excelEpoch.getTime() + rawDate * 86400000);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const cleanDate = String(rawDate).trim();
  
  // Handle Excel serial as string (e.g. "44197")
  if (/^\d{5}$/.test(cleanDate)) {
    const serialNumber = parseInt(cleanDate, 10);
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serialNumber * 86400000);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
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

  // Scansioniamo le prime 20 righe per trovare i valori del bankroll in tutte le colonne
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    const cells = line.split(/[,;\t]/); // Supporta anche tab
    
    if (cells.length < 2) continue;
    
    // Cerca in tutte le colonne della riga, non solo la prima
    for (let col = 0; col < cells.length - 1; col++) {
      const cellText = cells[col].toLowerCase().trim();
      const nextCellValue = cells[col + 1].trim();
      
      // Controllo per capitale iniziale
      if (initialBank === undefined) {
        for (const header of initialBankHeaders) {
          if (cellText.includes(header)) {
            const value = parseLocaleNumber(nextCellValue);
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
          if (cellText.includes(header)) {
            const value = parseLocaleNumber(nextCellValue);
            if (value > 0) {
              currentBank = value;
              break;
            }
          }
        }
      }
      
      if (initialBank !== undefined && currentBank !== undefined) break;
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
      
      const keywords = [
        'data', 'date', 'competizione', 'competition', 'strategia', 'strategy',
        'quota', 'odds', 'profit', 'profitto', 'evento', 'event', 'home', 'casa',
        'away', 'trasferta', 'esito', 'result', 'stake', 'roi', 'points', 'punti'
      ];

      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i].toLowerCase();
        let matches = 0;
        keywords.forEach(k => {
          if (line.includes(k)) matches++;
        });
        
        // We need at least 3 keywords to consider it a header row to avoid false positives in metadata
        if (matches > maxMatches && matches >= 3) {
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
            
            // Skip rows with "Evento" = 0 (summary rows)
            const eventoStr = getValue(row, ['Evento', 'Event', '#', 'N', 'Num']).trim();
            if (eventoStr === '0') return;
            
            // Skip rows that look like summaries
            if (competition.toUpperCase().includes('TOTALE') || 
                competition.toUpperCase().includes('CASSA') ||
                strategy.toUpperCase().includes('TOTALE')) {
              return;
            }

            // Normalize Result with extensive variants
            let result = TradeResult.OPEN;
            const resStr = getValue(row, [
              'Esito', 'W/L/V', 'W/L', 'Result', 'Risultato', 'Win', 'Status',
              'Outcome', 'State', 'Stato', 'Win/Loss', 'Vincita'
            ]).toUpperCase();
            
            if (resStr.includes('WIN') || resStr.includes('WON') || resStr === '1' || resStr === 'W' || resStr === 'VINTA') result = TradeResult.WIN;
            else if (resStr.includes('LOSE') || resStr.includes('LOSS') || resStr.includes('LOST') || resStr === '0' || resStr === 'L' || resStr === 'PERSA') result = TradeResult.LOSE;
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

export const parseXLSX = async (file: File): Promise<ParsedCSVData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Prendi il primo foglio
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Converti in array di array per analisi
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (!data || data.length === 0) {
      return { trades: [] };
    }

    // Estrai bankroll dalle prime righe cercando gli header
    let initialBank: number | undefined;
    let currentBank: number | undefined;
    
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

    // Cerca bankroll nelle prime 20 righe, in tutte le colonne
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (row.length < 2) continue;
      
      // Cerca in tutte le colonne della riga, non solo la prima
      for (let col = 0; col < row.length - 1; col++) {
        const cellText = String(row[col] || '').toLowerCase().trim();
        const nextCellValue = row[col + 1];
        
        if (initialBank === undefined) {
          for (const header of initialBankHeaders) {
            if (cellText.includes(header)) {
              const value = parseLocaleNumber(String(nextCellValue));
              if (value > 0) {
                initialBank = value;
                break;
              }
            }
          }
        }
        
        if (currentBank === undefined) {
          for (const header of currentBankHeaders) {
            if (cellText.includes(header)) {
              const value = parseLocaleNumber(String(nextCellValue));
              if (value > 0) {
                currentBank = value;
                break;
              }
            }
          }
        }
        
        if (initialBank !== undefined && currentBank !== undefined) break;
      }
      
      if (initialBank !== undefined && currentBank !== undefined) break;
    }

    // Trova la riga di header (cerca parole chiave tipiche)
    let headerRowIndex = 0;
    let maxMatches = 0;
    const keywords = [
      'data', 'date', 'competizione', 'competition', 'strategia', 'strategy', 
      'quota', 'odds', 'profit', 'profitto', 'evento', 'event', 'home', 'casa',
      'away', 'trasferta', 'esito', 'result', 'stake', 'roi', 'points', 'punti'
    ];

    for (let i = 0; i < Math.min(data.length, 50); i++) {
      const row = data[i];
      const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
      let matches = 0;
      keywords.forEach(k => {
        if (rowText.includes(k)) matches++;
      });
      
      // Riduciamo la soglia a 3 match per essere più flessibili
      if (matches > maxMatches && matches >= 3) {
        maxMatches = matches;
        headerRowIndex = i;
      }
    }

    // Converti in oggetti usando la riga di header trovata
    const headers = data[headerRowIndex].map(h => String(h || '').trim());
    const trades: Trade[] = [];

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      
      // Crea un oggetto con le colonne (preserva i tipi originali, specialmente i numeri per le date Excel)
      const rowObj: any = {};
      headers.forEach((header, idx) => {
        if (header && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
          rowObj[header] = row[idx];
        }
      });

      // Estrai data - può essere un numero Excel, quindi non usiamo getValue che converte in stringa
      let dateValue: string | number = '';
      const dateHeaders = ['Data', 'Date', 'Giorno', 'Day', 'Fecha', 'Datum'];
      for (const header of dateHeaders) {
        if (rowObj[header] !== undefined && rowObj[header] !== null && rowObj[header] !== '') {
          dateValue = rowObj[header];
          break;
        }
      }
      
      // Cerca anche case-insensitive
      if (!dateValue) {
        const rowKeys = Object.keys(rowObj);
        for (const header of dateHeaders) {
          const foundKey = rowKeys.find(k => k.toLowerCase().trim() === header.toLowerCase());
          if (foundKey && rowObj[foundKey] !== undefined && rowObj[foundKey] !== null && rowObj[foundKey] !== '') {
            dateValue = rowObj[foundKey];
            break;
          }
        }
      }
      
      const competition = getValue(rowObj, [
        'Competizione', 'Competition', 'League', 'Lega', 'Campionato',
        'Tournament', 'Torneo', 'Championship'
      ]);
      
      const strategy = getValue(rowObj, [
        'Strategia', 'Strategy', 'Type', 'Tipo', 'Metodo', 'Method',
        'Sistema', 'System', 'Mercato', 'Market'
      ]);
      
      const home = getValue(rowObj, [
        'Casa', 'Home', 'Team1', 'Team 1', 'Squadra Casa', 'Home Team',
        'HomeTeam', 'Casa Team', 'Local'
      ]);
      
      const away = getValue(rowObj, [
        'Trasferta', 'Away', 'Team2', 'Team 2', 'Squadra Trasferta',
        'Away Team', 'AwayTeam', 'Trasferta Team', 'Visitante', 'Visitor'
      ]);

      // Validazione - salta righe vuote o di sommario
      if (!dateValue && !competition && !strategy) continue;
      
      // Salta righe con "Evento" = 0 (sono righe di riepilogo)
      const eventoStr = getValue(rowObj, ['Evento', 'Event', '#', 'N', 'Num']).trim();
      if (eventoStr === '0') continue;
      
      if (competition.toUpperCase().includes('TOTALE') || 
          competition.toUpperCase().includes('CASSA') ||
          strategy.toUpperCase().includes('TOTALE')) {
        continue;
      }

      // Normalizza risultato
      let result = TradeResult.OPEN;
      const resStr = getValue(rowObj, [
        'Esito', 'W/L/V', 'W/L', 'Result', 'Risultato', 'Win', 'Status',
        'Outcome', 'State', 'Stato', 'Win/Loss', 'Vincita'
      ]).toUpperCase();
      
      if (resStr.includes('WIN') || resStr.includes('WON') || resStr === '1' || resStr === 'W' || resStr === 'VINTA') result = TradeResult.WIN;
      else if (resStr.includes('LOSE') || resStr.includes('LOSS') || resStr.includes('LOST') || resStr === '0' || resStr === 'L' || resStr === 'PERSA') result = TradeResult.LOSE;
      else if (resStr.includes('VOID') || resStr === 'V' || resStr === 'RIMBORSO' || resStr.includes('REFUND')) result = TradeResult.VOID;
      
      // Parse numeri
      const odds = parseLocaleNumber(getValue(rowObj, [
        'Quota', 'Odds', 'Price', 'Prezzo', 'Quotazione', 'Odd', 'Cota'
      ]));
      
      const stakePct = parseLocaleNumber(getValue(rowObj, [
        'Stake %', 'StakePercent', 'StakePct', 'Stake Percentuale',
        'Percentuale Stake', '% Stake', 'Stake%', 'Puntata %'
      ]));
      
      const stakeEur = parseLocaleNumber(getValue(rowObj, [
        'Stake €', 'StakeEuro', 'Stake', 'Importo', 'Puntata',
        'Stake EUR', 'Amount', 'Ammontare', 'Bet Amount', 'Bet'
      ]));
      
      const pl = parseLocaleNumber(getValue(rowObj, [
        'Profit/Loss', 'Profitto', 'P/L', 'Netto', 'Profit',
        'ProfitLoss', 'Profit Loss', 'Guadagno', 'Utile',
        'Gain', 'Loss', 'Net', 'Net Profit', 'Rendimento'
      ]));
      
      const roi = parseLocaleNumber(getValue(rowObj, [
        'ROI', 'Yield', 'Return', 'Ritorno', 'Rendimento %', 'ROI %'
      ]));
      
      // Salta righe senza dati finanziari rilevanti
      if (odds === 0 && pl === 0 && !strategy) continue;

      const trade: Trade = {
        id: uuidv4(),
        date: normalizeDate(dateValue),
        competition: competition,
        homeTeam: home,
        awayTeam: away,
        strategy: strategy,
        odds: odds,
        stakePercent: stakePct,
        stakeEuro: stakeEur,
        matchedParts: 100,
        position: getValue(rowObj, [
          'Posizione', 'Position', 'Side', 'Lato', 'Tipo Posizione',
          'Back/Lay', 'Bet Type', 'Tipo Scommessa'
        ]),
        result: result,
        profitLoss: pl,
        roi: roi,
        points: parseLocaleNumber(getValue(rowObj, [
          'Punti', 'Points', 'Punteggio', 'Score', 'Pts'
        ])),
        notes: getValue(rowObj, [
          'Note', 'Notes', 'Commenti', 'Comments', 'Descrizione',
          'Description', 'Memo', 'Remark', 'Osservazioni'
        ]),
      };

      trades.push(trade);
    }

    return { trades, initialBank, currentBank };
  } catch (e) {
    console.warn("XLSX Parse error:", e);
    return { trades: [] };
  }
};
