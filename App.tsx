import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_CELLS, TOTAL_NUMBERS } from './constants';
import { CellData, Difficulty, GameMode, GameResult, GameStatus, Player } from './types';
import { calculateResults, getAvailableNumbers } from './utils/gameLogic';
import { getBestMove } from './utils/ai';
import { Grid } from './components/Grid';
import { NumberPickerModal } from './components/NumberPickerModal';
import { NameEditModal } from './components/NameEditModal';
import { Results } from './components/Results';
import { Users, User, Info, Cpu, ChevronLeft } from 'lucide-react';

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

  // Interaction State
  const [activeCellId, setActiveCellId] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [turnMessage, setTurnMessage] = useState<string>('');

  // Load Names on Mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const stored = localStorage.getItem('masterkey_names');
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          setPlayerNames(parsed.names);
        } else {
          localStorage.removeItem('masterkey_names');
        }
      } catch (e) {
        // Error reading
      }
    }
  }, []);

  const handleUpdateName = (name: string) => {
    if (editingPlayer) {
      const newNames = { ...playerNames, [editingPlayer]: name };
      setPlayerNames(newNames);
      
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('masterkey_names', JSON.stringify({
        date: today,
        names: newNames
      }));
      
      setEditingPlayer(null);
    }
  };

  // Determine available numbers
  const availableNumbers = getAvailableNumbers(cells);

  const startNewGame = (selectedMode: GameMode, selectedDiff?: Difficulty) => {
    setMode(selectedMode);
    if (selectedDiff) setDifficulty(selectedDiff);
    
    setCells(INITIAL_CELLS.map(c => ({ ...c, value: null })));
    setCurrentPlayer('p1');
    setStatus('playing');
    setResult(null);
    setActiveCellId(null);
    setMenuState('main');
  };

  // CPU Move Logic
  useEffect(() => {
    if (status === 'playing' && mode === 'cpu' && currentPlayer === 'p2') {
      const timer = setTimeout(() => {
        makeCpuMove();
      }, 600); // Slightly faster response
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentPlayer, mode, cells]);

  const makeCpuMove = () => {
    const move = getBestMove(cells, difficulty);
    if (move) {
      handlePlaceNumber(move.cellId, move.number);
    }
  };

  const handleCellClick = (cellId: number) => {
    // If it's CPU's turn, ignore clicks
    if (mode === 'cpu' && currentPlayer === 'p2') return;
    
    // Open the modal for this cell
    setActiveCellId(cellId);
  };

  const handleNumberSelected = (num: number) => {
    if (activeCellId !== null) {
      handlePlaceNumber(activeCellId, num);
      setActiveCellId(null);
    }
  };

  const handlePlaceNumber = (cellId: number, numberVal: number) => {
    const newCells = cells.map(c => c.id === cellId ? { ...c, value: numberVal } : c);
    setCells(newCells);

    // Check if full
    const filledCount = newCells.filter(c => c.value !== null).length;
    
    if (filledCount === TOTAL_NUMBERS) {
      finishGame(newCells);
    } else {
      setCurrentPlayer(prev => prev === 'p1' ? 'p2' : 'p1');
    }
  };

  const finishGame = (finalCells: CellData[]) => {
    try {
      const res = calculateResults(finalCells);
      setResult(res);
      setStatus('finished');
    } catch (e) {
      console.error("Game finish error", e);
    }
  };

  // Update UI Message based on state
  useEffect(() => {
    if (status === 'playing') {
      if (mode === 'cpu' && currentPlayer === 'p2') {
        setTurnMessage("Datamaskinen tenker...");
      } else {
        const name = currentPlayer === 'p1' ? playerNames.p1 : playerNames.p2;
        setTurnMessage(`${name}, velg en rute`);
      }
    }
  }, [status, currentPlayer, mode, playerNames]);

  const isValidMove = useCallback((cellId: number) => {
    if (status !== 'playing') return false;
    // Disable interaction if CPU is thinking
    if (mode === 'cpu' && currentPlayer === 'p2') return false;
    
    const cell = cells.find(c => c.id === cellId);
    return cell ? cell.value === null : false;
  }, [status, cells, currentPlayer, mode]);

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
                Spill mot Venn
              </button>
              <button 
                onClick={() => setMenuState('cpu_difficulty')}
                className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-ink rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border-2 border-transparent hover:border-stone-300"
              >
                <Cpu size={24} />
                Spill mot CPU
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in-up">
              <div className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-2">Velg vanskelighetsgrad</div>
              <button 
                onClick={() => startNewGame('cpu', 'easy')}
                className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold border-2 border-transparent hover:border-green-200 transition-colors"
              >
                Lett
              </button>
              <button 
                onClick={() => startNewGame('cpu', 'medium')}
                className="w-full py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-xl font-bold border-2 border-transparent hover:border-yellow-200 transition-colors"
              >
                Medium
              </button>
              <button 
                onClick={() => startNewGame('cpu', 'hard')}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold border-2 border-transparent hover:border-red-200 transition-colors"
              >
                Vanskelig
              </button>
              
              <button 
                onClick={() => setMenuState('main')}
                className="w-full py-2 text-stone-400 hover:text-stone-600 font-bold text-sm flex items-center justify-center gap-1 mt-2"
              >
                <ChevronLeft size={16} /> Tilbake
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-stone-100">
             <button onClick={() => setShowRules(true)} className="text-stone-400 hover:text-stone-600 text-sm flex items-center justify-center gap-1 mx-auto">
                <Info size={16} /> Hvordan spille?
             </button>
          </div>
        </div>

        <div className="mt-6 text-stone-400 text-xs font-bold tracking-widest uppercase opacity-50">
          Game by Stig Rune Bergly
        </div>

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

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-lg mx-auto w-full">
         <button onClick={() => setStatus('menu')} className="text-stone-400 hover:text-ink font-bold text-sm">
           &larr; Meny
         </button>
         <h1 className="font-bold text-ink text-lg">MasterKey</h1>
         <button onClick={() => setShowRules(true)} className="text-stone-400 hover:text-ink">
           <Info size={20} />
         </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 gap-6 max-w-lg mx-auto w-full">
        
        {/* Status Text */}
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
          </div>
        )}

        {/* The Grid */}
        <Grid 
          cells={cells}
          onCellClick={handleCellClick}
          isValidMove={(id) => isValidMove(id)}
          currentPlayer={currentPlayer}
          results={result ? result.rowResults : null}
          playerNames={playerNames}
          onEditName={(p) => setEditingPlayer(p)}
        />

        {/* Results View */}
        {status === 'finished' && result && (
          <Results 
            result={result} 
            onRestart={() => setStatus('menu')} 
            playerNames={playerNames}
          />
        )}

        <div className="mt-auto py-4 text-stone-400 text-xs font-bold tracking-widest uppercase opacity-50">
          Game by Stig Rune Bergly
        </div>

      </main>

      {/* Number Selection Modal */}
      {status === 'playing' && activeCellId !== null && (
        <NumberPickerModal 
          availableNumbers={availableNumbers}
          onSelectNumber={handleNumberSelected}
          onClose={() => setActiveCellId(null)}
          currentPlayer={currentPlayer}
        />
      )}

      {/* Name Edit Modal */}
      {editingPlayer && (
        <NameEditModal 
          player={editingPlayer}
          currentName={playerNames[editingPlayer]}
          onSave={handleUpdateName}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {/* Rules Modal */}
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
};

export default App;
