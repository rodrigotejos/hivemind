import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  CloudUpload, 
  Activity, 
  Coins, 
  CheckCircle, 
  RefreshCw, 
  Cpu, 
  Sparkles
} from 'lucide-react';
import { io } from 'socket.io-client';
import SecurityStepper, { type SecurityPhaseProgressPayload } from './SecurityStepper';

interface CockpitPanelProps {
  projectId: string;
  apiUrl: string;
  project?: {
    id?: string;
    security_score?: number | null;
    security_rating?: string | null;
    last_security_audit_at?: string | null;
  };
  sessionId?: string;
  sessionTitle?: string;
  initialGoal?: string;
  initialModel?: string;
  initialReasoningLevel?: string;
  compact?: boolean;
  onTaskStarted?: () => void;
  onModelChanged?: (newModel: string) => void;
  onReasoningChanged?: (newReasoning: string) => void;
  hideSecurityCard?: boolean;
}

export default function CockpitPanel({
  projectId,
  apiUrl,
  project,
  sessionId,
  sessionTitle,
  initialGoal: _initialGoal,
  initialModel = 'auto',
  initialReasoningLevel = 'medium',
  compact = false,
  hideSecurityCard = false,
  onTaskStarted,
  onModelChanged,
  onReasoningChanged,
}: CockpitPanelProps) {
  const [graphState, setGraphState] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [reasoningLevel, setReasoningLevel] = useState(initialReasoningLevel);
  const [maxTurns, setMaxTurns] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [securitySummary, setSecuritySummary] = useState<any>(null);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [phaseProgress, setPhaseProgress] = useState<SecurityPhaseProgressPayload | null>(null);

  useEffect(() => {
    if (initialModel) setSelectedModel(initialModel);
    if (initialReasoningLevel) setReasoningLevel(initialReasoningLevel);
  }, [initialModel, initialReasoningLevel, sessionId]);

  const fetchGraphState = () => {
    const url = sessionId
      ? `${apiUrl}/api/projects/${projectId}/graph/state?sessionId=${sessionId}`
      : `${apiUrl}/api/projects/${projectId}/graph/state`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.state) {
          setGraphState(data.state);
          if (data.state.status === 'completed' || data.state.status === 'waiting_human') {
            setIsLoading(false);
          }
        }
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

  const fetchSecurity = () => {
    fetch(`${apiUrl}/api/projects/${projectId}/security`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSecuritySummary(data);
        }
      })
      .catch(() => {});
  };

  const fetchRunStatus = () => {
    fetch(`${apiUrl}/api/projects/${projectId}/security/run-status`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.latestRun) {
          const run = data.latestRun;
          setPhaseProgress({
            projectId: run.project_id,
            runId: run.id,
            phase: run.phase,
            totalPhases: run.total_phases,
            phaseName: run.phase_name,
            agentRole: run.agent_role,
            agentName: run.agent_name,
            currentCheck: run.current_check,
            targetFile: run.target_file || undefined,
            findingsCountSoFar: run.findings_count,
            scoreSoFar: run.score,
            status: run.status === 'failed' ? 'error' : run.status,
            timestamp: run.updated_at,
          });
          if (run.status === 'running' || data.isRunning) {
            setIsScanning(true);
          } else if (run.status === 'completed') {
            setIsScanning(false);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchGraphState();
    fetchTelemetry();
    fetchSecurity();
    fetchRunStatus();

    const socket = io(apiUrl);
    socket.emit('join_project', { projectId });

    socket.on('graph_state_updated', (data) => {
      if (data.graphState) setGraphState(data.graphState);
      else if (data.status) setGraphState(data);
      setIsLoading(false);
    });

    socket.on('agent_step_started', (data) => {
      setGraphState((prev: any) => ({
        ...(prev || {}),
        status: 'running',
        currentAgent: data.agentId,
      }));
      setIsLoading(false);
    });

    socket.on('telemetry_updated', (data) => {
      if (data.telemetry) setTelemetry(data.telemetry);
    });

    socket.on('security_updated', (data) => {
      if (data.summary) {
        setSecuritySummary(data.summary);
      }
    });

    socket.on('security_phase_progress', (data: SecurityPhaseProgressPayload) => {
      setPhaseProgress(data);
      if (data.status === 'completed') {
        setIsScanning(false);
        fetchSecurity();
      } else if (data.status === 'running') {
        setIsScanning(true);
      } else if (data.status === 'error') {
        setIsScanning(false);
      }
    });

    const interval = setInterval(() => {
      fetchGraphState();
      fetchTelemetry();
      fetchSecurity();
      fetchRunStatus();
    }, 4000);

    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, [projectId, sessionId, apiUrl]);

  const handleTriggerSecurityScan = async () => {
    setIsScanning(true);
    if (onTaskStarted) {
      onTaskStarted();
    }
    setPhaseProgress({
      projectId,
      phase: 1,
      totalPhases: 5,
      phaseName: 'Iniciando Pipeline de Segurança',
      agentRole: 'delta-security',
      agentName: 'Delta Security (Red Team)',
      currentCheck: 'Conectando ao orquestrador de auditoria adversarial...',
      findingsCountSoFar: securitySummary?.totalFindings || 0,
      scoreSoFar: securitySummary?.score ?? project?.security_score ?? 100,
      status: 'running',
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/security/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sessionId: sessionId || 'general',
          model: selectedModel || 'auto',
          reasoningLevel,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.activeRun) {
        const run = data.activeRun;
        setPhaseProgress({
          projectId: run.project_id,
          runId: run.id,
          phase: run.phase,
          totalPhases: run.total_phases,
          phaseName: run.phase_name,
          agentRole: run.agent_role,
          agentName: run.agent_name,
          currentCheck: run.current_check,
          targetFile: run.target_file || undefined,
          findingsCountSoFar: run.findings_count,
          scoreSoFar: run.score,
          status: 'running',
          timestamp: run.updated_at,
        });
        setIsScanning(true);
      } else if (!res.ok) {
        console.warn('Scan trigger response:', data.message || data.error);
        setIsScanning(false);
      }
    } catch (e) {
      console.error('Falha ao disparar scan de segurança:', e);
      setIsScanning(false);
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

  // Resolução do score real sem o falso 100% de fallback
  const resolvedScore: number | null = securitySummary?.score ?? project?.security_score ?? null;
  const resolvedRating: string | null = securitySummary?.rating ?? project?.security_rating ?? null;

  return (
    <div className="space-y-4">
      {/* 1. Bar de Telemetria e Governança (Modo Expandido) */}
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Status Grafo</div>
              <div className="text-xs font-semibold text-white capitalize truncate">
                {graphState?.status || 'idle'} {graphState?.turnCount !== undefined ? `(${graphState.turnCount}/${graphState.maxTurns || 5}t)` : ''}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Coins size={18} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Consumo Tokens</div>
              <div className="text-xs font-semibold text-white truncate">
                {telemetry?.totalTokens?.toLocaleString() || '0'} (~${telemetry?.estimatedCostUsd || '0.00'})
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              resolvedScore === null ? 'bg-zinc-800/60 text-zinc-400' :
              resolvedScore >= 90 ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Red vs. Blue Score</div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                {resolvedScore !== null ? (
                  <>
                    <span>{resolvedScore}/100</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      resolvedScore >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {resolvedRating || 'A+'}
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-500 font-mono">-- / 100 (Não auditado)</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">AI-DLC & MCP</div>
              <button
                onClick={handleAutoSetup}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
              >
                Auto-Setup
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <CloudUpload size={18} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Backup S3</div>
              <button
                onClick={handleCreateSnapshot}
                className="text-xs text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
              >
                Snapshot S3
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

      {/* 3. Painel de Governança & Operações de Segurança (Sem Caixa de Texto Redundante) */}
      <div className={`bg-zinc-950/80 border border-zinc-800/90 rounded-2xl ${compact ? 'p-4' : 'p-6'} ${hideSecurityCard ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-400" />
            <span>Governança & Operações de Segurança</span>
            {sessionTitle && (
              <span className="text-xs normal-case font-normal text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Sessão: {sessionTitle}
              </span>
            )}
          </h3>
        </div>

        {/* Stepper Universal Compartilhado */}
        <div className="my-3">
          <SecurityStepper
            phaseProgress={phaseProgress}
            isScanning={isScanning}
            lastAuditAt={project?.last_security_audit_at}
          />
        </div>

        {/* Linha de Controles & Disparo de Auditoria (Sem Caixa de Texto) */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between pt-2">
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
                <option value="gemini-flex" className="bg-zinc-900 text-emerald-400 font-semibold">💸 Modo Flex (Ultra Econômico / Mais Barato)</option>
                <option value="gemini-3.5-flash-lite" className="bg-zinc-900 text-white">⚡ 3.5 Flash Lite (Ultra Rápido)</option>
                <option value="gemini-3.5-flash" className="bg-zinc-900 text-white">⚡ 3.5 Flash (Equilibrado)</option>
                <option value="gemini-3.6-flash" className="bg-zinc-900 text-white">🎯 3.6 Flash (Alta Precisão)</option>
                <option value="gemini-3.7-flash" className="bg-zinc-900 text-white">🔥 3.7 Flash (Thinking Frontier)</option>
                <option value="gemini-3.1-pro" className="bg-zinc-900 text-white">🧠 3.1 Pro (Raciocínio Profundo)</option>
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
            onClick={handleTriggerSecurityScan}
            disabled={isScanning || phaseProgress?.status === 'running'}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs md:text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_20px_rgba(225,29,72,0.5)] flex items-center gap-2 cursor-pointer shrink-0"
          >
            {isScanning || phaseProgress?.status === 'running' ? (
              <>
                <RefreshCw size={14} className="animate-spin text-white" />
                Auditando Código (Fase {phaseProgress?.phase || 1}/5)...
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Disparar Auditoria Adversarial
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
