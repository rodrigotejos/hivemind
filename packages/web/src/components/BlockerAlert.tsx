import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function BlockerAlert({ message, onResolve }: { message: any, onResolve: () => void }) {
  return (
    <div className="relative overflow-hidden bg-rose-950/30 border border-rose-500/40 rounded-2xl p-6 shadow-[0_0_30px_rgba(225,29,72,0.15)] group animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10 animate-pulse"></div>
      
      <div className="relative z-10 flex items-start gap-4">
        <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/30 shrink-0">
          <AlertTriangle className="text-rose-400" size={24} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-rose-200">Blocker Identificado</h3>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-widest rounded border border-rose-500/30">
              Critical
            </span>
          </div>
          
          <p className="text-rose-200/80 text-sm leading-relaxed mb-4">{message.content}</p>
          
          <div className="flex items-center gap-4 text-xs font-mono text-rose-400/60 mb-5">
            <span>Agent: {message.from_agent_id}</span>
            <span>•</span>
            <span>ID: {message.id.substring(0, 8)}</span>
          </div>
          
          <button 
            onClick={onResolve}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all hover:scale-105"
          >
            <CheckCircle2 size={16} />
            Marcar como Resolvido
          </button>
        </div>
      </div>
    </div>
  );
}
