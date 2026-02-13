import React, { useEffect, useState } from 'react';
import { Player } from '../types';
import { X } from 'lucide-react';

interface NumberPickerModalProps {
  availableNumbers: number[];
  onSelectNumber: (num: number) => void;
  onClose: () => void;
  currentPlayer: Player;
}

export const NumberPickerModal: React.FC<NumberPickerModalProps> = ({
  availableNumbers,
  onSelectNumber,
  onClose,
  currentPlayer,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation frame
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for animation
  };

  const handleSelect = (num: number) => {
    setIsVisible(false);
    setTimeout(() => onSelectNumber(num), 200);
  };

  const themeColor = currentPlayer === 'p1' ? 'bg-p1 text-white ring-p1' : 'bg-p2 text-white ring-p2';
  const hoverColor = currentPlayer === 'p1' ? 'hover:bg-p1-light' : 'hover:bg-p2-light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div 
        className={`
          relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[320px] transform transition-all duration-300
          ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
        `}
      >
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 text-stone-400 hover:text-ink p-1"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-center text-ink mb-6">
          Velg et tall
        </h3>

        <div className="grid grid-cols-3 gap-3 place-items-center">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
            const isAvailable = availableNumbers.includes(num);
            
            if (!isAvailable) {
               return null; // Don't show used numbers to keep it clean, or we can show disabled state
            }

            return (
              <button
                key={num}
                onClick={() => handleSelect(num)}
                className={`
                  w-16 h-16 flex items-center justify-center rounded-xl font-bold text-2xl shadow-sm transition-all transform hover:scale-105 active:scale-95
                  ${themeColor}
                `}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};