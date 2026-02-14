
export type Player = 'p1' | 'p2';

export interface CellData {
  id: number; // 0-9
  value: number | null;
  type: 'p1' | 'p2' | 'key' | 'master';
  row?: number; // 0, 1, 2. Master is undefined or null
}

export type GameStatus = 'menu' | 'playing' | 'finished' | 'online_setup' | 'matchmaking';
export type GameMode = 'pvp' | 'cpu' | 'online' | 'online_bot';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface RowResult {
  rowId: number;
  winner: Player | 'tie';
  reason: 'low' | 'high'; // 'low' wins because keys match, 'high' wins because keys differ
  p1Value: number;
  p2Value: number;
  keyValue: number;
  masterValue: number;
  masterMatchesKey: boolean;
}

export interface GameResult {
  rowResults: RowResult[];
  p1Score: number;
  p2Score: number;
  overallWinner: Player | 'tie';
}

export interface PlayerStats {
  wins: number;
  currentStreak: number;
  name: string;
}

// Online Types
export interface OnlinePlayer {
  id: string;
  name: string;
  timestamp: number;
}

export interface OnlineGameData {
  id: string;
  p1: OnlinePlayer;
  p2: OnlinePlayer | null;
  cells: CellData[];
  currentTurn: Player;
  winner: Player | 'tie' | null;
  lastUpdate: number;
  isPrivate?: boolean;
  privateKey?: string;
}

export interface NPointData {
  waiting_players: OnlinePlayer[];
  active_games: Record<string, OnlineGameData>;
}
