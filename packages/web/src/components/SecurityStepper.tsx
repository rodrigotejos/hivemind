import { Layers, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';

export interface SecurityPhaseProgressPayload {
  projectId: string;
  runId?: string;
  phase: number;
  totalPhases: number;
  phaseName: string;
  agentRole: string;
  agentName: string;
  currentCheck: string;
  targetFile?: string;
  findingsCountSoFar?: number;
  scoreSoFar?: number;
  status: 'running' | 'completed' | 'failed' | 'error' | 'idle';
  timestamp?: string;
}

export interface SecurityStepperProps {
  phaseProgress: SecurityPhaseProgressPayload | null;
  isScanning?: boolean;
  compact?: boolean;
  lastAuditAt?: string | null;
  title?: string;
}

export const SECURITY_PIPELINE_STEPS = [
  { num: 1, label: '1. Rotas & CORS', name: 'Auditoria de Superfície de Ataque & CORS' },
  { num: 2, label: '2. Segredos .env', name: 'Detecção de Segredos & Credenciais Expostas' },
  { num: 3, label: '3. Red Team (OWASP)', name: 'Auditoria de Injeção & OWASP Top 10' },
  { num: 4, label: '4. Blue Team (Patch)', name: 'Análise de Defesa & Sanidade de Mitigações' },
  { num: 5, label: '5. Verificação & DB', name: 'Verificação Final & Persistência de Score' },
];

export default function SecurityStepper({
  phaseProgress,
  isScanning = false,
  compact = false,
  lastAuditAt,
  title = 'Pipeline de Verificação & Defesa em 5 Etapas',
}: SecurityStepperProps) {
  const isRunning = phaseProgress?.status === 'running' || (isScanning && phaseProgress?.status !== 'completed');
  const isCompleted = phaseProgress?.status === 'completed';
  const isFailed = phaseProgress?.status === 'failed' || phaseProgress?.status === 'error';

  const currentPhase = isRunning
    ? (phaseProgress?.phase || 1)
    : isCompleted
    ? 5
    : 0;

  return (
    <div className={`bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-2.5 transition-all shadow-inner ${compact ? 'text-xs' : ''}`}>
      {/* Cabeçalho do Stepper & Ticker ao Vivo */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <Layers size={14} className="text-indigo-400 shrink-0" />
          <span>{title}</span>
        </div>

        {/* Mini-Ticker Dinâmico de Progresso */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {isRunning ? (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-amber-300 font-bold">
                  Fase {phaseProgress?.phase || 1}/5: {phaseProgress?.phaseName || 'Executando inspeção'}
                </span>
                {phaseProgress?.targetFile && (
                  <span className="text-cyan-400 text-[10px] truncate max-w-[200px] sm:max-w-xs font-semibold">
                    [{phaseProgress.targetFile}]
                  </span>
                )}
                {phaseProgress?.currentCheck && (
                  <span className="text-zinc-400 text-[10px] truncate max-w-[220px] sm:max-w-sm hidden md:inline">
                    - {phaseProgress.currentCheck}
                  </span>
                )}
              </div>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-semibold text-[11px]">
                ✓ Auditoria Concluída: Score {phaseProgress?.scoreSoFar ?? 100}/100 persistido no SQLite
              </span>
            </div>
          ) : isFailed ? (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-lg">
              <AlertCircle size={13} className="text-rose-400 shrink-0" />
              <span className="text-rose-300 font-semibold text-[11px]">
                ✕ Falha na Auditoria: {phaseProgress?.currentCheck || 'Erro durante a execução'}
              </span>
            </div>
          ) : isScanning ? (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-lg">
              <RefreshCw size={12} className="animate-spin text-indigo-400 shrink-0" />
              <span className="text-indigo-300 text-[11px]">Iniciando pipeline de segurança...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
              <span className="text-zinc-400 text-[11px]">
                {lastAuditAt
                  ? `Último scan: ${new Date(lastAuditAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Pronto para Auditoria'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid de 5 Barras Determinísticas */}
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {SECURITY_PIPELINE_STEPS.map((step) => {
          const isPast = currentPhase > step.num;
          const isCurrent = currentPhase === step.num;

          const barColor =
            isPast || (isCurrent && isCompleted)
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : isCurrent && isRunning
              ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]'
              : isCurrent && isFailed
              ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              : 'bg-zinc-800';

          const textColor =
            isCurrent && isRunning
              ? 'text-amber-300 font-bold'
              : isPast || (isCurrent && isCompleted)
              ? 'text-zinc-300'
              : isCurrent && isFailed
              ? 'text-rose-400 font-bold'
              : 'text-zinc-600';

          return (
            <div key={step.num} className="flex flex-col gap-1">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`} />
              <span className={`text-[10px] truncate leading-tight ${textColor}`} title={step.name}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
