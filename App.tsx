import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_CELLS, TOTAL_NUMBERS, BOT_NAMES } from './constants';
import { CellData, Difficulty, GameMode, GameResult, GameStatus, Player, PlayerStats, OnlineGameData, OnlinePlayer } from './types';
import { calculateResults, getAvailableNumbers, evaluatePartialBoard } from './utils/gameLogic';
import { getBestMove } from './utils/ai';
import { fetchOnlineData, updateOnlineData, generateUUID, cleanupOldData, transactionalUpdate, placeMove, autoCleanup } from './utils/online';
import { Grid } from './components/Grid';
import { NumberPickerModal } from './components/NumberPickerModal';
import { NameEditModal } from './components/NameEditModal';
import { Results } from './components/Results';
import { OnlineMenu } from './components/OnlineMenu';
import { Users, Info, Cpu, ChevronLeft, Loader2, Wifi, WifiOff, Crown, Copy, Check, Globe } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    // Initial cleanup
    autoCleanup();
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

  // --- DEBUG FUNCTION (Press X to skip turn or increment stats) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Debug: Skip turn in CPU mode
      if (key === 'x' && status === 'playing' && mode === 'cpu' && currentPlayer === 'p1') {
        setCurrentPlayer('p2'); 
      }

      // Debug: Increment Stats in Online Setup
      if (key === 'x' && status === 'online_setup') {
         const newStats = { 
           ...myStats, 
           wins: myStats.wins + 1, 
           currentStreak: myStats.currentStreak + 1 
         };
         saveStats(newStats);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, mode, currentPlayer, myStats]);

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

  // --- TURN TIMER & SYNC ---
  useEffect(() => {
    let interval: number;
    
    // Offline/Bot Timer
    if (status === 'playing' && mode === 'online_bot') {
       interval = window.setInterval(() => {
          setTurnTimer(prev => {
             if (prev <= 0) {
                setCurrentPlayer(p => p === 'p1' ? 'p2' : 'p1');
                return 30;
             }
             return prev - 1;
          });
       }, 1000);
    }

    return () => clearInterval(interval);
  }, [status, mode]);

  const handleTurnTimeout = async () => {
     if (mode === 'online' && activeGameId) {
        const success = await transactionalUpdate((data) => {
          const game = data.active_games[activeGameId];
          if (!game) return null;
          
          const amIP1 = game.p1.id === onlineId;
          const isMyTurn = (game.currentTurn === 'p1' && amIP1) || (game.currentTurn === 'p2' && !amIP1);

          // Only waiting player enforces timeout
          if (!isMyTurn) {
             const elapsed = (Date.now() - game.lastUpdate) / 1000;
             if (elapsed >= 30) {
                game.currentTurn = game.currentTurn === 'p1' ? 'p2' : 'p1';
                game.lastUpdate = Date.now();
                return data;
             }
          }
          return null;
        });
     }
  };

  const startBotMatch = () => {
    const randomBotName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    setPlayerNames({ p1: myStats.name, p2: randomBotName });
    setMode('online_bot');
    setDifficulty(Math.random() > 0.5 ? 'medium' : 'easy'); 
    
    // Remove from waiting list
    transactionalUpdate((data) => {
      data.waiting_players = data.waiting_players.filter(p => p.id !== onlineId);
      return data;
    });

    setCells(INITIAL_CELLS.map(c => ({ ...c, value: null })));
    setCurrentPlayer('p1');
    setActiveCellId(null);
    setResult(null);
    setStatus('playing');
    setTurnTimer(30);
  };

  // --- IMPROVED POLLING (1 second for active games) ---
  useEffect(() => {
    if ((mode === 'online' && activeGameId) || (status === 'matchmaking' && activeGameId && privateLobbyKey)) {
      pollInterval.current = window.setInterval(async () => {
        // Don't poll while submitting
        if (isSubmitting) return;

        const data = await fetchOnlineData(1); // Quick retry
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

            // Sync State only if different
            const cellsChanged = JSON.stringify(game.cells) !== JSON.stringify(cells);
            const turnChanged = game.currentTurn !== currentPlayer;
            
            if (cellsChanged) {
               setCells(game.cells);
            }
            if (turnChanged) {
               setCurrentPlayer(game.currentTurn);
            }

            // Sync Timer
            const elapsed = (Date.now() - game.lastUpdate) / 1000;
            const remaining = Math.max(0, 30 - Math.floor(elapsed));
            setTurnTimer(remaining);
            
            // Check Timeout
            const myTurn = (game.currentTurn === 'p1' && amIP1) || (game.currentTurn === 'p2' && !amIP1);
            if (remaining === 0 && !myTurn && !game.winner) {
               handleTurnTimeout();
            }

            // Winner check
            if (game.winner && !result) {
               const filledCount = game.cells.filter(c => c.value !== null).length;
               if (filledCount < TOTAL_NUMBERS) {
                  setDisconnectMsg("Opponent Disconnected / Timed Out");
               }
               finishGame(game.cells, true, game.winner);
            }
          }
        }
      }, 1000); // Reduced to 1 second for better responsiveness
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [mode, activeGameId, onlineId, status, privateLobbyKey, cells, currentPlayer, isSubmitting, result]);


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
      // Found opponent - create game
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

      const success = await transactionalUpdate((data) => {
        // Double-check opponent still waiting
        if (!data.waiting_players.find(p => p.id === opponent.id)) {
          return null; // Abort - opponent already matched
        }
        
        data.active_games[newGameId] = newGame;
        data.waiting_players = data.waiting_players.filter(p => p.id !== opponent.id);
        return data;
      });

      if (success) {
        setActiveGameId(newGameId);
        setIsHost(false);
        setPlayerNames({ p1: opponent.name, p2: playerName });
        setMode('online');
        setCells(newGame.cells);
        setCurrentPlayer('p1');
        setStatus('playing');
      } else {
        // Failed to create game (opponent taken) - start bot match
        startBotMatch();
      }
    } else {
      // No opponent - join waiting list
      await transactionalUpdate((data) => {
        if (!data.waiting_players.find(p => p.id === onlineId)) {
          data.waiting_players.push({ id: onlineId, name: playerName, timestamp: Date.now() });
        }
        return data;
      });
      
      setStatus('matchmaking');
      setMatchmakingTime(0);
      
      // Poll for match
      const waitInterval = setInterval(async () => {
        const updatedData = await fetchOnlineData(1);
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
      }, 1500);
    }
    setIsLoadingOnline(false);
  };

  const handlePrivateAction = async (action: 'create' | 'join', playerName: string, key?: string) => {
    setIsLoadingOnline(true);
    setOnlineError(null);
    saveStats({ ...myStats, name: playerName });

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
       
       const success = await transactionalUpdate((data) => {
         data.active_games[newGameId] = newGame;
         return data;
       });

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
       const success = await transactionalUpdate((data) => {
         const gameId = Object.keys(data.active_games).find(gId => {
           const g = data.active_games[gId];
           return g.isPrivate && g.privateKey === key && g.p2 === null;
         });

         if (!gameId) {
           return null; // Lobby not found
         }

         const game = data.active_games[gameId];
         game.p2 = { id: onlineId, name: playerName, timestamp: Date.now() };
         game.lastUpdate = Date.now();
         
         // Store gameId for later
         (this as any).joinedGameId = gameId;
         (this as any).joinedGame = game;
         
         return data;
       });

       if (success && (this as any).joinedGameId) {
         const gameId = (this as any).joinedGameId;
         const game = (this as any).joinedGame;
         
         setActiveGameId(gameId);
         setIsHost(false);
         setPlayerNames({ p1: game.p1.name, p2: playerName });
         setMode('online');
         setCells(game.cells);
         setCurrentPlayer('p1');
         setStatus('playing');
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
      
      let isEasyMove = false;
      if (!isSpeedofile) {
        const available = getAvailableNumbers(cells);
        const currentScore = evaluatePartialBoard(cells);
        const empty = cells.filter(c => c.value === null);
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

      let minDelay = 3000;
      let maxDelay = 10000;
      if (isSpeedofile) {
        minDelay = 1000;
        maxDelay = 3000;
      } else if (isEasyMove) {
        minDelay = 2000;
        maxDelay = 4000;
      } else if (filledCount < 6) { 
        minDelay = 3000;
        maxDelay = 5000;
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
    if (isSubmitting) return;
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
    // 1. ONLINE MODE - Use transactional placeMove
    if (mode === 'online' && activeGameId) {
      setIsSubmitting(true);
      setOnlineError(null);
      
      const result = await placeMove(activeGameId, onlineId, cellId, numberVal);
      
      if (result.success && result.gameData) {
        // Update local state with server response
        setCells(result.gameData.cells);
        setCurrentPlayer(result.gameData.currentTurn);
        setTurnTimer(30);
        
        // Check for winner
        if (result.gameData.winner) {
          finishGame(result.gameData.cells, true, result.gameData.winner);
        }
      } else {
        setOnlineError(result.error || "Trekk feilet. Prøv igjen.");
        
        // Sync with server on failure
        const data = await fetchOnlineData(1);
        if (data?.active_games[activeGameId]) {
          const game = data.active_games[activeGameId];
          setCells(game.cells);
          setCurrentPlayer(game.currentTurn);
        }
      }
      
      setIsSubmitting(false);
      return;
    }

    // 2. OFFLINE / BOT MODE
    const newCells = cells.map(c => c.id === cellId ? { ...c, value: numberVal } : c);
    setCells(newCells);
    setTurnTimer(30);

    const filledCount = newCells.filter(c => c.value !== null).length;
    const nextPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';

    if (filledCount === TOTAL_NUMBERS) {
      finishGame(newCells);
    } else {
      setCurrentPlayer(nextPlayer);
    }
  };

  const finishGame = (finalCells: CellData[], fromRemote = false, explicitWinner?: Player | 'tie') => {
    try {
      const res = calculateResults(finalCells);
      setResult(res);
      setStatus('finished');
      setActiveGameId(null); 

      let iWon = false;
      const effectiveWinner = explicitWinner || res.overallWinner;

      if (mode === 'online' || mode === 'online_bot') {
        if (mode === 'online_bot' && !disconnectMsg) setDisconnectMsg(`${playerNames.p2} has disconnected.`);
        
        const amP1 = mode === 'online_bot' ? true : isHost; 
        if ((effectiveWinner === 'p1' && amP1) || (effectiveWinner === 'p2' && !amP1)) {
          iWon = true;
        }

        const newStats = { ...myStats };
        if (iWon) {
          newStats.wins += 1;
          newStats.currentStreak += 1;
        } else if (effectiveWinner !== 'tie') {
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
         if (isSubmitting) {
             setTurnMessage("Sender trekk...");
         } else {
             setTurnMessage(isMyTurn ? "Din tur!" : `Venter på ${currentPlayer === 'p1' ? playerNames.p1 : playerNames.p2}... (${turnTimer}s)`);
         }
      } else {
        const name = currentPlayer === 'p1' ? playerNames.p1 : playerNames.p2;
        setTurnMessage(`${name}, velg en rute`);
      }
    }
  }, [status, currentPlayer, mode, playerNames, isHost, turnTimer, isSubmitting]);

  const isValidMove = useCallback((cellId: number) => {
    if (status !== 'playing') return false;
    if (isSubmitting) return false;
    if ((mode === 'cpu' || mode === 'online_bot') && currentPlayer === 'p2') return false;
    if (mode === 'online') {
       if (isHost && currentPlayer === 'p2') return false;
       if (!isHost && currentPlayer === 'p1') return false;
    }

    const cell = cells.find(c => c.id === cellId);
    return cell ? cell.value === null : false;
  }, [status, cells, currentPlayer, mode, isHost, isSubmitting]);

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
                className="w-full py-4 bg-p1/10 hover:bg-p1/20 text-p1-dark rounded-xl font-bold flex items-center justify-center gap-3 transition-colors"
              >
                <Users size={20} />
                Spill mot venn (Lokalt)
              </button>
              
              <button 
                onClick={() => setMenuState('cpu_difficulty')}
                className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-ink rounded-xl font-bold flex items-center justify-center gap-3 transition-colors"
              >
                <Cpu size={20} />
                Spill mot CPU
              </button>

              <button 
                onClick={() => setStatus('online_setup')}
                className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-lg hover:shadow-violet-200 hover:-translate-y-0.5"
              >
                <Wifi size={20} />
                Spill Online
              </button>

              <button 
                onClick={() => setShowRules(true)}
                className="w-full py-2 text-stone-400 hover:text-stone-600 font-bold text-sm mt-4 flex items-center justify-center gap-2"
              >
                <Info size={16} />
                Regler
              </button>
            </div>
          ) : (
             <div className="space-y-4 animate-fade-in-up">
                <h3 className="text-lg font-bold text-ink">Velg Vanskelighetsgrad</h3>
                <button onClick={() => startNewGame('cpu', 'easy')} className="w-full py-3 bg-green-100 text-green-800 rounded-xl font-bold">Lett</button>
                <button onClick={() => startNewGame('cpu', 'medium')} className="w-full py-3 bg-yellow-100 text-yellow-800 rounded-xl font-bold">Medium</button>
                <button onClick={() => startNewGame('cpu', 'hard')} className="w-full py-3 bg-red-100 text-red-800 rounded-xl font-bold">Vanskelig</button>
                <button onClick={() => setMenuState('main')} className="w-full py-2 text-stone-400 font-bold text-sm">Tilbake</button>
             </div>
          )}
        </div>

        {/* Rules Modal */}
        {showRules && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-stone-400 hover:text-ink"><ChevronLeft /></button>
              <h2 className="text-2xl font-bold mb-4">Regler</h2>
              <ul className="space-y-3 text-stone-600 text-sm">
                <li>• Plasser tall fra 1-10 i rutene. Hver spiller har 5 tall.</li>
                <li>• Målet er å vinne flest av de 3 radene.</li>
                <li>• <strong>Master Key</strong> bestemmer reglene for hver rad.</li>
                <li>• Hvis en rads <strong>Key</strong> er samme type (partall/oddetall) som Master Key, vinner <strong>laveste</strong> tall.</li>
                <li>• Hvis de er ulik type, vinner <strong>høyeste</strong> tall.</li>
                <li>• Bruk hintene (piler) for å se hvem som leder raden!</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'online_setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
         <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100 relative">
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

  if (status === 'matchmaking') {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper">
         <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 text-center animate-pulse">
            <h2 className="text-2xl font-bold text-ink mb-4">Leter etter motstander...</h2>
            <div className="flex justify-center mb-6">
               <Loader2 className="animate-spin text-p1" size={48} />
            </div>
            
            {privateLobbyKey ? (
               <div className="bg-stone-100 p-4 rounded-xl mb-4">
                  <div className="text-sm font-bold text-stone-500 uppercase">Lobby Kode</div>
                  <div className="text-4xl font-mono font-extrabold text-ink tracking-widest my-2 flex items-center justify-center gap-3">
                     {privateLobbyKey}
                     <button onClick={() => navigator.clipboard.writeText(privateLobbyKey)} className="text-p1 hover:text-p1-dark active:scale-95 transition-transform"><Copy size={20}/></button>
                  </div>
                  <div className="text-xs text-stone-400">Del denne koden med en venn</div>
               </div>
            ) : (
               <p className="text-stone-500 mb-4">Tid: {matchmakingTime}s</p>
            )}

            <button 
              onClick={() => {
                 setStatus('menu');
                 setActiveGameId(null);
                 setPrivateLobbyKey(null);
              }}
              className="px-6 py-2 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded-lg font-bold transition-colors"
            >
              Avbryt
            </button>
         </div>
       </div>
     );
  }

  if (status === 'finished' && result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-paper relative overflow-hidden">
        {disconnectMsg && (
           <div className="absolute top-10 bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold shadow-sm flex items-center gap-2">
             <WifiOff size={16} />
             {disconnectMsg}
           </div>
        )}
        <Results 
          result={result} 
          onRestart={() => setStatus('menu')}
          playerNames={playerNames}
        />
      </div>
    );
  }

  // PLAYING STATE
  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-paper max-w-md mx-auto relative">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6 mt-2">
         <button onClick={() => setStatus('menu')} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-ink transition-colors">
            <ChevronLeft size={24} />
         </button>
         <div className={`font-bold text-lg px-4 py-1 rounded-full shadow-sm border ${
            currentPlayer === 'p1' ? 'bg-p1 text-white border-p1' : 'bg-p2 text-white border-p2'
         }`}>
            {turnMessage}
         </div>
         <div className="w-10"></div>
      </div>

      {/* Error Overlay */}
      {onlineError && (
          <div className="absolute top-20 left-4 right-4 z-50 bg-red-500 text-white p-3 rounded-lg shadow-lg text-center font-bold text-sm animate-bounce">
             {onlineError}
             <button 
               onClick={() => setOnlineError(null)}
               className="ml-2 underline"
             >
               Lukk
             </button>
          </div>
      )}

      {/* Grid */}
      <div className="w-full mb-8 relative">
          {/* Loading Overlay */}
          {isSubmitting && (
             <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-bold text-ink">
                   <Loader2 className="animate-spin" size={18} />
                   Sender trekk...
                </div>
             </div>
          )}
          
          <Grid 
            cells={cells}
            onCellClick={handleCellClick}
            isValidMove={isValidMove}
            currentPlayer={currentPlayer}
            results={realTimeResults.rowResults}
            playerNames={playerNames}
            onEditName={(p) => {
               if (mode === 'pvp') setEditingPlayer(p);
            }}
          />
      </div>

      {/* Footer Info */}
      <div className="mt-auto mb-4 text-center">
         {activeCellId === null ? (
            <p className="text-stone-400 text-sm font-bold">Trykk på en ledig rute</p>
         ) : (
            <p className="text-p1 font-bold animate-pulse">Velg et tall!</p>
         )}
      </div>

      {/* Modals */}
      {activeCellId !== null && (
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

export { App };
