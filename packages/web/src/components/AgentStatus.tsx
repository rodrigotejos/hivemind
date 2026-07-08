import { Cpu, User } from 'lucide-react';

export default function AgentStatus({ agent }: { agent: any }) {
  const isHuman = agent.type === 'human';
  
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-800/50 transition-colors group">
      <div className="relative">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${
          isHuman 
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-900/40 border border-emerald-500/30' 
            : 'bg-gradient-to-br from-cyan-500/20 to-blue-900/40 border border-cyan-500/30'
        }`}>
          {isHuman ? (
            <User className="text-emerald-400" size={20} />
          ) : (
            <Cpu className="text-cyan-400" size={20} />
          )}
        </div>
        {/* Status Indicator */}
        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 ${
          agent.status === 'working' ? 'bg-indigo-500 neon-border' :
          agent.status === 'idle' ? 'bg-zinc-500' :
          agent.status === 'waiting' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
          'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'
        }`}></div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold text-zinc-200 truncate">{agent.name}</h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 uppercase tracking-wider">
            {agent.role}
          </span>
        </div>
        <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
          {isHuman ? 'Supervisor Humano' : agent.model || 'AI Worker'}
        </p>
      </div>
    </div>
  );
}
