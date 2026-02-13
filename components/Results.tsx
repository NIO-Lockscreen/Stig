import React from 'react';
import { GameResult } from '../types';
import { ArrowRight, RotateCcw } from 'lucide-react';

interface ResultsProps {
  result: GameResult;
  onRestart: () => void;
  playerNames: { p1: string; p2: string };
}

export const Results: React.FC<ResultsProps> = ({ result, onRestart, playerNames }) => {
  const isWinnerP1 = result.overallWinner === 'p1';
  const isWinnerP2 = result.overallWinner === 'p2';
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-stone-200 max-w-md w-full mx-auto mt-6 animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-ink mb-2">
          {result.overallWinner === 'tie' ? 'Det ble uavgjort!' : 
           result.overallWinner === 'p1' ? `${playerNames.p1} Vinner!` : `${playerNames.p2} Vinner!`}
        </h2>
        <div className="flex justify-center gap-8 text-xl font-bold">
          <div className={`flex flex-col items-center ${isWinnerP1 ? 'text-p1 scale-110' : 'text-stone-400'}`}>
            <span className="text-sm uppercase tracking-wide opacity-80">{playerNames.p1}</span>
            <span className="text-3xl">{result.p1Score}</span>
          </div>
          <div className="text-stone-300 py-2">vs</div>
          <div className={`flex flex-col items-center ${isWinnerP2 ? 'text-p2 scale-110' : 'text-stone-400'}`}>
            <span className="text-sm uppercase tracking-wide opacity-80">{playerNames.p2}</span>
            <span className="text-3xl">{result.p2Score}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-2">Forklaring av runder</h3>
        {result.rowResults.map((row, idx) => (
          <div key={idx} className="bg-paper p-3 rounded-lg border border-stone-100 text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-stone-500">Rad {idx + 1}</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${row.winner === 'p1' ? 'bg-p1 text-white' : row.winner === 'p2' ? 'bg-p2 text-white' : 'bg-stone-300'}`}>
                {row.winner === 'tie' ? 'Tie' : row.winner === 'p1' ? `${playerNames.p1} (+1p)` : `${playerNames.p2} (+1p)`}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-stone-600 mb-1">
              <span className="font-mono bg-master-light text-master-DEFAULT px-1 rounded">Master: {row.masterValue}</span>
              <span>vs</span>
              <span className="font-mono bg-key-light text-ink px-1 rounded">Key: {row.keyValue}</span>
              <ArrowRight size={12} />
              <span className="font-bold">
                {row.masterMatchesKey ? 'Lik type (Partall/Oddetall)' : 'Ulik type'}
              </span>
            </div>
            
            <div className="text-xs text-stone-500 italic">
               Regel: {row.masterMatchesKey ? 'Laveste' : 'Høyeste'} tall vinner. 
               ({row.p1Value} vs {row.p2Value})
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={onRestart}
        className="w-full py-3 bg-ink text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors"
      >
        <RotateCcw size={18} />
        Spill igjen
      </button>
    </div>
  );
};