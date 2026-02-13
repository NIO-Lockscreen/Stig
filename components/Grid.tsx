import React from 'react';
import { CellData, Player, RowResult } from '../types';
import { ArrowDown, Hash, KeyRound, Trophy, Pencil } from 'lucide-react';

interface GridProps {
  cells: CellData[];
  onCellClick: (id: number) => void;
  isValidMove: (id: number) => boolean;
  currentPlayer: Player;
  results: RowResult[] | null;
  playerNames: { p1: string; p2: string };
  onEditName: (player: Player) => void;
}

export const Grid: React.FC<GridProps> = ({ 
  cells, 
  onCellClick, 
  isValidMove, 
  currentPlayer,
  results,
  playerNames,
  onEditName
}) => {
  
  const getCellContent = (cell: CellData) => {
    if (cell.value !== null) return cell.value;
    // Hints
    if (cell.type === 'master') return <KeyRound className="w-6 h-6 opacity-20" />;
    if (cell.type === 'key') return <Hash className="w-5 h-5 opacity-10" />;
    return null;
  };

  const getRowResult = (rowIdx: number) => results?.find(r => r.rowId === rowIdx);

  // Helper to determine cell styling
  const getCellStyle = (cell: CellData) => {
    let base = "relative flex items-center justify-center text-2xl font-bold rounded-lg border-2 shadow-sm transition-all duration-300 ";
    const isClickable = isValidMove(cell.id);

    // Color logic
    if (cell.type === 'p1') {
      base += cell.value !== null ? "bg-p1-light/30 border-p1 text-p1-dark" : "bg-white border-p1/30 text-p1/50";
    } else if (cell.type === 'p2') {
      base += cell.value !== null ? "bg-p2-light/30 border-p2 text-p2-dark" : "bg-white border-p2/30 text-p2/50";
    } else if (cell.type === 'key') {
      base += cell.value !== null ? "bg-key-light border-key text-ink" : "bg-stone-50 border-stone-200 text-stone-400";
    } else if (cell.type === 'master') {
      base += cell.value !== null ? "bg-master-light border-master text-master-DEFAULT" : "bg-yellow-50 border-master/30 text-master-DEFAULT/50";
    }

    // Interactive state
    if (isClickable) {
       base += currentPlayer === 'p1' 
        ? " cursor-pointer hover:bg-p1-light hover:border-p1 hover:shadow-md hover:-translate-y-0.5" 
        : " cursor-pointer hover:bg-p2-light hover:border-p2 hover:shadow-md hover:-translate-y-0.5";
    } else if (cell.value === null) {
      base += " cursor-default opacity-80";
    }

    return base;
  };

  const rows = [0, 1, 2];

  return (
    <div className="flex flex-col items-center gap-2">
      
      {/* Header Labels - Now Clickable */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px] text-center font-bold text-sm mb-1">
        <button 
          onClick={() => onEditName('p1')}
          className="group flex items-center justify-center gap-1 text-p1 hover:text-p1-dark transition-colors"
          title="Endre navn"
        >
          <span className="truncate max-w-[80px]">{playerNames.p1}</span>
          <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        
        <button 
          onClick={() => onEditName('p2')}
          className="group flex items-center justify-center gap-1 text-p2 hover:text-p2-dark transition-colors"
          title="Endre navn"
        >
          <span className="truncate max-w-[80px]">{playerNames.p2}</span>
          <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        
        <div className="text-key-DEFAULT">Key</div>
      </div>

      {/* Main 3x3 Grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
        {rows.map(rowIdx => {
           const rowCells = cells.filter(c => c.row === rowIdx).sort((a,b) => a.id - b.id);
           const result = getRowResult(rowIdx);
           
           return (
             <React.Fragment key={rowIdx}>
                {rowCells.map(cell => (
                  <div 
                    key={cell.id} 
                    onClick={() => isClickable(cell.id) && onCellClick(cell.id)}
                    className={`${getCellStyle(cell)} h-20 w-full`}
                  >
                    {getCellContent(cell)}
                    
                    {/* Winner Indicator */}
                    {result && result.winner !== 'tie' && (
                       (result.winner === 'p1' && cell.type === 'p1') || 
                       (result.winner === 'p2' && cell.type === 'p2')
                    ) && (
                      <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-1 rounded-full shadow-md z-10 animate-bounce">
                        <Trophy size={14} />
                      </div>
                    )}
                  </div>
                ))}
             </React.Fragment>
           );
        })}
      </div>

      {/* Master Key Section - Visual connector */}
      <div className="w-full max-w-[300px] grid grid-cols-3 gap-3 mt-1 relative">
         {/* Decorative Lines showing influence */}
         <div className="absolute left-2/3 top-0 bottom-0 w-px bg-stone-300 -translate-x-1/2 -z-10 h-10" />
         
         <div className="col-start-3">
             {/* Connector Arrow */}
            <div className="flex justify-center -mt-3 mb-1 text-master-DEFAULT opacity-50">
               <ArrowDown size={20} />
            </div>
            
            <div 
              onClick={() => isClickable(9) && onCellClick(9)}
              className={`${getCellStyle(cells.find(c => c.id === 9)!)} h-20 w-full`}
            >
               {getCellContent(cells.find(c => c.id === 9)!)}
            </div>
            <div className="text-center text-xs font-bold text-master-DEFAULT mt-1 uppercase tracking-wide">Master Key</div>
         </div>
      </div>
    </div>
  );

  function isClickable(id: number) {
    return isValidMove(id);
  }
};