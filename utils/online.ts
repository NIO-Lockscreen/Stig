
import { NPointData, OnlineGameData, OnlinePlayer } from "../types";

// Updated Bin ID
const BIN_ID = "c45759a29630327f1266";
const API_URL = `https://api.npoint.io/${BIN_ID}`;

export const fetchOnlineData = async (): Promise<NPointData | null> => {
  let retries = 3;
  while (retries > 0) {
    try {
      // Add cache: 'no-store' to prevent browser caching of old game state
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure structure exists even if API returns empty object or null
      return {
        waiting_players: Array.isArray(data?.waiting_players) ? data.waiting_players : [],
        active_games: (data?.active_games && typeof data.active_games === 'object') ? data.active_games : {}
      };
    } catch (e) {
      console.warn(`Fetch attempt failed. Retries left: ${retries - 1}`, e);
      retries--;
      if (retries === 0) {
        console.error("Failed to fetch online data after multiple attempts", e);
        return null;
      }
      // Wait a bit before retrying
      await new Promise(res => setTimeout(res, 500));
    }
  }
  return null;
};

export const updateOnlineData = async (data: NPointData): Promise<boolean> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST', // NPoint uses POST to overwrite
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

  // Remove players waiting longer than 30 seconds (stale)
  const freshWaiting = (data.waiting_players || []).filter(p => (now - p.timestamp) < (30 * 1000));
  
  // Remove games older than 10 minutes
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
