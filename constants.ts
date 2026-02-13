import { CellData } from './types';

// Grid Layout:
// 0 (P1) | 1 (P2) | 2 (Key)
// 3 (P1) | 4 (P2) | 5 (Key)
// 6 (P1) | 7 (P2) | 8 (Key)
//        9 (Master)

export const INITIAL_CELLS: CellData[] = [
  { id: 0, value: null, type: 'p1', row: 0 },
  { id: 1, value: null, type: 'p2', row: 0 },
  { id: 2, value: null, type: 'key', row: 0 },
  
  { id: 3, value: null, type: 'p1', row: 1 },
  { id: 4, value: null, type: 'p2', row: 1 },
  { id: 5, value: null, type: 'key', row: 1 },
  
  { id: 6, value: null, type: 'p1', row: 2 },
  { id: 7, value: null, type: 'p2', row: 2 },
  { id: 8, value: null, type: 'key', row: 2 },

  { id: 9, value: null, type: 'master' },
];

export const TOTAL_NUMBERS = 10;