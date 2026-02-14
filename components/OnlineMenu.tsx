import React, { useState, useEffect } from 'react';
import { PlayerStats } from '../types';
import { Crown, Globe, Lock, Search, Loader2, AlertCircle } from 'lucide-react';

interface OnlineMenuProps {
  stats: PlayerStats;
  population: 'High' | 'Low';
  isLoading?: boolean;
  error?: string | null;
  onFindMatch: (playerName: string) => void;
  onPrivateAction: (action: 'create' | 'join', playerName: string, key?: string) => void;
  onBack: () => void;
  onClearError: () => void;
}

export const OnlineMenu: React.FC<OnlineMenuProps> = ({ 
  stats, 
  population, 
  isLoading = false,
  error = null,
  onFindMatch, 
  onPrivateAction, 
  onBack,
  onClearError
}) => {
  const [name, setName] = useState(stats.name || '');
  const [privateKey, setPrivateKey] = useState('');
  const [mode, setMode] = useState<'select' | 'private'>('select');
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear errors when switching modes
  useEffect(() => {
    setLocalError(null);
    onClearError();
  }, [mode, onClearError]);

  const hasCrown = stats.wins >= 3;
  const crownScale = 1 + (stats.currentStreak * 0.2);

  const validateName = () => {
    if (!name.trim()) {
      setLocalError("Du må skrive et navn!");
      return false;
    }
    return true;
  };

  const handleMatchmaking = () => {
    if (isLoading) return;
    if (!validateName()) return;
    onFindMatch(name);
  };

  const handleJoinPrivate = () => {
    if (isLoading) return;
    if (!validateName()) return;
    if (!privateKey.trim() || privateKey.length !== 4) {
      setLocalError("Koden må være 4 siffer!");
      return;
    }
    onPrivateAction('join', name, privateKey);
  };

  const handleCreatePrivate = () => {
    if (isLoading) return;
    if (!validateName()) return;
    // Generate a simple 4-digit key
    const randomKey = Math.floor(1000 + Math.random() * 9000).toString();
    onPrivateAction('create', name, randomKey);
  };

  return (
    <div className="w-full animate-fade-in-up">
      {/* Stats Header */}
      <div className="bg-stone-100 rounded-xl p-4 mb-6 text-center relative">
        <div className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-1">Din Profil</div>
        
        <div className="flex flex-col items-center justify-center mb-2">
           <div className="relative">
             {hasCrown && (
               <div 
                 className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 drop-shadow-md transition-transform duration-500 pointer-events-none z-20"
                 style={{ transform: `translateX(-50%) scale(${crownScale})` }}
               >
                 <Crown fill="currentColor" size={24} />
               </div>
             )}
             <input 
               type="text" 
               value={name}
               onChange={(e) => { setName(e.target.value); setLocalError(null); }}
               placeholder="Ditt Navn"
               className="bg-white border border-stone-300 text-center font-bold text-xl rounded-lg py-1 px-3 w-40 text-ink focus:ring-2 focus:ring-p1 outline-none relative z-10"
             />
           </div>
        </div>

        <div className="flex justify-center gap-6 text-sm relative z-10">
          <div>
            <div className="text-stone-500 font-bold">Wins</div>
            <div className="text-lg font-extrabold text-p1">{stats.wins}</div>
          </div>
          <div>
            <div className="text-stone-500 font-bold">Streak</div>
            <div className={`text-lg font-extrabold ${stats.currentStreak > 2 ? 'text-orange-500 animate-pulse' : 'text-stone-600'}`}>
              {stats.currentStreak} 🔥
            </div>
          </div>
        </div>
        
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-stone-400 bg-stone-200/50 py-1 rounded-full w-fit mx-auto px-3 relative z-10">
           <Globe size={12} />
           Players Online: <span className={population === 'High' ? 'text-green-600' : 'text-stone-500'}>{population}</span>
        </div>
      </div>

      {/* Error Display */}
      {(localError || error) && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse border border-red-100">
           <AlertCircle size={18} />
           {localError || error}
        </div>
      )}

      {mode === 'select' ? (
        <div className="space-y-3">
          <button 
            onClick={handleMatchmaking}
            disabled={isLoading}
            className="w-full py-4 bg-ink text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
            Finn Kamp (Matchmaking)
          </button>

          <button 
            onClick={() => setMode('private')}
            disabled={isLoading}
            className="w-full py-4 bg-white text-ink border-2 border-stone-200 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all disabled:opacity-70"
          >
            <Lock size={20} />
            Privat Kamp
          </button>
        </div>
      ) : (
        <div className="space-y-4">
           <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
              {isLoading && (
                 <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl">
                    <Loader2 className="animate-spin text-ink" size={32} />
                 </div>
              )}
              <h3 className="font-bold text-ink mb-4 text-center text-lg">Bli med i Privat Lobby</h3>
              
              <div className="relative mb-6">
                 <input 
                    type="text" 
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="____"
                    value={privateKey}
                    onChange={(e) => {
                       const val = e.target.value.replace(/[^0-9]/g, '');
                       setPrivateKey(val);
                       setLocalError(null);
                       onClearError();
                    }}
                    className="w-full text-center text-5xl font-mono tracking-[0.2em] border-b-4 border-stone-200 py-2 focus:border-ink outline-none placeholder:text-stone-200 text-ink bg-transparent transition-colors"
                 />
                 <div className="text-center text-xs text-stone-400 mt-2 font-bold uppercase tracking-wider">Skriv inn 4-sifret kode</div>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                   onClick={handleJoinPrivate} 
                   className="w-full bg-p1 text-white font-bold py-3.5 rounded-xl hover:bg-p1-dark shadow-md active:scale-95 transition-transform text-lg"
                 >
                   Bli med
                 </button>
                 
                 <div className="flex items-center gap-2 py-2">
                    <div className="h-px bg-stone-200 flex-1"></div>
                    <span className="text-xs text-stone-400 font-bold">ELLER</span>
                    <div className="h-px bg-stone-200 flex-1"></div>
                 </div>
                 
                 <button 
                   onClick={handleCreatePrivate} 
                   className="w-full bg-stone-100 text-ink font-bold py-3 rounded-xl hover:bg-stone-200 border-2 border-transparent hover:border-stone-300 transition-colors"
                 >
                   Lag ny lobby
                 </button>
              </div>
           </div>
           <button onClick={() => setMode('select')} disabled={isLoading} className="w-full text-stone-400 text-sm font-bold hover:text-ink disabled:opacity-50">Avbryt</button>
        </div>
      )}

      <div className="mt-6 border-t border-stone-200 pt-4">
        <button 
          onClick={onBack}
          disabled={isLoading}
          className="w-full py-2 text-stone-400 hover:text-stone-600 font-bold text-sm disabled:opacity-50"
        >
          Tilbake til hovedmeny
        </button>
      </div>
    </div>
  );
};
