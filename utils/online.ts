// utils/online.ts - Fixed for npoint.io with conflict detection

import { OnlinePlayer, OnlineGameData } from '../types';

// Replace with your actual npoint.io URL
const NPOINT_URL = 'https://api.npoint.io/YOUR_BIN_ID_HERE';

export interface OnlineDataStore {
  version: number; // Critical: Version tracking for conflict detection
  lastCleanup: number;
  waiting_players: OnlinePlayer[];
  active_games: { [gameId: string]: OnlineGameData };
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // ms
const CONFLICT_RETRY_DELAY = 200; // ms for conflicts

// Exponential backoff helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch data from npoint.io with retry logic
 */
export const fetchOnlineData = async (retries = MAX_RETRIES): Promise<OnlineDataStore | null> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(NPOINT_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Initialize version if missing (backward compatibility)
      if (typeof data.version !== 'number') {
        data.version = 1;
      }
      
      return data as OnlineDataStore;
    } catch (error) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, error);
      
      if (attempt < retries) {
        await sleep(RETRY_DELAY * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  }
  
  return null;
};

/**
 * Update data with optimistic locking (version-based conflict detection)
 * Returns: { success: boolean, conflict: boolean, data?: OnlineDataStore }
 */
export const updateOnlineData = async (
  data: OnlineDataStore,
  maxConflictRetries = 3
): Promise<{ success: boolean; conflict: boolean; data?: OnlineDataStore }> => {
  
  for (let conflictAttempt = 0; conflictAttempt < maxConflictRetries; conflictAttempt++) {
    // Increment version before updating
    const updatedData = {
      ...data,
      version: data.version + 1,
    };

    try {
      const response = await fetch(NPOINT_URL, {
        method: 'POST', // npoint.io uses POST to update
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Success!
      return { success: true, conflict: false, data: updatedData };
      
    } catch (error) {
      console.error(`Update attempt ${conflictAttempt + 1} failed:`, error);
      
      // On failure, fetch latest data and check for conflicts
      await sleep(CONFLICT_RETRY_DELAY);
      const latestData = await fetchOnlineData(1);
      
      if (!latestData) {
        return { success: false, conflict: false };
      }

      // Detect conflict: someone else updated between our read and write
      if (latestData.version > data.version) {
        console.warn(`Conflict detected. Expected v${data.version + 1}, got v${latestData.version}`);
        
        // Return latest data so caller can retry with fresh state
        return { success: false, conflict: true, data: latestData };
      }
      
      // Network error, not a conflict - retry
      if (conflictAttempt === maxConflictRetries - 1) {
        return { success: false, conflict: false };
      }
    }
  }
  
  return { success: false, conflict: false };
};

/**
 * Transactional update with automatic conflict resolution
 * Takes a function that modifies the data and retries on conflicts
 */
export const transactionalUpdate = async (
  updateFn: (data: OnlineDataStore) => OnlineDataStore | null,
  maxRetries = 5
): Promise<boolean> => {
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 1. Fetch latest data
    const currentData = await fetchOnlineData();
    if (!currentData) {
      console.error('Failed to fetch data for transaction');
      await sleep(RETRY_DELAY * Math.pow(2, attempt));
      continue;
    }

    // 2. Apply update function
    const newData = updateFn(currentData);
    if (!newData) {
      // Update function returned null = abort transaction
      return false;
    }

    // 3. Try to commit
    const result = await updateOnlineData(newData);
    
    if (result.success) {
      return true;
    }
    
    if (result.conflict) {
      console.log(`Conflict on attempt ${attempt + 1}, retrying...`);
      await sleep(CONFLICT_RETRY_DELAY * (attempt + 1));
      continue;
    }
    
    // Network error
    await sleep(RETRY_DELAY * Math.pow(2, attempt));
  }
  
  console.error('Transaction failed after max retries');
  return false;
};

/**
 * Place a move with atomic conflict detection
 */
export const placeMove = async (
  gameId: string,
  playerId: string,
  cellId: number,
  numberVal: number
): Promise<{ success: boolean; error?: string; gameData?: OnlineGameData }> => {
  
  const result = await transactionalUpdate((data) => {
    const game = data.active_games[gameId];
    
    if (!game) {
      console.error('Game not found');
      return null;
    }

    // Validate turn
    const amIP1 = game.p1.id === playerId;
    const isMyTurn = (game.currentTurn === 'p1' && amIP1) || (game.currentTurn === 'p2' && !amIP1);
    
    if (!isMyTurn) {
      console.error('Not your turn');
      return null;
    }

    // Validate cell is empty
    const cell = game.cells.find(c => c.id === cellId);
    if (!cell || cell.value !== null) {
      console.error('Invalid cell');
      return null;
    }

    // Apply move
    game.cells = game.cells.map(c => 
      c.id === cellId ? { ...c, value: numberVal } : c
    );
    
    // Update turn
    const filledCount = game.cells.filter(c => c.value !== null).length;
    const TOTAL_NUMBERS = 10;
    
    if (filledCount < TOTAL_NUMBERS) {
      game.currentTurn = game.currentTurn === 'p1' ? 'p2' : 'p1';
    }
    
    game.lastUpdate = Date.now();
    
    data.active_games[gameId] = game;
    return data;
  });

  if (result) {
    // Fetch updated game state
    const data = await fetchOnlineData(1);
    if (data?.active_games[gameId]) {
      return { 
        success: true, 
        gameData: data.active_games[gameId] 
      };
    }
  }

  return { 
    success: false, 
    error: 'Failed to place move. Please try again.' 
  };
};

/**
 * Clean up old data (games older than 2 hours, waiting players older than 5 minutes)
 */
export const cleanupOldData = (data: OnlineDataStore): OnlineDataStore => {
  const now = Date.now();
  const GAME_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
  const WAITING_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  const newData = { ...data };

  // Clean old waiting players
  newData.waiting_players = (data.waiting_players || []).filter(
    p => now - p.timestamp < WAITING_TIMEOUT
  );

  // Clean old games
  const activeGames: { [key: string]: OnlineGameData } = {};
  Object.entries(data.active_games || {}).forEach(([id, game]) => {
    if (now - game.lastUpdate < GAME_TIMEOUT) {
      activeGames[id] = game;
    }
  });
  newData.active_games = activeGames;
  
  newData.lastCleanup = now;
  return newData;
};

/**
 * Auto-cleanup if needed
 */
export const autoCleanup = async (): Promise<void> => {
  const data = await fetchOnlineData();
  if (!data) return;
  
  const now = Date.now();
  const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  
  if (!data.lastCleanup || now - data.lastCleanup > CLEANUP_INTERVAL) {
    const cleaned = cleanupOldData(data);
    await updateOnlineData(cleaned);
  }
};

/**
 * Generate UUID
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
