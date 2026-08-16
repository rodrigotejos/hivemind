import { useState, useEffect } from 'react';
import { Play, AlertTriangle, ShieldCheck, CloudUpload, Activity, Coins, CheckCircle, RefreshCw } from 'lucide-react';

interface CockpitPanelProps {
  projectId: string;
  apiUrl: string;
}

export default function CockpitPanel({ projectId, apiUrl }: CockpitPanelProps) {
  const [graphState, setGraphState] = useState<any>(null);
  const [goalInput, setGoalInput] = useState('');
  const [maxTurns, setMaxTurns] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  const fetchGraphState = () => {
    fetch(`${apiUrl}/api/projects/${projectId}/graph/state`)
      .then(res => res.json())
      .then(data => {
        if (data.state) setGraphState(data.state);
      })
      .catch(() => {});
  };

  const fetchTelemetry = () => {
    fetch(`${apiUrl}/api/projects/${projectId}/telemetry`)
      .then(res => res.json())
      .then(data => {
        if (data.telemetry) setTelemetry(data.telemetry);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchGraphState();
    fetchTelemetry();
    const interval = setInterval(() => {
      fetchGraphState();
      fetchTelemetry();
    }, 4000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleStartTask = async () => {
    if (!goalInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/graph/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalInput, maxTurns }),
      });
      const data = await res.json();
      if (data.state) setGraphState(data.state);
      setGoalInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeDecision = async (decision: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/graph/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpointId: graphState?.pendingDecision?.checkpointId || 'chk_active',
          decision,
        }),
      });
      const data = await res.json();
      if (data.state) setGraphState(data.state);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSetup = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/setup/bootstrap`, {
        method: 'POST',
      });
      const data = await res.json();
      setSetupStatus(data);
      setTimeout(() => setSetupStatus(null), 5000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/snapshots`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.snapshot) {
        setSnapshotMsg(`Snapshot ${data.snapshot.snapshotId} gerado com SHA-256 e salvo!`);
        setTimeout(() => setSnapshotMsg(null), 6000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Bar de Telemetria e Governança */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Status do Grafo</div>
            <div className="text-sm font-semibold text-white capitalize">
              {graphState?.status || 'idle'} {graphState?.turnCount !== undefined ? `(${graphState.turnCount}/${graphState.maxTurns || 5} turns)` : ''}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Coins size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Consumo Tokens</div>
            <div className="text-sm font-semibold text-white">
              {telemetry?.totalTokens?.toLocaleString() || '0'} tokens (~${telemetry?.estimatedCostUsd || '0.00'})
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">AI-DLC & MCP</div>
            <button
              onClick={handleAutoSetup}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
            >
              Executar Auto-Setup
            </button>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg">
            <CloudUpload size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Backup Resiliente</div>
            <button
              onClick={handleCreateSnapshot}
              className="text-xs text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
            >
              Criar Snapshot S3
            </button>
          </div>
        </div>
      </div>

      {setupStatus && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle size={16} /> Auto-Setup concluído: {setupStatus.generatedFiles?.join(', ') || 'Repositório configurado com conformidade total!'}
        </div>
      )}

      {snapshotMsg && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle size={16} /> {snapshotMsg}
        </div>
      )}

      {/* 2. Card de Interrupção Humana (Human-in-the-Loop Gate) */}
      {graphState?.status === 'waiting_human' && graphState?.pendingDecision && (
        <div className="p-6 bg-amber-950/40 border-2 border-amber-500/50 rounded-2xl animate-pulse">
          <div className="flex items-center gap-3 text-amber-400 font-bold mb-3 text-base">
            <AlertTriangle size={22} />
            <span>Autorização Humana Necessária (Human-in-the-Loop Interruption)</span>
          </div>
          <p className="text-zinc-200 text-sm mb-4 font-medium">
            {graphState.pendingDecision.question}
          </p>
          <div className="flex flex-wrap gap-3">
            {(graphState.pendingDecision.options || ['Aprovar', 'Rejeitar']).map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => handleResumeDecision(opt)}
                disabled={isLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Lançador de Tarefas Autônomas */}
      <div className="p-6 bg-zinc-950/70 border border-zinc-800 rounded-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Play size={16} className="text-indigo-400" />
          Comando Central de Colaboração Multi-Agente (LangGraph)
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="Ex: Criar rotas de autenticação no backend, formulário no frontend e testes no QA..."
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-2">
            <select
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="px-3 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-300 text-xs focus:outline-none"
            >
              <option value={3}>Max 3 rodadas</option>
              <option value={5}>Max 5 rodadas</option>
              <option value={10}>Max 10 rodadas</option>
            </select>
            <button
              onClick={handleStartTask}
              disabled={isLoading || !goalInput.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Disparar Agentes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
