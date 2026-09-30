import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Users, Terminal, Sparkles, ShieldCheck, Search, X } from 'lucide-react';
import AgentStatus from '../components/AgentStatus';
import CockpitPanel from '../components/CockpitPanel';
import SecurityAuditPanel from '../components/SecurityAuditPanel';
import FigmaStudioPanel from '../components/FigmaStudioPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'figma'>('overview');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');

  const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark key={index} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const countMatches = (text: string, query: string) => {
    if (!query.trim() || !text) return 0;
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(escaped, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  };

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

  const totalMatches = countMatches(project.shared_context || '', wikiSearchQuery);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
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

      {/* Cockpit Human-in-the-Loop & Governança */}
      <CockpitPanel 
        projectId={id || ''} 
        apiUrl={API_URL} 
        project={project} 
        hideSecurityCard={activeTab === 'security'} 
      />

      {/* Navegação de Abas do Projeto */}
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <BrainCircuit size={16} className={activeTab === 'overview' ? 'text-indigo-400' : 'text-zinc-500'} />
          Visão Geral & Wiki Técnica
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-zinc-800 text-white border border-rose-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <ShieldCheck size={16} className={activeTab === 'security' ? 'text-rose-400' : 'text-zinc-500'} />
          Auditoria Red Team vs. Blue Team
          <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 text-[10px] rounded-full font-bold">
            Adversarial
          </span>
        </button>

        <button
          onClick={() => setActiveTab('figma')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'figma'
              ? 'bg-zinc-800 text-white border border-cyan-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Sparkles size={16} className={activeTab === 'figma' ? 'text-cyan-400' : 'text-zinc-500'} />
          Figma Studio & Gerador UI
          <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 text-[10px] rounded-full font-bold">
            Alpha Frontend
          </span>
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-1 rounded-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 blur-xl opacity-50 rounded-2xl"></div>
              <div className="relative bg-zinc-950/80 backdrop-blur-xl p-6 md:p-8 rounded-xl border border-white/5 h-full">
                {/* Header com Título, Indicador de IA e Barra de Busca */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <BrainCircuit className="text-indigo-400" size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Executive Summary & Wiki Técnica
                      </h2>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                        <Sparkles size={12} className="text-amber-500" /> AI-Generated Wiki
                      </div>
                    </div>
                  </div>

                  {/* Campo de Busca Simples */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-3 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        value={wikiSearchQuery}
                        onChange={(e) => setWikiSearchQuery(e.target.value)}
                        placeholder="Buscar na wiki (ex: PBT, rotas)..."
                        className="pl-8 pr-7 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-indigo-500/60 rounded-lg text-xs text-white placeholder-zinc-500 w-48 sm:w-64 focus:outline-none transition-all"
                      />
                      {wikiSearchQuery && (
                        <button
                          onClick={() => setWikiSearchQuery('')}
                          className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
                          title="Limpar busca"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {wikiSearchQuery.trim() && (
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md shrink-0">
                        {totalMatches} {totalMatches === 1 ? 'resultado' : 'resultados'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Container com Scroll Delimitado e Highlighting */}
                <div className="max-h-[550px] overflow-y-auto pr-3 space-y-3 custom-scrollbar text-zinc-300 text-xs md:text-sm leading-relaxed">
                  {(project.shared_context || 'Nenhum contexto gerado ainda.').split('\n').map((para: string, i: number) => (
                    <p key={i} className="mb-3 leading-relaxed">
                      {highlightMatches(para, wikiSearchQuery)}
                    </p>
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
      ) : activeTab === 'security' ? (
        <SecurityAuditPanel projectId={id || ''} apiUrl={API_URL} />
      ) : (
        <FigmaStudioPanel projectId={id || ''} apiUrl={API_URL} />
      )}
    </div>
  );
}
