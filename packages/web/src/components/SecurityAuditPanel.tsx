import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Terminal, 
  Activity,
  Bot,
  Send
} from 'lucide-react';
import { io } from 'socket.io-client';
import GitDiffModal from './GitDiffModal';

export interface SecurityFinding {
  id: string;
  project_id: string;
  session_id?: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  red_team_details?: string;
  blue_team_mitigation?: string;
  status: 'open' | 'mitigating' | 'mitigated' | 'verified';
  affected_file?: string;
  created_at: string;
  updated_at: string;
}

export interface SecuritySummary {
  score: number;
  rating: string;
  totalFindings: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  statusCounts: { open: number; mitigating: number; mitigated: number; verified: number };
  findings: SecurityFinding[];
}

export interface RemediationProgress {
  step: number;
  totalSteps: number;
  agentRole: string;
  agentName: string;
  percent: number;
  status: string;
  error?: boolean;
}

interface SecurityAuditPanelProps {
  projectId: string;
  apiUrl: string;
}

export default function SecurityAuditPanel({ projectId, apiUrl }: SecurityAuditPanelProps) {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [remediating, setRemediating] = useState<Record<string, RemediationProgress>>({});
  const [remediationCompleted, setRemediationCompleted] = useState<Record<string, { diff: string; suggestedCommitMessage: string }>>({});
  const [diffModalData, setDiffModalData] = useState<{ diff: string; message: string } | null>(null);

  const fetchSecurityData = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/security`);
      const data = await res.json();
      if (data.success) {
        setSummary(data);
      }
    } catch (e) {
      console.error('Erro ao buscar auditoria de segurança:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();

    const socket = io(apiUrl);
    socket.emit('join_project', { projectId });

    socket.on('security_updated', (data) => {
      if (data.summary) {
        setSummary(data.summary);
      }
    });

    socket.on('remediation_progress', (data) => {
      if (data.findingId) {
        setRemediating(prev => ({
          ...prev,
          [data.findingId]: {
            step: data.step,
            totalSteps: data.totalSteps || 3,
            agentRole: data.agentRole,
            agentName: data.agentName,
            percent: data.percent,
            status: data.status,
            error: data.error,
          }
        }));
      }
    });

    socket.on('remediation_completed', (data) => {
      if (data.findingId) {
        setRemediationCompleted(prev => ({
          ...prev,
          [data.findingId]: {
            diff: data.diff,
            suggestedCommitMessage: data.suggestedCommitMessage,
          }
        }));
        setRemediating(prev => {
          const next = { ...prev };
          delete next[data.findingId];
          return next;
        });
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    });

    return () => {
      socket.close();
    };
  }, [projectId, apiUrl]);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await fetch(`${apiUrl}/api/projects/${projectId}/security/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      setTimeout(() => {
        setScanning(false);
        fetchSecurityData();
      }, 3000);
    } catch (e) {
      console.error('Falha ao disparar scan:', e);
      setScanning(false);
    }
  };

  const handleStartRemediation = async (findingId: string) => {
    // Inicializa status bar imediatamente
    setRemediating(prev => ({
      ...prev,
      [findingId]: {
        step: 1,
        totalSteps: 3,
        agentRole: 'backend',
        agentName: 'Beta (Backend - Blue Team)',
        percent: 15,
        status: 'Iniciando agentes para auto-remediação...',
      }
    }));
    setExpandedFindings(prev => ({ ...prev, [findingId]: true }));

    try {
      await fetch(`${apiUrl}/api/projects/${projectId}/security/findings/${findingId}/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('Falha ao disparar auto-remediação:', e);
    }
  };

  const handleUpdateStatus = async (findingId: string, newStatus: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/security/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success && data.summary) {
        setSummary(data.summary);
      }
    } catch (e) {
      console.error('Erro ao atualizar status do finding:', e);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedFindings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-zinc-950/60 rounded-2xl border border-zinc-800">
        <RefreshCw className="animate-spin text-indigo-400 mr-2" size={20} />
        <span className="text-zinc-400 text-sm">Carregando auditoria de segurança...</span>
      </div>
    );
  }

  const score = summary?.score ?? 100;
  const rating = summary?.rating ?? 'A+';

  const scoreColor = 
    score >= 90 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    score >= 75 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-rose-400 border-rose-500/30 bg-rose-500/10';

  const scoreBadgeBg = 
    score >= 90 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
    score >= 75 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
    'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const findings = (summary?.findings || []).filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Security Score & Resumo Adversarial */}
      <div className="relative overflow-hidden bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Score Ring / Card */}
            <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border ${scoreColor} shadow-[0_0_20px_rgba(0,0,0,0.4)]`}>
              <span className="text-2xl font-black">{score}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider">Score</span>
              <span className={`text-xs font-bold px-2 py-0.5 mt-0.5 rounded-full border ${scoreBadgeBg}`}>
                {rating}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="text-indigo-400" size={22} />
                  Auditoria Adversarial: Red Team vs. Blue Team
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  OWASP Top 10
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                O agente <strong className="text-rose-400">Delta Security (Red Team)</strong> busca vulnerabilidades ativamente, enquanto o <strong className="text-cyan-400">Beta Backend & Alpha Frontend (Blue Team)</strong> aplicam defesas e mitigações no código.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_20px_rgba(225,29,72,0.5)]"
            >
              {scanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Auditando Código...
                </>
              ) : (
                <>
                  <Activity size={14} />
                  Disparar Scan Red Team
                </>
              )}
            </button>
          </div>
        </div>

        {/* Breakdown de Severidades & Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block">Críticas & Altas</span>
              <span className="text-sm font-bold text-rose-400">
                {(summary?.severityCounts.critical || 0) + (summary?.severityCounts.high || 0)}
              </span>
            </div>
            <ShieldAlert size={20} className="text-rose-400/60" />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block">Médias & Baixas</span>
              <span className="text-sm font-bold text-amber-400">
                {(summary?.severityCounts.medium || 0) + (summary?.severityCounts.low || 0)}
              </span>
            </div>
            <AlertTriangle size={20} className="text-amber-400/60" />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block">Mitigadas (Blue Team)</span>
              <span className="text-sm font-bold text-cyan-400">
                {summary?.statusCounts.mitigated || 0}
              </span>
            </div>
            <ShieldCheck size={20} className="text-cyan-400/60" />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block">100% Verificadas</span>
              <span className="text-sm font-bold text-emerald-400">
                {summary?.statusCounts.verified || 0}
              </span>
            </div>
            <CheckCircle size={20} className="text-emerald-400/60" />
          </div>
        </div>
      </div>

      {/* Filtros e Lista de Vulnerabilidades */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-400 mr-1">Status:</span>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'open', label: 'Abertos (Red Team)' },
              { id: 'mitigated', label: 'Mitigados (Blue Team)' },
              { id: 'verified', label: 'Verificados' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">Severidade:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-700/80 text-zinc-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        {/* Lista de Findings */}
        <div className="space-y-3">
          {findings.length === 0 ? (
            <div className="p-8 text-center bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
              <ShieldCheck size={32} className="text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-zinc-300">Nenhuma vulnerabilidade encontrada com os filtros atuais.</p>
              <p className="text-xs text-zinc-500 mt-1">O ecossistema está em conformidade com as regras de segurança.</p>
            </div>
          ) : (
            findings.map(finding => {
              const isExpanded = expandedFindings[finding.id] ?? true;
              const isRemediating = !!remediating[finding.id];
              const remProgress = remediating[finding.id];
              const remCompleted = remediationCompleted[finding.id];

              const severityBadge = 
                finding.severity === 'critical' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                finding.severity === 'high' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                finding.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                'bg-blue-500/20 text-blue-300 border-blue-500/40';

              const statusBadge = 
                finding.status === 'open' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                finding.status === 'mitigating' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                finding.status === 'mitigated' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

              return (
                <div 
                  key={finding.id}
                  className={`bg-zinc-950/80 border rounded-xl overflow-hidden transition-all ${
                    isRemediating ? 'border-cyan-500/60 ring-1 ring-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'border-zinc-800/90 hover:border-zinc-700/80'
                  }`}
                >
                  <div 
                    onClick={() => toggleExpand(finding.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none bg-zinc-900/30 hover:bg-zinc-900/50"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${severityBadge}`}>
                        {finding.severity}
                      </span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                        {finding.status === 'open' ? '🔴 Aberto (Red Team)' : finding.status === 'mitigated' ? '🛡️ Mitigado (Blue Team)' : finding.status === 'verified' ? '✓ Verificado' : '🟡 Em Mitigação'}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {finding.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {finding.affected_file && (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          <Terminal size={12} className="text-indigo-400" />
                          {finding.affected_file}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 font-bold px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-800">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40 space-y-4">
                      {/* BARRA DE STATUS / PROGRESSO EMBUTIDA */}
                      {isRemediating && remProgress && (
                        <div className="bg-gradient-to-r from-cyan-950/30 via-indigo-950/30 to-purple-950/30 border border-cyan-500/40 rounded-xl p-4 space-y-3 animate-pulse">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <Bot size={16} className="text-cyan-400 animate-bounce" />
                              <span className="font-bold text-white">
                                Agente Ativo: <strong className="text-cyan-300 font-mono">{remProgress.agentName}</strong>
                              </span>
                            </div>
                            <span className="text-cyan-400 font-mono font-bold text-xs">
                              {remProgress.percent}% (Etapa {remProgress.step}/{remProgress.totalSteps})
                            </span>
                          </div>

                          {/* Steps Pills */}
                          <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold">
                            <div className={`p-1.5 rounded-lg border text-center ${
                              remProgress.step >= 1 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-zinc-900/40 text-zinc-600 border-zinc-800'
                            }`}>
                              1. 🔵 Blue Team (Patch)
                            </div>
                            <div className={`p-1.5 rounded-lg border text-center ${
                              remProgress.step >= 2 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-zinc-900/40 text-zinc-600 border-zinc-800'
                            }`}>
                              2. 🔴 Red Team (Re-Audit)
                            </div>
                            <div className={`p-1.5 rounded-lg border text-center ${
                              remProgress.step >= 3 ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-zinc-900/40 text-zinc-600 border-zinc-800'
                            }`}>
                              3. 🟣 QA (Integridade)
                            </div>
                          </div>

                          {/* Progress Track */}
                          <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${remProgress.percent}%` }}
                            ></div>
                          </div>

                          <p className="text-[11px] text-zinc-300 font-mono">
                            ⚡ {remProgress.status}
                          </p>
                        </div>
                      )}

                      {/* CARD DE SUCESSO DA REMEDIAÇÃO + BOTÕES GIT */}
                      {remCompleted && (
                        <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                              <CheckCircle size={16} />
                              <span>✓ Correção validada pelo Red Team & QA! Código pronto para commit.</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDiffModalData({
                                  diff: remCompleted.diff,
                                  message: remCompleted.suggestedCommitMessage,
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition-all border border-zinc-700"
                              >
                                <Terminal size={13} className="text-cyan-400" />
                                Visualizar Git Diff
                              </button>

                              <button
                                onClick={() => setDiffModalData({
                                  diff: remCompleted.diff,
                                  message: remCompleted.suggestedCommitMessage,
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                <Send size={13} />
                                Subir Commit Automático
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Comparativo de Ataque vs. Defesa */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Red Team Attack Vector */}
                        <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                            <ShieldAlert size={14} />
                            <span>Vetor de Ataque (Red Team - Delta Security)</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {finding.red_team_details || 'Vulnerabilidade identificada durante a varredura automatizada no workspace.'}
                          </p>
                        </div>

                        {/* Blue Team Mitigation */}
                        <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                            <ShieldCheck size={14} />
                            <span>Contramedida & Mitigação (Blue Team)</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {finding.blue_team_mitigation || 'Aplicação de sanitização de dados, validação de schema e headers de segurança.'}
                          </p>
                        </div>
                      </div>

                      {/* Ações de Transição de Status e Botão Auto-Remediar */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 flex-wrap gap-3">
                        <span className="text-[11px] text-zinc-500">
                          Identificado em: {new Date(finding.created_at).toLocaleString('pt-BR')}
                        </span>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* BOTÃO PRINCIPAL: CORRIGIR COM AGENTES */}
                          {finding.status !== 'verified' && (
                            <button
                              onClick={() => handleStartRemediation(finding.id)}
                              disabled={isRemediating}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                            >
                              {isRemediating ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" />
                                  Corrigindo em Background...
                                </>
                              ) : (
                                <>
                                  <Bot size={14} />
                                  🤖 Corrigir com Agentes (Blue + Red Team)
                                </>
                              )}
                            </button>
                          )}

                          {finding.status !== 'mitigated' && !isRemediating && (
                            <button
                              onClick={() => handleUpdateStatus(finding.id, 'mitigated')}
                              className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-medium transition-all"
                            >
                              Marcar como Mitigado
                            </button>
                          )}

                          {finding.status !== 'verified' && !isRemediating && (
                            <button
                              onClick={() => handleUpdateStatus(finding.id, 'verified')}
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-all"
                            >
                              ✓ Validar como Seguro
                            </button>
                          )}

                          {finding.status !== 'open' && !isRemediating && (
                            <button
                              onClick={() => handleUpdateStatus(finding.id, 'open')}
                              className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200 text-xs transition-all"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE GIT DIFF E COMMIT */}
      {diffModalData && (
        <GitDiffModal
          projectId={projectId}
          apiUrl={apiUrl}
          diff={diffModalData.diff}
          suggestedCommitMessage={diffModalData.message}
          onClose={() => setDiffModalData(null)}
          onCommitSuccess={() => {
            fetchSecurityData();
          }}
        />
      )}
    </div>
  );
}
