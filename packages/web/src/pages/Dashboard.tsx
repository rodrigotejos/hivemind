import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
}

const ME_ID = 'rodrigo'; // Mock human ID

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Fetch projects
    fetch(`${API_URL}/api/projects`)
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error('Error fetching projects:', err));
      
    // Fetch notifications
    fetch(`${API_URL}/api/notifications/${ME_ID}`)
      .then(res => res.json())
      .then(data => setNotifications(data))
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
        <button className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          <Plus size={16} /> Novo Projeto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-card rounded-2xl flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Activity className="text-zinc-500" size={24} />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-1">Nenhum projeto encontrado</h3>
            <p className="text-zinc-500 text-sm">Crie um novo projeto para orquestrar seus agentes AI.</p>
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
                    {/* Placeholder for agent avatars */}
                    <div className="w-8 h-8 rounded-full bg-indigo-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-indigo-300">AI</div>
                    <div className="w-8 h-8 rounded-full bg-cyan-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-cyan-300">AI</div>
                    <div className="w-8 h-8 rounded-full bg-emerald-900 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-emerald-300">HM</div>
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
    </div>
  );
}
