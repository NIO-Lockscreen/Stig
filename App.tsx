
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_CELLS, TOTAL_NUMBERS, BOT_NAMES } from './constants';
import { CellData, Difficulty, GameMode, GameResult, GameStatus, Player, PlayerStats, OnlineGameData, OnlinePlayer } from './types';
import { calculateResults, getAvailableNumbers, evaluatePartialBoard } from './utils/gameLogic';
import { getBestMove } from './utils/ai';
import { fetchOnlineData, updateOnlineData, generateUUID, cleanupOldData } from './utils/online';
import { Grid } from './components/Grid';
import { NumberPickerModal } from './components/NumberPickerModal';
import { NameEditModal } from './components/NameEditModal';
import { Results } from './components/Results';
import { OnlineMenu } from './components/OnlineMenu';
import { Users, Info, Cpu, ChevronLeft, Loader2, Wifi, WifiOff, Crown, Copy, Check } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [cells, setCells] = useState<CellData[]>(INITIAL_CELLS);
  const [mode, setMode] = useState<GameMode>('pvp');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [currentPlayer, setCurrentPlayer] = useState<Player>('p1');
  
  // Menu State
  const [menuState, setMenuState] = useState<'main' | 'cpu_difficulty'>('main');

  // Name management
  const [playerNames, setPlayerNames] = useState({ p1: 'Spiller 1', p2: 'Spiller 2' });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Stats & Online State
  const [myStats, setMyStats] = useState<PlayerStats>({ wins: 0, currentStreak: 0, name: '' });
  const [onlineId, setOnlineId] = useState<string>('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [privateLobbyKey, setPrivateLobbyKey] = useState<string | null>(null);
  const [onlinePopulation, setOnlinePopulation] = useState<'High' | 'Low'>('Low');
  const [matchmakingTime, setMatchmakingTime] = useState(0);
  const [turnTimer, setTurnTimer] = useState(30);
  const [disconnectMsg, setDisconnectMsg] = useState('');
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  
  // Timeout tracking
  const [consecutiveOpponentSkips, setConsecutiveOpponentSkips] = useState(0);
  
  // Polling ref
  const pollInterval = useRef<number | null>(null);

  // Interaction State
  const [activeCellId, setActiveCellId] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [turnMessage, setTurnMessage] = useState<string>('');

  // Derived state for real-time feedback
  const realTimeResults = useMemo(() => calculateResults(cells), [cells]);

  // --- INIT & LOCAL STORAGE ---
  useEffect(() => {
    // Load local names
    const today = new Date().toISOString().split('T')[0];
    const storedNames = localStorage.getItem('masterkey_names');
    if (storedNames) {
      try {
        const parsed = JSON.parse(storedNames);
        if (parsed.date === today) setPlayerNames(parsed.names);
      } catch (e) {}
    }

    // Load Stats & ID
    const storedStats = localStorage.getItem('masterkey_stats');
    if (storedStats) {
      setMyStats(JSON.parse(storedStats));
    }
    
    let uid = localStorage.getItem('masterkey_uid');
    if (!uid) {
      uid = generateUUID();
      localStorage.setItem('masterkey_uid', uid);
    }
    setOnlineId(uid);

  }, []);

  const saveStats = (newStats: PlayerStats) => {
    setMyStats(newStats);
    localStorage.setItem('masterkey_stats', JSON.stringify(newStats));
  };

  const handleUpdateName = (name: string) => {
    if (editingPlayer) {
      const newNames = { ...playerNames, [editingPlayer]: name };
      setPlayerNames(newNames);
      // Save locally
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('masterkey_names', JSON.stringify({ date: today, names: newNames }));
      setEditingPlayer(null);
    }
  };

  // --- DEBUG FUNCTION (Press X to skip turn) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'x' && status === 'playing' && mode === 'cpu' && currentPlayer === 'p1') {
        setCurrentPlayer('p2'); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, mode, currentPlayer]);

  // --- ONLINE POLLING & LOGIC ---

  useEffect(() => {
    if (status === 'online_setup') {
      const checkPop = async () => {
        const data = await fetchOnlineData();
        if (data) {
           setOnlinePopulation((data.waiting_players?.length || 0) > 1 ? 'High' : 'Low');
        }
      };
      checkPop();
      const interval = setInterval(checkPop, 10000);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    let timer: number;
    if (status === 'matchmaking' && !privateLobbyKey) {
      timer = window.setInterval(() => {
        setMatchmakingTime(t => {
           // Increased to 20s to prioritize human matchmaking
           if (t >= 20) {
             startBotMatch();
             return 0;
           }
           return t + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, privateLobbyKey]);

  // --- TURN TIMER & TIMEOUT HANDLING ---
  useEffect(() => {
    let interval: number;
    if (status === 'playing' && (mode === 'online' || mode === 'online_bot')) {
      setTurnTimer(30); 
      
      interval = window.setInterval(() => {
        setTurnTimer(prev => {
          if (prev <= 0) {
            handleTurnTimeout();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, mode, currentPlayer, isHost, activeGameId, consecutiveOpponentSkips]); // Added deps for timeout handler

  const handleTurnTimeout = async () => {
     // Bot Mode / Offline
     if (mode === 'online_bot') {
        // Just skip to next player locally
        const next = currentPlayer === 'p1' ? 'p2' : 'p1';
        setCurrentPlayer(next);
        return;
     }

     // Real PvP Online - Enforce Rules
     if (mode === 'online' && activeGameId) {
        const amIP1 = isHost;
        const isMyTurn = (currentPlayer === 'p1' && amIP1) || (currentPlayer === 'p2' && !amIP1);

        // If it's NOT my turn, I enforce the timeout on the opponent
        if (!isMyTurn) {
           const newSkipCount = consecutiveOpponentSkips + 1;
           setConsecutiveOpponentSkips(newSkipCount);

           const data = await fetchOnlineData();
           if (data && data.active_games[activeGameId]) {
              const game = data.active_games[activeGameId];

              if (newSkipCount >= 2) {
                 // DISCONNECT LOGIC
                 game.winner = amIP1 ? 'p1' : 'p2'; // I win
                 await updateOnlineData(data);
                 setDisconnectMsg(`${playerNames[currentPlayer]} Disconnected`);
                 finishGame(cells, true);
              } else {
                 // SKIP TURN LOGIC
                 const nextPlayer = game.currentTurn === 'p1' ? 'p2' : 'p1';
                 game.currentTurn = nextPlayer;
                 game.lastUpdate = Date.now();
                 await updateOnlineData(data);
                 // We don't change local state immediately; polling will catch it
              }
           }
        }
     }
  };

  const forceRandomMove = () => {
    // Legacy function, kept if needed, but we now prefer skipping turns
    const available = getAvailableNumbers(cells);
    const empty = cells.filter(c => c.value === null);
    if (available.length > 0 && empty.length > 0) {
       const randNum = available[Math.floor(Math.random() * available.length)];
       const randCell = empty[Math.floor(Math.random() * empty.length)];
       handlePlaceNumber(randCell.id, randNum);
    }
  };

  const startBotMatch = () => {
    const randomBotName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    setPlayerNames({ p1: myStats.name, p2: randomBotName });
    setMode('online_bot');
    setDifficulty(Math.random() > 0.5 ? 'medium' : 'easy'); 
    
    fetchOnlineData().then(data => {
      if(data) {
        // Clean myself from waiting list
        data.waiting_players = data.waiting_players.filter(p => p.id !== onlineId);
        updateOnlineData(data);
      }
    });

    setCells(INITIAL_CELLS.map(c => ({ ...c, value: null })));
    setCurrentPlayer('p1');
    setActiveCellId(null);
    setResult(null);
    setStatus('playing');
  };

  // --- POLLING ---
  useEffect(() => {
    if ((mode === 'online' && activeGameId) || (status === 'matchmaking' && activeGameId && privateLobbyKey)) {
      pollInterval.current = window.setInterval(async () => {
        const data = await fetchOnlineData();
        if (data && data.active_games && data.active_games[activeGameId]) {
          const game = data.active_games[activeGameId];
          
          // Private Lobby Joined Check
          if (status === 'matchmaking' && game.p2 && privateLobbyKey) {
             setPlayerNames({ p1: game.p1.name, p2: game.p2.name });
             setMode('online');
             setStatus('playing');
             return;
          }

          // Game Sync
          if (status === 'playing') {
            const amIP1 = game.p1.id === onlineId;
            const myTurn = (game.currentTurn === 'p1' && amIP1) || (game.currentTurn === 'p2' && !amIP1);

            if (!myTurn) {
              // Check if a move was actually made (cells different)
              const cellsChanged = JSON.stringify(game.cells) !== JSON.stringify(cells);
              
              if (cellsChanged) {
                 setCells(game.cells);
                 // Reset consecutive skips because opponent made a move
                 setConsecutiveOpponentSkips(0);
              }

              setCurrentPlayer(game.currentTurn);
              
              if (game.winner) {
                 if (game.winner === (amIP1 ? 'p1' : 'p2')) {
                    // I won, possibly due to disconnect
                    const opponentName = amIP1 ? game.p2?.name : game.p1.name;
                    setDisconnectMsg(`${opponentName || 'Opponent'} Disconnected`);
                 }
                 finishGame(game.cells, true);
              }
            }
          }
        }
      }, 2000);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [mode, activeGameId, onlineId, status, privateLobbyKey, cells]);


  // --- GAME ACTIONS ---

  const startNewGame = (selectedMode: GameMode, selectedDiff?: Difficulty) => {
    setMode(selectedMode);
    if (selectedDiff) setDifficulty(selectedDiff);
    
    setCells(INITIAL_CELLS.map(c => ({ ...c, value: null })));
    setCurrentPlayer('p1');
    setStatus('playing');
    setResult(null);
    setActiveCellId(null);
    setMenuState('main');
    setDisconnectMsg('');
    setTurnTimer(30);
    setConsecutiveOpponentSkips(0);
    setPrivateLobbyKey(null);

    if (selectedMode === 'pvp') setPlayerNames({ p1: 'Spiller 1', p2: 'Spiller 2' });
    if (selectedMode === 'cpu') setPlayerNames({ p1: 'Du', p2: 'CPU' });
  };

  const handleFindMatch = async (playerName: string) => {
    setIsLoadingOnline(true);
    setOnlineError(null);
    saveStats({ ...myStats, name: playerName });
    setPrivateLobbyKey(null);
    setConsecutiveOpponentSkips(0);

    const data = await fetchOnlineData();
    if (!data) {
      setOnlineError("Kunne ikke koble til server.");
      setIsLoadingOnline(false);
      return;
    }

    const cleanData = cleanupOldData(data);
    const waiting = cleanData.waiting_players || [];
    const opponent = waiting.find(p => p.id !== onlineId);

    if (opponent) {
      const newGameId = generateUUID();
      const newGame: OnlineGameData = {
        id: newGameId,
        p1: opponent,
        p2: { id: onlineId, name: playerName, timestamp: Date.now() },
        cells: INITIAL_CELLS.map(c => ({ ...c, value: null })),
        currentTurn: 'p1',
        winner: null,
        lastUpdate: Date.now()
      };

      cleanData.active_games[newGameId] = newGame;
      cleanData.waiting_players = waiting.filter(p => p.id !== opponent.id);

      const success = await updateOnlineData(cleanData);
      if (success) {
        setActiveGameId(newGameId);
        setIsHost(false);
        setPlayerNames({ p1: opponent.name, p2: playerName });
        setMode('online');
        setCells(newGame.cells);
        setCurrentPlayer('p1');
        setStatus('playing');
      } else {
        startBotMatch();
      }
    } else {
      if (!waiting.find(p => p.id === onlineId)) {
        cleanData.waiting_players.push({ id: onlineId, name: playerName, timestamp: Date.now() });
        await updateOnlineData(cleanData);
      }
      setStatus('matchmaking');
      setMatchmakingTime(0);
      
      const waitInterval = setInterval(async () => {
        const updatedData = await fetchOnlineData();
        if (updatedData) {
           const myGameKey = Object.keys(updatedData.active_games).find(key => {
             const g = updatedData.active_games[key];
             return (g.p1.id === onlineId || (g.p2 && g.p2.id === onlineId)) && !g.isPrivate;
           });

           if (myGameKey) {
             clearInterval(waitInterval);
             const game = updatedData.active_games[myGameKey];
             setActiveGameId(myGameKey);
             setIsHost(game.p1.id === onlineId);
             setPlayerNames({ p1: game.p1.name, p2: game.p2?.name || 'Unknown' });
             setMode('online');
             setCells(game.cells);
             setCurrentPlayer('p1');
             setStatus('playing');
           }
        }
      }, 2000);
    }
    setIsLoadingOnline(false);
  };

  const handlePrivateAction = async (action: 'create' | 'join', playerName: string, key?: string) => {
    setIsLoadingOnline(true);
    setOnlineError(null);
    saveStats({ ...myStats, name: playerName });
    const data = await fetchOnlineData();
    
    if (!data) {
      setOnlineError("Kunne ikke koble til server. Sjekk internett?");
      setIsLoadingOnline(false);
      return;
    }
    
    const cleanData = cleanupOldData(data);

    if (action === 'create' && key) {
       const newGameId = generateUUID();
       const newGame: OnlineGameData = {
         id: newGameId,
         p1: { id: onlineId, name: playerName, timestamp: Date.now() },
         p2: null,
         cells: INITIAL_CELLS.map(c => ({ ...c, value: null })),
         currentTurn: 'p1',
         winner: null,
         lastUpdate: Date.now(),
         isPrivate: true,
         privateKey: key
       };
       
       cleanData.active_games[newGameId] = newGame;
       const success = await updateOnlineData(cleanData);
       if (success) {
          setActiveGameId(newGameId);
          setIsHost(true);
          setPrivateLobbyKey(key);
          setPlayerNames({ p1: playerName, p2: 'Venter...' });
          setStatus('matchmaking'); 
       } else {
          setOnlineError("Noe gikk galt. Prøv igjen.");
       }

    } else if (action === 'join' && key) {
       const gameId = Object.keys(cleanData.active_games).find(gId => {
         const g = cleanData.active_games[gId];
         return g.isPrivate && g.privateKey === key && g.p2 === null;
       });

       if (gameId) {
         const game = cleanData.active_games[gameId];
         game.p2 = { id: onlineId, name: playerName, timestamp: Date.now() };
         game.lastUpdate = Date.now();
         
         const success = await updateOnlineData(cleanData);
         if (success) {
            setActiveGameId(gameId);
            setIsHost(false);
            setPlayerNames({ p1: game.p1.name, p2: playerName });
            setMode('online');
            setCells(game.cells);
            setCurrentPlayer('p1');
            setStatus('playing');
         } else {
            setOnlineError("Kunne ikke bli med. Kanskje lobbyen ble full?");
         }
       } else {
         setOnlineError("Fant ingen ledig lobby med denne koden.");
       }
    }
    setIsLoadingOnline(false);
  };

  // --- CPU / BOT MOVE LOGIC & TIMING ---
  useEffect(() => {
    if (status === 'playing' && (mode === 'cpu' || mode === 'online_bot') && currentPlayer === 'p2') {
      const filledCount = cells.filter(c => c.value !== null).length;
      const isSpeedofile = playerNames.p2 === 'Speedofile';
      
      // Determine if there is an "easy / winning" move available
      let isEasyMove = false;
      if (!isSpeedofile) {
        const available = getAvailableNumbers(cells);
        const currentScore = evaluatePartialBoard(cells);
        const empty = cells.filter(c => c.value === null);
        
        // Simple 1-step lookahead to see if score improves (P2 winning a row)
        for (const cell of empty) {
          for (const num of available) {
             const tempCells = cells.map(c => c.id === cell.id ? {...c, value: num} : c);
             const newScore = evaluatePartialBoard(tempCells);
             if (newScore > currentScore) {
               isEasyMove = true;
               break;
             }
          }
          if (isEasyMove) break;
        }
      }

      // Time Logic
      let minDelay = 3000;
      let maxDelay = 10000;

      if (isSpeedofile) {
        // Speedofile always fast
        minDelay = 1000;
        maxDelay = 3000;
      } else if (isEasyMove) {
        // Winning move found
        minDelay = 2000;
        maxDelay = 4000;
      } else if (filledCount < 6) { 
        // First 3 turns for CPU (Moves 1, 3, 5 usually)
        minDelay = 3000;
        maxDelay = 5000;
      } else {
        // Default / Mid-Late game
        minDelay = 3000;
        maxDelay = 10000;
      }

      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      
      const timer = setTimeout(() => {
        makeCpuMove();
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [status, currentPlayer, mode, cells, playerNames]);

  const makeCpuMove = () => {
    const move = getBestMove(cells, difficulty);
    if (move) {
      handlePlaceNumber(move.cellId, move.number);
    }
  };

  const handleCellClick = (cellId: number) => {
    if (mode === 'cpu' && currentPlayer === 'p2') return;
    if (mode === 'online_bot' && currentPlayer === 'p2') return;
    
    if (mode === 'online') {
       if (isHost && currentPlayer === 'p2') return; 
       if (!isHost && currentPlayer === 'p1') return; 
    }

    setActiveCellId(cellId);
  };

  const handleNumberSelected = (num: number) => {
    if (activeCellId !== null) {
      handlePlaceNumber(activeCellId, num);
      setActiveCellId(null);
    }
  };

  const handlePlaceNumber = async (cellId: number, numberVal: number) => {
    const newCells = cells.map(c => c.id === cellId ? { ...c, value: numberVal } : c);
    setCells(newCells);
    setTurnTimer(30);

    const filledCount = newCells.filter(c => c.value !== null).length;
    const nextPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';

    if (mode === 'online' && activeGameId) {
       const data = await fetchOnlineData();
       if (data && data.active_games[activeGameId]) {
         const game = data.active_games[activeGameId];
         game.cells = newCells;
         game.currentTurn = filledCount === TOTAL_NUMBERS ? currentPlayer : nextPlayer; 
         game.lastUpdate = Date.now();
         updateOnlineData(data);
       }
    }

    if (filledCount === TOTAL_NUMBERS) {
      finishGame(newCells);
    } else {
      setCurrentPlayer(nextPlayer);
    }
  };

  const finishGame = (finalCells: CellData[], fromRemote = false) => {
    try {
      const res = calculateResults(finalCells);
      setResult(res);
      setStatus('finished');
      setActiveGameId(null); 

      let iWon = false;
      if (mode === 'online' || mode === 'online_bot') {
        // Only set default disconnect msg if one wasn't already set by the timeout logic
        if (mode === 'online_bot' && !disconnectMsg) setDisconnectMsg(`${playerNames.p2} has disconnected.`);
        
        const amP1 = mode === 'online_bot' ? true : isHost; 
        if ((res.overallWinner === 'p1' && amP1) || (res.overallWinner === 'p2' && !amP1)) {
          iWon = true;
        }

        const newStats = { ...myStats };
        if (iWon) {
          newStats.wins += 1;
          newStats.currentStreak += 1;
        } else if (res.overallWinner !== 'tie') {
          newStats.currentStreak = 0; 
        }
        saveStats(newStats);
      }

    } catch (e) {
      console.error("Game finish error", e);
    }
  };

  // Turn Message Logic
  useEffect(() => {
    if (status === 'playing') {
      if ((mode === 'cpu' || mode === 'online_bot') && currentPlayer === 'p2') {
        setTurnMessage(mode === 'online_bot' ? `${playerNames.p2} tenker...` : "Datamaskinen tenker...");
      } else if (mode === 'online') {
         const isMyTurn = (isHost && currentPlayer === 'p1') || (!isHost && currentPlayer === 'p2');
         setTurnMessage(isMyTurn ? "Din tur!" : `Venter på ${currentPlayer === 'p1' ? playerNames.p1 : playerNames.p2}... (${turnTimer}s)`);
      } else {
        const name = currentPlayer === 'p1' ? playerNames.p1 : playerNames.p2;
        setTurnMessage(`${name}, velg en rute`);
      }
    }
  }, [status, currentPlayer, mode, playerNames, isHost, turnTimer]);

  const isValidMove = useCallback((cellId: number) => {
    if (status !== 'playing') return false;
    if ((mode === 'cpu' || mode === 'online_bot') && currentPlayer === 'p2') return false;
    if (mode === 'online') {
       if (isHost && currentPlayer === 'p2') return false;
       if (!isHost && currentPlayer === 'p1') return false;
    }

    const cell = cells.find(c => c.id === cellId);
    return cell ? cell.value === null : false;
  }, [status, cells, currentPlayer, mode, isHost]);

  // --- RENDER ---

  if (status === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100 text-center transition-all">
          <h1 className="text-4xl font-extrabold text-ink mb-2 tracking-tight">MasterKey</h1>
          <p className="text-stone-500 mb-8">Et koselig strategispill</p>

          {menuState === 'main' ? (
            <div className="space-y-4 animate-fade-in-up">
              <button 
                onClick={() => startNewGame('pvp')}
                className="w-full py-4 bg-p1/10 hover:bg-p1/20 text-p1-dark rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border-2 border-transparent hover:border-p1/20"
              >
                <Users size={24} />
                Spill mot en Venn
              </button>
              <button 
                onClick={() => setMenuState('cpu_difficulty')}
                className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-ink rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border-2 border-transparent hover:border-stone-300"
              >
                <Cpu size={24} />
                Spill mot CPU
              </button>
              <button 
                onClick={() => setStatus('online_setup')}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <Wifi size={24} />
                Spill Online
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in-up">
              <div className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-2">Velg vanskelighetsgrad</div>
              <button onClick={() => startNewGame('cpu', 'easy')} className="w-full py-3 bg-green-50 text-green-700 rounded-xl font-bold">Lett</button>
              <button onClick={() => startNewGame('cpu', 'medium')} className="w-full py-3 bg-yellow-50 text-yellow-700 rounded-xl font-bold">Medium</button>
              <button onClick={() => startNewGame('cpu', 'hard')} className="w-full py-3 bg-red-50 text-red-700 rounded-xl font-bold">Vanskelig</button>
              <button onClick={() => setMenuState('main')} className="w-full py-2 text-stone-400 hover:text-stone-600 font-bold text-sm flex items-center justify-center gap-1 mt-2"><ChevronLeft size={16} /> Tilbake</button>
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-stone-100">
             <button onClick={() => setShowRules(true)} className="text-stone-400 text-sm flex items-center justify-center gap-1 mx-auto"><Info size={16} /> Hvordan spille?</button>
          </div>
        </div>
        <div className="mt-6 text-stone-400 text-xs font-bold tracking-widest uppercase opacity-50">Game by Stig Rune Bergly</div>
        
        {showRules && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowRules(false)}>
            <div className="bg-white p-6 rounded-2xl max-w-md shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-ink">Regler</h2>
              <ul className="list-disc pl-5 space-y-2 text-stone-600 text-sm">
                <li>Plasser tallene 1-10 i rutene.</li>
                <li>Tre rader gir 1 poeng hver.</li>
                <li><strong>Master Key</strong> (nederst) bestemmer reglene for hver rad.</li>
                <li>Hvis <strong>Key</strong> (rad-nøkkel) er av <strong>samme type</strong> (oddetall/partall) som Master Key: Lavest tall vinner.</li>
                <li>Hvis de er av <strong>ulik type</strong>: Høyest tall vinner.</li>
              </ul>
              <button onClick={() => setShowRules(false)} className="w-full py-2 bg-ink text-white rounded-lg font-bold mt-4">Forstått!</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- ONLINE SETUP SCREEN ---
  if (status === 'online_setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
         <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
            <h2 className="text-2xl font-extrabold text-ink mb-6 text-center">Spill Online</h2>
            <OnlineMenu 
               stats={myStats} 
               population={onlinePopulation}
               isLoading={isLoadingOnline}
               error={onlineError}
               onFindMatch={handleFindMatch}
               onPrivateAction={handlePrivateAction}
               onBack={() => setStatus('menu')}
               onClearError={() => setOnlineError(null)}
            />
         </div>
      </div>
    );
  }

  // --- MATCHMAKING / LOBBY SCREEN ---
  if (status === 'matchmaking') {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
         <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-12 border border-stone-100 text-center">
            
            {privateLobbyKey ? (
               // PRIVATE LOBBY WAITING UI
               <>
                  <div className="animate-bounce text-p1 mb-4 mx-auto w-fit"><Crown size={48} /></div>
                  <h2 className="text-xl font-bold text-ink mb-2">Lobby opprettet!</h2>
                  <p className="text-stone-400 text-sm mb-6">Del koden med en venn:</p>
                  
                  <div className="bg-stone-100 rounded-xl p-4 mb-6 flex items-center justify-center gap-3 cursor-pointer hover:bg-stone-200 transition-colors" onClick={() => navigator.clipboard.writeText(privateLobbyKey)}>
                     <span className="text-4xl font-mono tracking-widest font-bold text-ink">{privateLobbyKey}</span>
                     <Copy size={20} className="text-stone-400" />
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-stone-500 text-sm animate-pulse">
                     <Loader2 size={16} className="animate-spin" />
                     Venter på motstander...
                  </div>
               </>
            ) : (
               // REGULAR MATCHMAKING UI
               <>
                  <div className="animate-spin text-p1 mb-6 mx-auto w-fit"><Loader2 size={48} /></div>
                  <h2 className="text-xl font-bold text-ink mb-2">Leter etter motstander...</h2>
                  <p className="text-stone-400 text-sm mb-6">Tid: {matchmakingTime}s</p>
                  {matchmakingTime > 15 && (
                    <div className="text-xs text-stone-400 animate-pulse">
                       Ser etter ekte spillere...
                    </div>
                  )}
               </>
            )}

            <button onClick={() => setStatus('online_setup')} className="mt-8 text-stone-400 font-bold hover:text-ink text-sm">Avbryt</button>
         </div>
      </div>
     );
  }

  // --- MAIN GAME ---
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="p-4 flex justify-between items-center max-w-lg mx-auto w-full">
         <button onClick={() => { setStatus('menu'); setMode('pvp'); }} className="text-stone-400 hover:text-ink font-bold text-sm">
           &larr; Meny
         </button>
         <h1 className="font-bold text-ink text-lg">MasterKey</h1>
         
         <div className="flex items-center gap-2">
           {(mode === 'online' || mode === 'online_bot') && (
             <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${turnTimer < 10 ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-500'}`}>
               <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
               {turnTimer}s
             </div>
           )}
           <button onClick={() => setShowRules(true)} className="text-stone-400 hover:text-ink">
             <Info size={20} />
           </button>
         </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 gap-6 max-w-lg mx-auto w-full relative">
        
        {(mode === 'online' || mode === 'online_bot') && myStats.wins >= 3 && (
           <div className="absolute top-2 left-4 text-yellow-500 animate-bounce delay-700" style={{ transform: `scale(${1 + myStats.currentStreak * 0.1})` }}>
              <Crown size={24} fill="currentColor" />
           </div>
        )}

        {status === 'playing' && (
          <div className="flex flex-col items-center gap-1">
             <div className={`text-center px-6 py-2 rounded-full font-bold shadow-sm transition-colors ${currentPlayer === 'p1' ? 'bg-p1/10 text-p1-dark' : 'bg-p2/10 text-p2-dark'}`}>
              {turnMessage}
            </div>
            {mode === 'cpu' && (
               <div className="text-xs font-bold text-stone-300 uppercase tracking-widest">
                  CPU: {difficulty === 'easy' ? 'Lett' : difficulty === 'medium' ? 'Medium' : 'Vanskelig'}
               </div>
            )}
            {mode === 'online_bot' && (
               <div className="text-xs font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">
                  <Wifi size={12} /> Live Match
               </div>
            )}
          </div>
        )}

        <Grid 
          cells={cells}
          onCellClick={handleCellClick}
          isValidMove={(id) => isValidMove(id)}
          currentPlayer={currentPlayer}
          results={realTimeResults.rowResults}
          playerNames={playerNames}
          onEditName={(p) => (mode === 'pvp' ? setEditingPlayer(p) : null)} 
        />

        {status === 'finished' && result && (
          <div className="w-full">
            <Results 
              result={result} 
              onRestart={() => setStatus('menu')} 
              playerNames={playerNames}
            />
            {disconnectMsg && (
              <div className="mt-4 p-3 bg-stone-800 text-white text-center rounded-lg text-sm flex items-center justify-center gap-2">
                 <WifiOff size={16} /> {disconnectMsg}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto py-4 text-stone-400 text-xs font-bold tracking-widest uppercase opacity-50">
          Game by Stig Rune Bergly
        </div>

      </main>

      {status === 'playing' && activeCellId !== null && (
        <NumberPickerModal 
          availableNumbers={getAvailableNumbers(cells)}
          onSelectNumber={handleNumberSelected}
          onClose={() => setActiveCellId(null)}
          currentPlayer={currentPlayer}
        />
      )}

      {editingPlayer && (
        <NameEditModal 
          player={editingPlayer}
          currentName={playerNames[editingPlayer]}
          onSave={handleUpdateName}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
};

export default App;
