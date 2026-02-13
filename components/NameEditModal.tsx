import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../types';
import { X, Check } from 'lucide-react';

interface NameEditModalProps {
  player: Player;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const NameEditModal: React.FC<NameEditModalProps> = ({
  player,
  currentName,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(currentName);
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    // Focus input after animation start
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (name.trim()) {
      setIsVisible(false);
      setTimeout(() => onSave(name.trim()), 200);
    }
  };

  const themeColor = player === 'p1' ? 'text-p1 ring-p1' : 'text-p2 ring-p2';
  const bgColor = player === 'p1' ? 'bg-p1' : 'bg-p2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
        onClick={handleClose}
      />
      
      <div 
        className={`
          relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all duration-300
          ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
        `}
      >
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 text-stone-400 hover:text-ink p-1"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-center text-stone-500 mb-1 uppercase tracking-wider">
          Endre navn
        </h3>
        <h2 className={`text-2xl font-extrabold text-center mb-6 ${themeColor}`}>
          {player === 'p1' ? 'Spiller 1' : 'Spiller 2'}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            className={`w-full text-center text-xl font-bold border-b-2 border-stone-200 focus:border-ink outline-none py-2 px-4 bg-transparent transition-colors placeholder-stone-300 text-ink`}
            placeholder="Skriv navn..."
          />
          
          <button 
            type="submit"
            className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all ${bgColor}`}
          >
            <Check size={20} />
            Lagre Navn
          </button>
        </form>
      </div>
    </div>
  );
};