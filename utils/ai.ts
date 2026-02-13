import { CellData, Difficulty } from '../types';
import { evaluatePartialBoard, getAvailableNumbers } from './gameLogic';

interface Move {
  cellId: number;
  number: number;
}

export const getBestMove = (cells: CellData[], difficulty: Difficulty): Move | null => {
  const availableNums = getAvailableNumbers(cells);
  const emptyCells = cells.filter(c => c.value === null);

  if (availableNums.length === 0 || emptyCells.length === 0) return null;

  // --- EASY: Random Move ---
  if (difficulty === 'easy') {
    return getRandomMove(emptyCells, availableNums);
  }

  // --- MEDIUM: Greedy ---
  // Tries to win a row if possible, otherwise random.
  if (difficulty === 'medium') {
    // 30% chance to make a mistake (random move) to keep it beatable
    if (Math.random() < 0.3) {
      return getRandomMove(emptyCells, availableNums);
    }
    // Otherwise, try to find a move that immediately increases score or blocks
    const bestMove = findBestGreedyMove(cells, emptyCells, availableNums);
    return bestMove || getRandomMove(emptyCells, availableNums);
  }

  // --- HARD: Minimax with Alpha-Beta Pruning ---
  // Looks ahead to find the optimal strategy.
  if (difficulty === 'hard') {
    // If it's the very first move or two, random is fine to save computation and add variety
    // (10 numbers * 10 cells is too big for full depth immediately)
    if (availableNums.length > 8) {
       // Prefer center or master key slightly in opening? No, random is unpredictable.
       return findBestGreedyMove(cells, emptyCells, availableNums) || getRandomMove(emptyCells, availableNums);
    }
    
    // Determine depth based on remaining moves to keep performance good
    // Fewer empty cells = we can search deeper
    const depth = availableNums.length <= 6 ? 6 : 4; 
    
    return getMinimaxMove(cells, availableNums, depth);
  }

  return getRandomMove(emptyCells, availableNums);
};

// --- Helpers ---

const getRandomMove = (emptyCells: CellData[], availableNums: number[]): Move => {
  const randomNumIndex = Math.floor(Math.random() * availableNums.length);
  const randomCellIndex = Math.floor(Math.random() * emptyCells.length);
  return {
    cellId: emptyCells[randomCellIndex].id,
    number: availableNums[randomNumIndex]
  };
};

const findBestGreedyMove = (currentCells: CellData[], emptyCells: CellData[], availableNums: number[]): Move | null => {
  let bestMove: Move | null = null;
  let bestScore = -Infinity;

  // Simple 1-step lookahead
  for (const cell of emptyCells) {
    for (const num of availableNums) {
      // Simulate move
      const newCells = currentCells.map(c => c.id === cell.id ? { ...c, value: num } : c);
      const score = evaluatePartialBoard(newCells); // Returns (P2 - P1)
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = { cellId: cell.id, number: num };
      }
    }
  }
  return bestMove;
};

// --- Minimax Implementation ---

const getMinimaxMove = (cells: CellData[], availableNums: number[], maxDepth: number): Move => {
  let bestScore = -Infinity;
  let bestMove: Move | null = null;
  const emptyCells = cells.filter(c => c.value === null);
  
  // Alpha-Beta
  let alpha = -Infinity;
  let beta = Infinity;

  for (const cell of emptyCells) {
    for (const num of availableNums) {
      // 1. Make Move
      const nextCells = cells.map(c => c.id === cell.id ? { ...c, value: num } : c);
      const nextNums = availableNums.filter(n => n !== num);
      
      // 2. Call Minimax (Minimizing player next -> P1)
      const score = minimax(nextCells, nextNums, maxDepth - 1, alpha, beta, false);
      
      // 3. Undo (implicit by map/filter)

      if (score > bestScore) {
        bestScore = score;
        bestMove = { cellId: cell.id, number: num };
      }
      
      // Alpha update
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break; // Prune
    }
  }
  
  return bestMove || getRandomMove(emptyCells, availableNums);
};

const minimax = (
  cells: CellData[], 
  availableNums: number[], 
  depth: number, 
  alpha: number, 
  beta: number, 
  isMaximizing: boolean
): number => {
  const emptyCells = cells.filter(c => c.value === null);
  
  // Terminal State: Board Full
  if (emptyCells.length === 0) {
    return evaluatePartialBoard(cells) * 10; // Weight wins heavily
  }

  // Depth Limit Reached
  if (depth === 0) {
    return heuristicEvaluation(cells);
  }

  if (isMaximizing) { // P2 (CPU)
    let maxEval = -Infinity;
    for (const cell of emptyCells) {
      for (const num of availableNums) {
        // Optimization: Don't check every number if depth is high, maybe just high/low/mid?
        // For < 7 empty cells, checking all is fast enough.
        
        const nextCells = cells.map(c => c.id === cell.id ? { ...c, value: num } : c);
        const nextNums = availableNums.filter(n => n !== num);
        
        const evalScore = minimax(nextCells, nextNums, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      if (beta <= alpha) break;
    }
    return maxEval;
  } else { // P1 (Human) - Minimizing
    let minEval = Infinity;
    for (const cell of emptyCells) {
      for (const num of availableNums) {
        const nextCells = cells.map(c => c.id === cell.id ? { ...c, value: num } : c);
        const nextNums = availableNums.filter(n => n !== num);
        
        const evalScore = minimax(nextCells, nextNums, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

// Heuristic to guess who is winning in an unfinished game
const heuristicEvaluation = (cells: CellData[]): number => {
  const currentScore = evaluatePartialBoard(cells) * 10;
  
  // Add heuristic potential
  // e.g. if we have a high number in a row, and Master/Key suggests High wins, that's good.
  let potential = 0;
  
  // Basic check: if Master Key is set, do we have favorable numbers placed?
  const master = cells.find(c => c.type === 'master');
  if (master && master.value !== null) {
    const masterEven = master.value % 2 === 0;
    
    for(let r=0; r<3; r++) {
      const p2 = cells.find(c => c.row === r && c.type === 'p2');
      const key = cells.find(c => c.row === r && c.type === 'key');
      
      if (p2?.value && key?.value === null) {
         // Key not set. 
         // If P2 has a 10, it's generally good (unless Low wins).
         // This is a weak heuristic, simplified to avoid over-engineering.
      }
    }
  }

  return currentScore + potential;
};