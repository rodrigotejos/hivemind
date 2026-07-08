import { Bell } from 'lucide-react';

export default function NotificationBell({ count, onClick }: { count: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-indigo-400 group focus:outline-none"
    >
      <Bell size={24} className="transition-transform group-hover:scale-110" />
      {count > 0 && (
        <>
          <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-zinc-950 shadow-[0_0_10px_rgba(99,102,241,0.8)] z-10">
            {count > 9 ? '9+' : count}
          </span>
          <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full animate-ping opacity-75"></span>
        </>
      )}
    </button>
  );
}
