import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { 
  ArrowLeft, 
  Terminal, 
  Activity, 
  Send, 
  X, 
  BrainCircuit, 
  Sparkles, 
  Plus, 
  Layers, 
  MessageSquare,
  Cpu
} from 'lucide-react';
import MessageBubble from '../components/MessageBubble';
import BlockerAlert from '../components/BlockerAlert';
import CockpitPanel from '../components/CockpitPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ME_ID = 'rodrigo'; // Fake human ID

export default function MessagesView() {
  const { id } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('general');
  const [, setSocket] = useState<Socket | null>(null);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
  // Modal de Criação de Tarefa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newModel, setNewModel] = useState('gemini-1.5-flash');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega Projeto, Agentes e Sessões
  useEffect(() => {
    fetch(`${API_URL}/api/projects/${id}`)
      .then(res => res.json())
      .then(data => setProject(data));

    fetch(`${API_URL}/api/projects/${id}/agents`)
      .then(res => res.json())
      .then(data => setAgents(data));

    fetch(`${API_URL}/api/projects/${id}/sessions`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSessions(data);
        }
      });

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

    newSocket.on('session_created', (session) => {
      setSessions(prev => [session, ...prev]);
    });

    newSocket.on('session_updated', (session) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s));
    });

    return () => {
      newSocket.close();
    };
  }, [id]);

  // Carrega Mensagens da Sessão Ativa
  const loadMessages = () => {
    const url = activeSessionId === 'all'
      ? `${API_URL}/api/projects/${id}/messages`
      : `${API_URL}/api/projects/${id}/messages?threadId=${activeSessionId}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      });
  };

  useEffect(() => {
    loadMessages();
  }, [id, activeSessionId]);

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

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          goal: newGoal.trim(),
          model: newModel,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setActiveSessionId(data.id);
        setNewTitle('');
        setNewGoal('');
        setNewModel('gemini-1.5-flash');
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Falha ao criar sessão:', err);
    }
  };

  const handleModelChanged = async (newChosenModel: string) => {
    if (!activeSessionId || activeSessionId === 'general') return;
    try {
      await fetch(`${API_URL}/api/projects/${id}/sessions/${activeSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newChosenModel }),
      });
    } catch (err) {
      console.error('Falha ao atualizar modelo da sessão:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const content = input;
    const toAgentId = replyingTo ? replyingTo.from_agent_id : undefined;
    const threadId = replyingTo 
      ? (replyingTo.thread_id || replyingTo.id) 
      : (activeSessionId === 'general' ? undefined : activeSessionId);
    
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
  const currentSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
      
      {/* Header */}
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
              <h1 className="font-bold text-lg text-white leading-tight">Live Terminal & Task Streams</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-zinc-400 font-mono">
                  {currentSession ? `Sessão: ${currentSession.title}` : 'Canal Geral de Colaboração'}
                </p>
                {currentSession?.model && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded font-mono flex items-center gap-1">
                    <Cpu size={10} /> {currentSession.model}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <Activity size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Syncing</span>
        </div>
      </header>

      {/* Main 3-Column Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row z-10 relative">
        {/* 1. Left Sidebar: Task Sessions & Topic Isolation */}
        <div className="w-full md:w-64 bg-zinc-950/60 border-r border-white/5 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-400" />
              <span>Sessões / Tarefas</span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
              title="Criar nova sessão de tarefa isolada"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <button
              onClick={() => setActiveSessionId('general')}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                activeSessionId === 'general'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
              }`}
            >
              <MessageSquare size={14} />
              <div className="flex-1 truncate">Canal Geral (Root)</div>
            </button>

            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                  activeSessionId === s.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="font-semibold truncate text-zinc-200">{s.title}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    s.status === 'running' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {s.status}
                  </span>
                </div>
                {s.model && (
                  <div className="text-[10px] text-indigo-400/80 font-mono truncate">
                    🤖 {s.model}
                  </div>
                )}
                {s.goal && <div className="text-[11px] text-zinc-500 truncate">{s.goal}</div>}
              </button>
            ))}

            {sessions.length === 0 && (
              <div className="p-3 text-center text-zinc-600 text-xs italic">
                Nenhuma tarefa isolada criada. Clique em "+" acima para criar.
              </div>
            )}
          </div>
        </div>

        {/* 2. Middle Column: Chat Feed & In-Chat Cockpit Controller */}
        <div className="flex-1 flex flex-col border-r border-white/5 h-full pb-4 overflow-hidden">
          {/* In-Chat Cockpit Control Panel */}
          <div className="p-4 bg-zinc-900/40 border-b border-white/5 shrink-0">
            <CockpitPanel
              projectId={id || ''}
              apiUrl={API_URL}
              sessionId={activeSessionId}
              sessionTitle={currentSession ? currentSession.title : 'Canal Geral'}
              initialGoal={currentSession?.goal || ''}
              initialModel={currentSession?.model || 'gemini-1.5-flash'}
              compact={true}
              onTaskStarted={loadMessages}
              onModelChanged={handleModelChanged}
            />
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar" ref={scrollRef}>
            {activeBlockers.length > 0 && (
              <div className="mb-6 space-y-3">
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                    <Terminal size={22} className="text-zinc-600" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">
                    Sessão {currentSession ? `"${currentSession.title}"` : 'Geral'} Vazia
                  </h3>
                  <p className="text-xs text-zinc-600 max-w-sm">
                    Dispare os agentes pelo painel acima ou envie orientações técnicas abaixo.
                  </p>
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
                placeholder={`Conversar na sessão "${currentSession ? currentSession.title : 'Geral'}"...`}
                className={`w-full bg-zinc-900/80 border border-zinc-800 py-3.5 pl-5 pr-14 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all backdrop-blur-md shadow-lg text-sm ${replyingTo ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'}`}
              />
              <button 
                type="submit" 
                disabled={!input.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* 3. Right Column: Shared Context (Live Wiki) */}
        <div className="w-full md:w-1/4 min-w-[280px] max-w-[380px] bg-zinc-950/40 backdrop-blur-md h-full flex flex-col p-5 overflow-hidden shrink-0">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5 shrink-0">
            <h2 className="text-xs font-bold flex items-center gap-2 text-white uppercase tracking-wider">
              <BrainCircuit className="text-indigo-400" size={16} />
              Contexto Geral (Wiki)
            </h2>
            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
              <Sparkles size={10} className="text-amber-500 animate-pulse" /> Live
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 prose prose-invert max-w-none">
            {project?.shared_context ? (
              <div className="space-y-3">
                {project.shared_context.split('\n').map((para: string, i: number) => {
                  const trimmed = para.trim();
                  if (trimmed.startsWith('#')) {
                    const level = (trimmed.match(/^#+/) || ['#'])[0].length;
                    const text = trimmed.replace(/^#+\s*/, '');
                    const sizeClass = level === 1 ? 'text-sm font-bold text-white' : level === 2 ? 'text-xs font-bold text-white mt-3 border-b border-zinc-800 pb-1' : 'text-[11px] font-semibold text-zinc-200 mt-2';
                    return <h3 key={i} className={sizeClass}>{text}</h3>;
                  }
                  if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    return <li key={i} className="text-[11px] text-zinc-400 list-disc ml-3">{trimmed.replace(/^[-*]\s*/, '')}</li>;
                  }
                  return <p key={i} className="text-[11px] leading-relaxed text-zinc-400">{para}</p>;
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">Aguardando geração do contexto compartilhado pelos agentes...</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Criar Nova Sessão de Tarefa com Seletor de Modelo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                Nova Sessão de Tarefa Isolada
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Crie um canal de chat isolado para uma nova tela, feature ou bugfix. O contexto e os turnos não se misturarão com outras tarefas.
            </p>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Título da Tarefa *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Nova Tela de Checkout, Bugfix no Auth..."
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Modelo Coordenador de IA</label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini-1.5-flash">⚡ Gemini 1.5 Flash (Rápido & Econômico)</option>
                  <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Raciocínio Profundo & Arquitetura)</option>
                  <option value="gemini-2.0-flash">🚀 Gemini 2.0 Flash (Próxima Geração)</option>
                  <option value="claude-3-5-sonnet">🤖 Claude 3.5 Sonnet (Antigravity Bridge)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Objetivo Inicial (Opcional)</label>
                <textarea
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Ex: Ler especificações do Figma, criar rota POST /checkout e testes automatizados..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Criar Sessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
