import React from 'react';
import { ThumbsUp, User } from 'lucide-react';
import { Game } from '../types';

interface GameCardProps {
  game: Game;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  return (
    <div className="flex flex-col gap-2 group cursor-pointer">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-800">
        <img 
          src={game.thumbnail || undefined} 
          alt={game.title} 
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
           <button className="bg-[#00b06f] w-full py-1 rounded-full text-sm font-bold shadow-sm">
             Playing
           </button>
        </div>
      </div>
      <div className="flex flex-col">
        <h3 className="text-base font-bold text-white leading-tight truncate" title={game.title}>
          {game.title}
        </h3>
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <div className="flex items-center gap-1">
             <ThumbsUp size={12} className="text-gray-400" />
             <span>{game.likes}</span>
          </div>
          <div className="flex items-center gap-1">
             <User size={12} className="text-gray-400" />
             <span>{game.playing.toLocaleString()}</span>
          </div>
        </div>
        <span className="text-xs text-gray-500 mt-1 truncate">By {game.creator}</span>
      </div>
    </div>
  );
};