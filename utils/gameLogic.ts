import { CellData, GameResult, RowResult } from '../types';

const isEven = (n: number) => n % 2 === 0;

// Helper to get score from a partial or full board state (for AI)
export const evaluatePartialBoard = (cells: CellData[]): number => {
  const masterKeyCell = cells.find(c => c.type === 'master');
  
  // If Master Key is not set, we can only estimate based on potential
  // But for Minimax, we usually just evaluate terminal states or use heuristics.
  // This function calculates the actual score difference (P2 - P1) for completed rows.
  
  let p1Score = 0;
  let p2Score = 0;
  
  const masterVal = masterKeyCell?.value;
  const masterIsEven = masterVal !== null && masterVal !== undefined ? isEven(masterVal) : null;

  for (let r = 0; r < 3; r++) {
    const p1Cell = cells.find(c => c.row === r && c.type === 'p1');
    const p2Cell = cells.find(c => c.row === r && c.type === 'p2');
    const keyCell = cells.find(c => c.row === r && c.type === 'key');

    if (p1Cell?.value !== null && p2Cell?.value !== null && keyCell?.value !== null && masterIsEven !== null) {
        // Row is complete and determinable
        const keyIsEven = isEven(keyCell!.value!);
        const masterMatchesKey = masterIsEven === keyIsEven;
        
        // Low wins if match, High wins if mismatch
        const reason = masterMatchesKey ? 'low' : 'high';
        
        if (reason === 'low') {
            if (p1Cell!.value! < p2Cell!.value!) p1Score++;
            else if (p2Cell!.value! < p1Cell!.value!) p2Score++;
        } else {
            if (p1Cell!.value! > p2Cell!.value!) p1Score++;
            else if (p2Cell!.value! > p1Cell!.value!) p2Score++;
        }
    }
  }

  return p2Score - p1Score;
};

export const calculateResults = (cells: CellData[]): GameResult => {
  const rowResults: RowResult[] = [];
  let p1Score = 0;
  let p2Score = 0;

  // Master Key is at index 9
  const masterKeyCell = cells.find(c => c.type === 'master');
  if (!masterKeyCell || masterKeyCell.value === null) {
    throw new Error("Master key missing");
  }
  const masterVal = masterKeyCell.value;
  const masterIsEven = isEven(masterVal);

  // Process rows 0, 1, 2
  for (let r = 0; r < 3; r++) {
    const p1Cell = cells.find(c => c.row === r && c.type === 'p1');
    const p2Cell = cells.find(c => c.row === r && c.type === 'p2');
    const keyCell = cells.find(c => c.row === r && c.type === 'key');

    if (!p1Cell || !p2Cell || !keyCell || 
        p1Cell.value === null || p2Cell.value === null || keyCell.value === null) {
        // Should not happen if game is finished
        continue;
    }

    const keyIsEven = isEven(keyCell.value);
    
    // Parity Check
    // "Hvis Master key er samme type tall som Key ... vil spilleren med lavest nummer vinne."
    // "Hvis master key er ulik type tall som Key, vil spilleren med høyest nummer vinne."
    const masterMatchesKey = masterIsEven === keyIsEven;
    
    let winner: 'p1' | 'p2' | 'tie' = 'tie';
    const reason: 'low' | 'high' = masterMatchesKey ? 'low' : 'high';

    if (reason === 'low') {
      if (p1Cell.value < p2Cell.value) winner = 'p1';
      else if (p2Cell.value < p1Cell.value) winner = 'p2';
    } else {
      if (p1Cell.value > p2Cell.value) winner = 'p1';
      else if (p2Cell.value > p1Cell.value) winner = 'p2';
    }

    if (winner === 'p1') p1Score++;
    if (winner === 'p2') p2Score++;

    rowResults.push({
      rowId: r,
      winner,
      reason,
      p1Value: p1Cell.value,
      p2Value: p2Cell.value,
      keyValue: keyCell.value,
      masterValue: masterVal,
      masterMatchesKey
    });
  }

  let overallWinner: 'p1' | 'p2' | 'tie' = 'tie';
  if (p1Score > p2Score) overallWinner = 'p1';
  if (p2Score > p1Score) overallWinner = 'p2';

  return {
    rowResults,
    p1Score,
    p2Score,
    overallWinner
  };
};

export const getAvailableNumbers = (cells: CellData[]): number[] => {
  const used = new Set(cells.map(c => c.value).filter((v): v is number => v !== null));
  const all = Array.from({ length: 10 }, (_, i) => i + 1);
  return all.filter(n => !used.has(n));
};