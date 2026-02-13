import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_CELLS, TOTAL_NUMBERS } from './constants';
import { CellData, GameMode, GameResult, GameStatus, Player } from './types';
import { calculateResults, getAvailableNumbers } from './utils/gameLogic';
import { Grid } from './components/Grid';
import { NumberPickerModal } from './components/NumberPickerModal';
import { Results } from './components/Results';
import { Users, User, Info, Cpu } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [cells, setCells] = useState<CellData[]>(INITIAL_CELLS);
  const [mode, setMode] = useState<GameMode>('pvp');
  const [currentPlayer, setCurrentPlayer] = useState<Player>('p1');
  
  // New state for the modal interaction
  const [activeCellId, setActiveCellId] = useState<number | null>(null);
  
  const [result, setResult] = useState<GameResult | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [turnMessage, setTurnMessage] = useState<string>('');

  // Determine available numbers
  const availableNumbers = getAvailableNumbers(cells);

  const startNewGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setCells(INITIAL_CELLS.map(c => ({ ...c, value: null })));
    setCurrentPlayer('p1');
    setStatus('playing');
    setResult(null);
    setActiveCellId(null);
  };

  // CPU Move Logic
  useEffect(() => {
    if (status === 'playing' && mode === 'cpu' && currentPlayer === 'p2') {
      const timer = setTimeout(() => {
        makeCpuMove();
      }, 1000); // 1s delay for natural feel
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentPlayer, mode, cells]);

  const makeCpuMove = () => {
    const availableNums = getAvailableNumbers(cells);
    const emptyCells = cells.filter(c => c.value === null);

    if (availableNums.length === 0 || emptyCells.length === 0) return;

    // Simple AI: Random Move
    const randomNumIndex = Math.floor(Math.random() * availableNums.length);
    const randomCellIndex = Math.floor(Math.random() * emptyCells.length);

    const num = availableNums[randomNumIndex];
    const cellId = emptyCells[randomCellIndex].id;

    handlePlaceNumber(cellId, num);
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
        setTurnMessage(currentPlayer === 'p1' ? "Spiller 1, velg en rute" : "Spiller 2, velg en rute");
      }
    }
  }, [status, currentPlayer, mode]);

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
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100 text-center">
          <h1 className="text-4xl font-extrabold text-ink mb-2 tracking-tight">MasterKey</h1>
          <p className="text-stone-500 mb-8">Et koselig strategispill</p>

          <div className="space-y-4">
            <button 
              onClick={() => startNewGame('pvp')}
              className="w-full py-4 bg-p1/10 hover:bg-p1/20 text-p1-dark rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border-2 border-transparent hover:border-p1/20"
            >
              <Users size={24} />
              Spill mot Venn
            </button>
            <button 
              onClick={() => startNewGame('cpu')}
              className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-ink rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border-2 border-transparent hover:border-stone-300"
            >
              <Cpu size={24} />
              Spill mot CPU
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-stone-100">
             <button onClick={() => setShowRules(true)} className="text-stone-400 hover:text-stone-600 text-sm flex items-center justify-center gap-1 mx-auto">
                <Info size={16} /> Hvordan spille?
             </button>
          </div>
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
          <div className={`text-center px-6 py-2 rounded-full font-bold shadow-sm transition-colors ${currentPlayer === 'p1' ? 'bg-p1/10 text-p1-dark' : 'bg-p2/10 text-p2-dark'}`}>
            {turnMessage}
          </div>
        )}

        {/* The Grid */}
        <Grid 
          cells={cells}
          onCellClick={handleCellClick}
          isValidMove={(id) => isValidMove(id)}
          currentPlayer={currentPlayer}
          results={result ? result.rowResults : null}
        />

        {/* Results View */}
        {status === 'finished' && result && (
          <Results result={result} onRestart={() => setStatus('menu')} />
        )}

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

      {/* Rules Modal (Repeated for accessibility in-game) */}
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