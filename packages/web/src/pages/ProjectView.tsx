import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Users, Terminal, Sparkles } from 'lucide-react';
import AgentStatus from '../components/AgentStatus';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/projects/${id}`)
      .then(res => res.json())
      .then(data => setProject(data));

    fetch(`${API_URL}/api/projects/${id}/agents`)
      .then(res => res.json())
      .then(data => setAgents(data));
  }, [id]);

  if (!project) return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium tracking-widest uppercase text-sm animate-pulse">Carregando Matrix...</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="mb-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="p-3 bg-zinc-900/50 border border-white/5 rounded-xl hover:bg-zinc-800 hover:border-indigo-500/50 transition-all text-zinc-400 hover:text-white group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                {project.status}
              </span>
            </div>
            <p className="text-zinc-400">{project.description}</p>
          </div>
        </div>
        
        <Link to={`/projects/${id}/messages`} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)]">
          <Terminal size={18} />
          Terminal do Projeto
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-1 rounded-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 blur-xl opacity-50 rounded-2xl"></div>
            <div className="relative bg-zinc-950/80 backdrop-blur-xl p-8 rounded-xl border border-white/5 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-3 text-white">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <BrainCircuit className="text-indigo-400" size={24} /> 
                  </div>
                  Executive Summary
                </h2>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <Sparkles size={14} className="text-amber-500" /> AI-Generated
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
                {(project.shared_context || 'Nenhum contexto gerado ainda.').split('\n').map((para: string, i: number) => (
                  <p key={i} className="mb-4 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="glass-card p-6 rounded-2xl h-full border-zinc-800/50">
            <h2 className="text-lg font-bold flex items-center gap-3 mb-6 text-white pb-4 border-b border-white/5">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Users className="text-cyan-400" size={20} />
              </div>
              Agentes Alocados
            </h2>
            <div className="flex flex-col gap-4">
              {agents.map(agent => (
                <AgentStatus key={agent.id} agent={agent} />
              ))}
              {agents.length === 0 && (
                <div className="p-4 border border-dashed border-zinc-700 rounded-xl text-center text-sm text-zinc-500">
                  Nenhum agente associado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
