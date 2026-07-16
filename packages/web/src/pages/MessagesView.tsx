import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Terminal, Activity, Send, X, BrainCircuit, Sparkles } from 'lucide-react';
import MessageBubble from '../components/MessageBubble';
import BlockerAlert from '../components/BlockerAlert';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ME_ID = 'rodrigo'; // Fake human ID

export default function MessagesView() {
  const { id } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [, setSocket] = useState<Socket | null>(null);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/projects/${id}`)
      .then(res => res.json())
      .then(data => setProject(data));

    fetch(`${API_URL}/api/projects/${id}/messages`)
      .then(res => res.json())
      .then(data => setMessages(data));

    fetch(`${API_URL}/api/projects/${id}/agents`)
      .then(res => res.json())
      .then(data => setAgents(data));

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.emit('join_project', { projectId: id });

    newSocket.on('new_message', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('message_updated', ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    });

    newSocket.on('project_updated', ({ project }) => {
      setProject(project);
    });

    return () => {
      newSocket.close();
    };
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const activeBlockers = messages.filter(m => (m.type === 'blocker' || m.priority === 'critical') && m.status !== 'resolved');

  const resolveBlocker = async (msgId: string) => {
    await fetch(`${API_URL}/api/projects/${id}/messages/${msgId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Key': ME_ID },
      body: JSON.stringify({ content: "Blocker resolvido pelo humano via UI." })
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const content = input;
    const toAgentId = replyingTo ? replyingTo.from_agent_id : undefined;
    const threadId = replyingTo ? (replyingTo.thread_id || replyingTo.id) : undefined;
    
    setInput('');
    setReplyingTo(null);

    await fetch(`${API_URL}/api/projects/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Key': ME_ID },
      body: JSON.stringify({
        type: 'answer',
        content,
        toAgentId,
        threadId,
      })
    });
  };

  const agentMap = agents.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {} as Record<string, string>);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
      
      <header className="glass-panel border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-6">
          <Link to={`/projects/${id}`} className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-zinc-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Terminal size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">Live Terminal</h1>
              <p className="text-xs text-zinc-500 font-mono">Agent Communication Stream</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <Activity size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Syncing</span>
        </div>
      </header>

      {/* Main Split Screen Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row z-10 relative">
        {/* Left Column: Live Terminal Chat */}
        <div className="flex-1 flex flex-col border-r border-white/5 h-full pb-4">
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar" ref={scrollRef}>
            {activeBlockers.length > 0 && (
              <div className="mb-8 space-y-4">
                {activeBlockers.map(blocker => (
                  <BlockerAlert key={blocker.id} message={blocker} onResolve={() => resolveBlocker(blocker.id)} />
                ))}
              </div>
            )}

            <div className="space-y-6 max-w-4xl mx-auto w-full">
              {messages.map(msg => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isMe={msg.from_agent_id === ME_ID} 
                  agentName={agentMap[msg.from_agent_id]}
                  onReply={() => setReplyingTo(msg)}
                />
              ))}
              
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                    <Terminal size={24} className="text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-400 mb-1">Terminal Vazio</h3>
                  <p className="text-sm text-zinc-600">Aguardando logs e mensagens dos agentes.</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Input Field */}
          <div className="px-6 max-w-4xl mx-auto w-full shrink-0">
            {replyingTo && (
              <div className="flex items-center justify-between bg-zinc-800/80 rounded-t-xl px-4 py-2 border border-b-0 border-zinc-700 mx-2">
                <div className="text-xs text-zinc-400">
                  Respondendo a <span className="font-bold text-indigo-400">{agentMap[replyingTo.from_agent_id] || replyingTo.from_agent_id}</span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-zinc-500 hover:text-zinc-300">
                  <X size={14} />
                </button>
              </div>
            )}
            <form onSubmit={sendMessage} className={`relative ${replyingTo ? '' : 'mt-2'}`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Envie uma mensagem, orientação ou responda a uma IA..."
                className={`w-full bg-zinc-900/80 border border-zinc-800 py-4 pl-6 pr-14 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all backdrop-blur-md shadow-lg ${replyingTo ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'}`}
              />
              <button 
                type="submit" 
                disabled={!input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Shared Context (Wiki / Super Resumo) */}
        <div className="w-full md:w-1/3 min-w-[320px] max-w-[480px] bg-zinc-950/40 backdrop-blur-md h-full flex flex-col p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5 shrink-0">
            <h2 className="text-sm font-bold flex items-center gap-2 text-white">
              <BrainCircuit className="text-indigo-400" size={16} />
              Contexto Compartilhado
            </h2>
            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full">
              <Sparkles size={10} className="text-amber-500 animate-pulse" /> Live Wiki
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 prose prose-invert max-w-none">
            {project?.shared_context ? (
              <div className="space-y-4">
                {project.shared_context.split('\n').map((para: string, i: number) => {
                  const trimmed = para.trim();
                  if (trimmed.startsWith('#')) {
                    const level = (trimmed.match(/^#+/) || ['#'])[0].length;
                    const text = trimmed.replace(/^#+\s*/, '');
                    const sizeClass = level === 1 ? 'text-lg font-bold text-white' : level === 2 ? 'text-sm font-bold text-white mt-4 border-b border-zinc-800 pb-1' : 'text-xs font-semibold text-zinc-200 mt-3';
                    return <h3 key={i} className={sizeClass}>{text}</h3>;
                  }
                  if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    return <li key={i} className="text-xs text-zinc-400 list-disc ml-4">{trimmed.replace(/^[-*]\s*/, '')}</li>;
                  }
                  return <p key={i} className="text-xs leading-relaxed text-zinc-400">{para}</p>;
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">Aguardando geração do contexto inicial pelos agentes...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
