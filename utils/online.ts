
import { NPointData, OnlineGameData, OnlinePlayer } from "../types";
import { INITIAL_CELLS, TOTAL_NUMBERS } from "../constants";
import { calculateResults } from "./gameLogic";

const BIN_ID = "cf76e2d33157002605a4";
const API_URL = `https://api.npoint.io/${BIN_ID}`;

export const fetchOnlineData = async (retries = 0): Promise<NPointData | null> => {
  try {
    const response = await fetch(API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();
    
    return {
      waiting_players: Array.isArray(data?.waiting_players) ? data.waiting_players : [],
      active_games: (data?.active_games && typeof data.active_games === 'object') ? data.active_games : {}
    };
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      return fetchOnlineData(retries - 1);
    }
    console.error("Failed to fetch online data", e);
    return null;
  }
};

export const updateOnlineData = async (data: NPointData): Promise<boolean> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.ok;
  } catch (e) {
    console.error("Failed to update online data", e);
    return false;
  }
};

export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const cleanupOldData = (data: NPointData): NPointData => {
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;

  const freshWaiting = (data.waiting_players || []).filter(p => (now - p.timestamp) < (30 * 1000));
  
  const freshGames: Record<string, OnlineGameData> = {};
  if (data.active_games) {
    Object.entries(data.active_games).forEach(([key, game]) => {
      if (now - game.lastUpdate < TEN_MINUTES) {
        freshGames[key] = game;
      }
    });
  }

  return {
    waiting_players: freshWaiting,
    active_games: freshGames
  };
};

export const autoCleanup = async () => {
  const data = await fetchOnlineData();
  if (data) {
    const clean = cleanupOldData(data);
    // Simple check to see if cleanup actually changed anything before posting
    if (JSON.stringify(clean) !== JSON.stringify(data)) {
       await updateOnlineData(clean);
    }
  }
};

// --- Transactional Helpers ---

export const transactionalUpdate = async (
  updateFn: (data: NPointData) => NPointData | null
): Promise<boolean> => {
  // 1. Fetch latest
  const data = await fetchOnlineData(2); // 2 retries
  if (!data) return false;

  // 2. Apply logic
  const newData = updateFn(data);
  if (!newData) return false; // Logic decided to abort (e.g. game not found)

  // 3. Commit
  return await updateOnlineData(newData);
};

export const placeMove = async (
  gameId: string, 
  playerId: string, 
  cellId: number, 
  numberVal: number
): Promise<{ success: boolean, gameData?: OnlineGameData, error?: string }> => {
  
  let updatedGame: OnlineGameData | undefined;
  let errorMsg: string | undefined;

  const success = await transactionalUpdate((data) => {
    const game = data.active_games[gameId];
    if (!game) {
      errorMsg = "Spillet finnes ikke lenger.";
      return null;
    }

    // Validate turn again inside transaction
    const isP1 = game.p1.id === playerId;
    const isP2 = game.p2?.id === playerId;
    
    if (!isP1 && !isP2) {
      errorMsg = "Du er ikke med i dette spillet.";
      return null;
    }

    const isMyTurn = (game.currentTurn === 'p1' && isP1) || (game.currentTurn === 'p2' && isP2);
    if (!isMyTurn) {
      errorMsg = "Ikke din tur!";
      return null;
    }

    // Apply move
    const newCells = game.cells.map(c => c.id === cellId ? { ...c, value: numberVal } : c);
    game.cells = newCells;
    
    // Check completion
    const filledCount = newCells.filter(c => c.value !== null).length;
    
    if (filledCount === TOTAL_NUMBERS) {
      const res = calculateResults(newCells);
      game.winner = res.overallWinner;
    } else {
      game.currentTurn = game.currentTurn === 'p1' ? 'p2' : 'p1';
    }
    
    game.lastUpdate = Date.now();
    updatedGame = game;
    return data;
  });

  return { success, gameData: updatedGame, error: errorMsg };
};
