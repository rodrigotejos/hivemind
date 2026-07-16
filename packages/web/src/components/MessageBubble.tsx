import { Bot, User, CornerDownRight, Reply } from 'lucide-react';

export default function MessageBubble({ message, isMe, agentName, onReply }: { message: any, isMe: boolean, agentName?: string, onReply?: () => void }) {
  const isQuestion = message.type === 'question';
  const isAnswer = message.type === 'answer';
  const isBlocker = message.type === 'blocker';

  let bubbleStyle = "bg-zinc-900 border-zinc-800";
  let iconBg = "bg-zinc-800 border-zinc-700";
  let iconColor = "text-zinc-400";
  
  if (isBlocker) {
    bubbleStyle = "bg-rose-950/20 border-rose-900/50 shadow-[0_0_15px_rgba(225,29,72,0.05)]";
    iconBg = "bg-rose-900/50 border-rose-500/30";
    iconColor = "text-rose-400";
  } else if (isQuestion) {
    bubbleStyle = "bg-amber-950/20 border-amber-900/50";
    iconBg = "bg-amber-900/50 border-amber-500/30";
    iconColor = "text-amber-400";
  } else if (isAnswer) {
    bubbleStyle = "bg-emerald-950/20 border-emerald-900/50";
    iconBg = "bg-emerald-900/50 border-emerald-500/30";
    iconColor = "text-emerald-400";
  } else if (isMe) {
    bubbleStyle = "bg-indigo-950/30 border-indigo-900/50 shadow-[0_0_20px_rgba(79,70,229,0.1)]";
    iconBg = "bg-indigo-600 border-indigo-500";
    iconColor = "text-white";
  }

  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 fade-in duration-300`}>
      <div className={`flex gap-4 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className="shrink-0 mt-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBg}`}>
            {isMe ? <User size={18} className={iconColor} /> : <Bot size={18} className={iconColor} />}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-sm font-bold text-zinc-300">
              {isMe ? 'You (Rodrigo)' : agentName || message.from_agent_id}
            </span>
            <span className="text-[10px] font-mono text-zinc-600 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 uppercase tracking-wider">
              {message.type}
            </span>
          </div>

          <div className={`p-4 rounded-2xl border ${bubbleStyle} backdrop-blur-sm relative group`}>
            {message.thread_id && message.thread_id !== message.id && (
              <div className="absolute -top-3 left-4 flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                <CornerDownRight size={10} /> Reply to {message.thread_id.substring(0, 8)}
              </div>
            )}
            
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{message.content}</p>
            
            {onReply && !isMe && (
              <button 
                onClick={onReply}
                className="absolute -right-10 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-indigo-600 text-zinc-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                title="Responder"
              >
                <Reply size={14} />
              </button>
            )}
          </div>
          
          <div className={`text-[10px] font-mono text-zinc-600 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
            {new Date(message.created_at).toLocaleTimeString()}
          </div>
        </div>

      </div>
    </div>
  );
}
