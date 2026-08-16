import { useState, useEffect } from 'react';
import { Play, AlertTriangle, ShieldCheck, CloudUpload, Activity, Coins, CheckCircle, RefreshCw, Cpu, Sparkles } from 'lucide-react';

interface CockpitPanelProps {
  projectId: string;
  apiUrl: string;
  sessionId?: string;
  sessionTitle?: string;
  initialGoal?: string;
  initialModel?: string;
  initialReasoningLevel?: string;
  compact?: boolean;
  onTaskStarted?: () => void;
  onModelChanged?: (newModel: string) => void;
  onReasoningChanged?: (newReasoning: string) => void;
}

export default function CockpitPanel({
  projectId,
  apiUrl,
  sessionId,
  sessionTitle,
  initialGoal,
  initialModel = 'auto',
  initialReasoningLevel = 'medium',
  compact = false,
  onTaskStarted,
  onModelChanged,
  onReasoningChanged,
}: CockpitPanelProps) {
  const [graphState, setGraphState] = useState<any>(null);
  const [goalInput, setGoalInput] = useState(initialGoal || '');
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [reasoningLevel, setReasoningLevel] = useState(initialReasoningLevel);
  const [maxTurns, setMaxTurns] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialGoal) {
      setGoalInput(initialGoal);
    }
    if (initialModel) {
      setSelectedModel(initialModel);
    }
    if (initialReasoningLevel) {
      setReasoningLevel(initialReasoningLevel);
    }
  }, [initialGoal, initialModel, initialReasoningLevel, sessionId]);

  const fetchGraphState = () => {
    const url = sessionId
      ? `${apiUrl}/api/projects/${projectId}/graph/state?sessionId=${sessionId}`
      : `${apiUrl}/api/projects/${projectId}/graph/state`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.state) setGraphState(data.state);
        else setGraphState(null);
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
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId, sessionId]);

  const handleStartTask = async () => {
    if (!goalInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/graph/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalInput,
          maxTurns,
          sessionId: sessionId === 'general' ? undefined : sessionId,
          model: selectedModel,
          reasoningLevel,
        }),
      });
      const data = await res.json();
      if (data.state) setGraphState(data.state);
      if (onTaskStarted) onTaskStarted();
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
          sessionId: sessionId === 'general' ? undefined : sessionId,
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
    <div className="space-y-4">
      {/* 1. Bar de Telemetria e Governança (Modo Expandido) */}
      {!compact && (
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
      )}

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
        <div className="p-4 md:p-5 bg-amber-950/50 border-2 border-amber-500/60 rounded-2xl animate-pulse shadow-lg">
          <div className="flex items-center gap-3 text-amber-400 font-bold mb-2 text-sm md:text-base">
            <AlertTriangle size={20} />
            <span>Autorização Humana Necessária (Human-in-the-Loop Interruption)</span>
          </div>
          <p className="text-zinc-200 text-xs md:text-sm mb-3 font-medium">
            {graphState.pendingDecision.question}
          </p>
          <div className="flex flex-wrap gap-2">
            {(graphState.pendingDecision.options || ['Aprovar', 'Rejeitar']).map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => handleResumeDecision(opt)}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Lançador de Tarefas Autônomas Integrado com Matriz de Modelos e Nível de Raciocínio */}
      <div className={`bg-zinc-950/80 border border-zinc-800/90 rounded-2xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Play size={14} className="text-indigo-400" />
            <span>Coordenação Multi-Agente</span>
            {sessionTitle && (
              <span className="text-xs normal-case font-normal text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Sessão: {sessionTitle}
              </span>
            )}
          </h3>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
            <span className={`w-2 h-2 rounded-full ${graphState?.status === 'running' ? 'bg-amber-400 animate-ping' : graphState?.status === 'completed' ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
            <span>{graphState?.status || 'idle'}</span>
            {graphState?.turnCount !== undefined && (
              <span className="text-zinc-500">({graphState.turnCount}/{graphState.maxTurns || 5}t)</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder={sessionId && sessionId !== 'general' ? `Objetivo para a sessão "${sessionTitle || 'Tarefa'}"...` : "Ex: Criar tela do Figma, rota backend e testes PBT..."}
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white text-xs md:text-sm focus:outline-none focus:border-indigo-500"
          />

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Seletor de Modelo Coordenador */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl px-2.5 py-1.5">
                <Cpu size={14} className="text-indigo-400 shrink-0" />
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedModel(val);
                    if (onModelChanged) onModelChanged(val);
                  }}
                  className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer pr-1"
                  title="Escolha o modelo de IA que coordenará esta tarefa"
                >
                  <option value="auto" className="bg-zinc-900 text-indigo-300 font-semibold">✨ Auto (Adapta por complexidade)</option>
                  <option value="gemini-3.5-flash-lite" className="bg-zinc-900 text-white">⚡ 3.5 Flash Lite (Ultra Rápido)</option>
                  <option value="gemini-3.5-flash" className="bg-zinc-900 text-white">⚡ 3.5 Flash (Equilibrado)</option>
                  <option value="gemini-3.6-flash" className="bg-zinc-900 text-white">🎯 3.6 Flash (Alta Precisão)</option>
                  <option value="gemini-3.7-flash" className="bg-zinc-900 text-white">🔥 3.7 Flash (Thinking Frontier)</option>
                  <option value="gemini-3.1-pro" className="bg-zinc-900 text-white">🧠 3.1 Pro (Raciocínio Profundo)</option>
                  <option value="claude-3-5-sonnet" className="bg-zinc-900 text-white">🤖 Claude 3.5 Sonnet (Bridge)</option>
                </select>
              </div>

              {/* Seletor de Nível de Raciocínio (Reasoning Budget) */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl px-2.5 py-1.5">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <select
                  value={reasoningLevel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReasoningLevel(val);
                    if (onReasoningChanged) onReasoningChanged(val);
                  }}
                  className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer pr-1"
                  title="Nível de esforço de raciocínio (Thinking Budget)"
                >
                  <option value="off" className="bg-zinc-900 text-zinc-400">Raciocínio: Off (Instantâneo)</option>
                  <option value="low" className="bg-zinc-900 text-zinc-200">Raciocínio: Low (~2k tokens)</option>
                  <option value="medium" className="bg-zinc-900 text-white">Raciocínio: Medium (~8k tokens)</option>
                  <option value="high" className="bg-zinc-900 text-amber-300 font-semibold">Raciocínio: High (~32k tokens)</option>
                </select>
              </div>

              {/* Seletor de Turnos */}
              <select
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-zinc-300 text-xs focus:outline-none"
              >
                <option value={3}>3 turnos</option>
                <option value={5}>5 turnos</option>
                <option value={10}>10 turnos</option>
              </select>
            </div>
            
            <button
              onClick={handleStartTask}
              disabled={isLoading || !goalInput.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs md:text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              Disparar Agentes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
