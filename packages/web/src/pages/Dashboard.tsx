import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Plus, ChevronRight, X, Folder, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Project {
  id: string;
  name: string;
  description: string;
  path?: string;
  status: string;
}

const ME_ID = 'rodrigo'; // Mock human ID

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [path, setPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = () => {
    fetch(`${API_URL}/api/projects`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(err => console.error('Error fetching projects:', err));
  };

  useEffect(() => {
    fetchProjects();

    // Fetch notifications
    fetch(`${API_URL}/api/notifications/${ME_ID}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(err => console.error('Error fetching notifs:', err));

    // Connect to Socket.IO
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    newSocket.on('notification', ({ notification }) => {
      if (notification.agent_id === ME_ID) {
        setNotifications(prev => [notification, ...prev]);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const markAllRead = () => {
    fetch(`${API_URL}/api/notifications/${ME_ID}/read-all`, { method: 'POST' })
      .then(() => setNotifications(prev => prev.map(n => ({...n, read: true}))));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || 'Projeto gerenciado pelo Hivemind AI-DLC',
          path: path.trim() || undefined,
        }),
      });

      const created = await res.json();
      if (created && created.id) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
        setPath('');
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between mb-10 border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 mb-4 md:mb-0">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Activity className="text-indigo-400" size={32} /> 
            AI-DLC <span className="font-light text-zinc-400">Dashboard</span>
          </h1>
          <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest font-semibold">AI Development Lifecycle</p>
        </div>
        
        <div className="relative z-10 flex items-center gap-6 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <div className="relative flex h-3 w-3">
              {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </div>
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="h-6 w-px bg-zinc-800"></div>
          <NotificationBell count={unreadCount} onClick={markAllRead} />
        </div>
      </header>

      <div className="flex items-center justify-between mb-6 px-2">
        <h2 className="text-xl font-medium text-white flex items-center gap-2">
          Projetos Ativos <span className="text-xs py-0.5 px-2 bg-indigo-500/20 text-indigo-400 rounded-full">{projects.length}</span>
        </h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer"
        >
          <Plus size={16} /> Novo Projeto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-card rounded-2xl flex flex-col items-center justify-center border border-dashed border-zinc-800">
            <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center mb-4 text-indigo-400">
              <Sparkles size={26} />
            </div>
            <h3 className="text-lg font-medium text-zinc-200 mb-1">Nenhum projeto registrado</h3>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">
              Adicione um projeto existente ou crie um novo para orquestrar seus agentes autônomos.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Criar Primeiro Projeto
            </button>
          </div>
        ) : (
          projects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`} className="group block">
              <div className="glass-card p-6 rounded-2xl h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all duration-500 group-hover:bg-indigo-500/20"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <h3 className="text-xl font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                  <span className="px-2.5 py-1 bg-zinc-800/80 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-700/50">
                    {project.status}
                  </span>
                </div>
                
                <p className="text-zinc-400 text-sm mb-6 flex-1 line-clamp-3 relative z-10">{project.description}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 mt-auto relative z-10">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-indigo-300">FE</div>
                    <div className="w-8 h-8 rounded-full bg-cyan-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-cyan-300">BE</div>
                    <div className="w-8 h-8 rounded-full bg-emerald-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-emerald-300">QA</div>
                  </div>
                  <span className="flex items-center text-sm font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                    Acessar <ChevronRight size={16} className="ml-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Modal: Criar / Inserir Projeto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Folder size={20} className="text-indigo-400" />
                Adicionar Novo Projeto
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Cadastre um projeto para gerenciamento autônomo com LangGraph, telemetria e agentes especializados.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Nome do Projeto *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Minha Aplicação Web, E-commerce, Hivemind..."
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Caminho Local do Repositório (Opcional)</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="Ex: e:\code\meu-projeto ou C:\projetos\app"
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Permite executar o Auto-Setup de regras AI-DLC e MCP diretamente no diretório do projeto.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Descrição / Metas</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Projeto React 19 + Express com foco em alta performance e testes PBT..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isCreating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg cursor-pointer"
                >
                  {isCreating ? 'Criando...' : 'Criar e Orquestrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
