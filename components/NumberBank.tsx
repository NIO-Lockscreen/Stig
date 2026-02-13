import React from 'react';
import { Player } from '../types';

interface NumberBankProps {
  availableNumbers: number[];
  selectedNumber: number | null;
  onSelectNumber: (num: number) => void;
  currentPlayer: Player;
  disabled: boolean;
}

export const NumberBank: React.FC<NumberBankProps> = ({
  availableNumbers,
  selectedNumber,
  onSelectNumber,
  currentPlayer,
  disabled
}) => {
  const themeColor = currentPlayer === 'p1' ? 'bg-p1 text-white ring-p1' : 'bg-p2 text-white ring-p2';
  const hoverColor = currentPlayer === 'p1' ? 'hover:bg-p1-light' : 'hover:bg-p2-light';

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto p-4 bg-white/50 rounded-xl shadow-sm border border-stone-200">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
        const isAvailable = availableNumbers.includes(num);
        const isSelected = selectedNumber === num;
        
        if (!isAvailable) {
          return (
            <div key={num} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-200 text-stone-400 font-bold cursor-not-allowed">
              {num}
            </div>
          );
        }

        return (
          <button
            key={num}
            disabled={disabled}
            onClick={() => onSelectNumber(num)}
            className={`
              w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg transition-all transform
              ${isSelected ? `scale-110 shadow-lg ring-2 ring-offset-2 ${themeColor}` : `bg-white text-ink border-2 border-stone-200 ${disabled ? '' : hoverColor} ${disabled ? 'opacity-50' : 'hover:-translate-y-1'}`}
            `}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
};