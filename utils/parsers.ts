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

export const parseCSV = (file: File): Promise<Trade[]> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        resolve([]);
        return;
      }

      // 1. Heuristic Header Detection
      // We scan the first 50 lines to find the one that looks most like a header row.
      const lines = text.split(/\r\n|\n|\r/);
      let headerLineIndex = 0;
      let maxMatches = 0;
      
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
            // Extract core fields
            const dateStr = getValue(row, ['Data', 'Date']);
            const competition = getValue(row, ['Competizione', 'Competition', 'League']);
            const strategy = getValue(row, ['Strategia', 'Strategy', 'Type']);
            const home = getValue(row, ['Casa', 'Home', 'Team1']);
            const away = getValue(row, ['Trasferta', 'Away', 'Team2']);

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

            // Normalize Result
            let result = TradeResult.OPEN;
            const resStr = getValue(row, ['W/L/V', 'Result', 'Risultato', 'Esito', 'Win', 'Status']).toUpperCase();
            
            if (resStr.includes('WIN') || resStr === '1' || resStr === 'W' || resStr === 'VINTA') result = TradeResult.WIN;
            else if (resStr.includes('LOSE') || resStr.includes('LOSS') || resStr === '0' || resStr === 'L' || resStr === 'PERSA') result = TradeResult.LOSE;
            else if (resStr.includes('VOID') || resStr === 'V' || resStr === 'RIMBORSO') result = TradeResult.VOID;
            
            // Parse Numbers
            const odds = parseLocaleNumber(getValue(row, ['Quota', 'Odds', 'Price']));
            const stakePct = parseLocaleNumber(getValue(row, ['Stake %', 'StakePercent', 'StakePct']));
            const stakeEur = parseLocaleNumber(getValue(row, ['Stake €', 'StakeEuro', 'Stake', 'Importo']));
            const pl = parseLocaleNumber(getValue(row, ['Profit/Loss', 'Profitto', 'P/L', 'Netto', 'Profit']));
            const roi = parseLocaleNumber(getValue(row, ['ROI', 'Yield']));
            
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
              position: getValue(row, ['Posizione', 'Position', 'Side']),
              result: result,
              profitLoss: pl,
              roi: roi,
              points: parseLocaleNumber(getValue(row, ['Punti', 'Points'])),
              notes: getValue(row, ['Note', 'Notes', 'Commenti']),
            };

            trades.push(trade);
          });

          // Always resolve with whatever we found, never fail
          resolve(trades);
        },
        error: (error) => {
          console.warn("CSV Parse error:", error);
          resolve([]); // Fallback to empty, don't throw
        }
      });
    };

    reader.onerror = () => resolve([]);
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
      const getText = (tag: string) => {
        const el = node.querySelector(tag) || node.getElementsByTagName(tag)[0];
        return el ? el.textContent || '' : '';
      };

      // Basic XML mapping - generic approach
      const dateStr = getText('date') || getText('Data');
      if (!dateStr) return; // Skip if no date in XML

      const resultStr = (getText('result') || getText('Result')).toUpperCase();
      let result = TradeResult.OPEN;
      if (resultStr.includes('WIN')) result = TradeResult.WIN;
      else if (resultStr.includes('LOSE')) result = TradeResult.LOSE;
      else if (resultStr.includes('VOID')) result = TradeResult.VOID;

      trades.push({
        id: uuidv4(),
        date: normalizeDate(dateStr),
        competition: getText('competition') || getText('Competizione'),
        homeTeam: getText('home') || getText('Casa'),
        awayTeam: getText('away') || getText('Trasferta'),
        strategy: getText('strategy') || getText('Strategia'),
        odds: parseLocaleNumber(getText('odds') || getText('Quota')),
        stakePercent: parseLocaleNumber(getText('stakePercent') || getText('StakePct')),
        stakeEuro: parseLocaleNumber(getText('stakeEuro') || getText('Stake')),
        matchedParts: 100,
        position: getText('position'),
        result: result,
        profitLoss: parseLocaleNumber(getText('profitLoss') || getText('Profit')),
        roi: parseLocaleNumber(getText('roi') || getText('ROI')),
        notes: getText('notes')
      });
    });

    return trades;
  } catch (e) {
    console.warn("XML Parse error:", e);
    return [];
  }
};
