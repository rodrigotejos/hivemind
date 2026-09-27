import { useState, useEffect, useMemo } from 'react';
import { Terminal, CheckCircle, RefreshCw, X, Send, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react';

interface GitDiffModalProps {
  projectId: string;
  apiUrl: string;
  diff: string;
  suggestedCommitMessage?: string;
  taskTitle?: string;
  onClose: () => void;
  onCommitSuccess?: (commitHash: string) => void;
  onRejectSuccess?: (backupBranch: string) => void;
}

export interface SplitRow {
  oldLine?: { num: number; content: string };
  newLine?: { num: number; content: string };
  type: 'add' | 'del' | 'mod' | 'normal' | 'hunk';
  hunkHeader?: string;
}

export interface ParsedDiffFile {
  id: string;
  oldPath: string;
  newPath: string;
  displayPath: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  rawDiff: string;
  splitRows: SplitRow[];
  unifiedLines: Array<{
    type: 'add' | 'del' | 'normal' | 'hunk';
    oldNum?: number;
    newNum?: number;
    content: string;
  }>;
}

function parseGitDiff(rawDiff: string): ParsedDiffFile[] {
  if (!rawDiff || !rawDiff.trim()) return [];

  const fileChunks = rawDiff.split(/^diff --git /m).filter(Boolean);
  const files: ParsedDiffFile[] = [];

  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    let oldPath = '';
    let newPath = '';

    const firstLine = lines[0] || '';
    const matchHeader = firstLine.match(/a\/(.+?)\s+b\/(.+)$/);
    if (matchHeader) {
      oldPath = matchHeader[1];
      newPath = matchHeader[2];
    }

    let status: ParsedDiffFile['status'] = 'modified';
    if (chunk.includes('new file mode')) status = 'added';
    else if (chunk.includes('deleted file mode')) status = 'deleted';

    const displayPath = newPath || oldPath || 'arquivo_desconhecido';

    let additions = 0;
    let deletions = 0;
    const splitRows: SplitRow[] = [];
    const unifiedLines: ParsedDiffFile['unifiedLines'] = [];

    let oldLineNum = 0;
    let newLineNum = 0;

    let inHunk = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
      if (hunkMatch) {
        inHunk = true;
        oldLineNum = parseInt(hunkMatch[1], 10);
        newLineNum = parseInt(hunkMatch[2], 10);

        splitRows.push({
          type: 'hunk',
          hunkHeader: line,
        });

        unifiedLines.push({
          type: 'hunk',
          content: line,
        });
        continue;
      }

      if (!inHunk) continue;

      if (line.startsWith('+')) {
        additions++;
        const content = line.substring(1);
        splitRows.push({
          type: 'add',
          newLine: { num: newLineNum++, content },
        });
        unifiedLines.push({
          type: 'add',
          newNum: newLineNum - 1,
          content,
        });
      } else if (line.startsWith('-')) {
        deletions++;
        const content = line.substring(1);
        splitRows.push({
          type: 'del',
          oldLine: { num: oldLineNum++, content },
        });
        unifiedLines.push({
          type: 'del',
          oldNum: oldLineNum - 1,
          content,
        });
      } else if (line.startsWith(' ')) {
        const content = line.substring(1);
        splitRows.push({
          type: 'normal',
          oldLine: { num: oldLineNum++, content },
          newLine: { num: newLineNum++, content },
        });
        unifiedLines.push({
          type: 'normal',
          oldNum: oldLineNum - 1,
          newNum: newLineNum - 1,
          content,
        });
      }
    }

    files.push({
      id: displayPath,
      oldPath,
      newPath,
      displayPath,
      status,
      additions,
      deletions,
      rawDiff: chunk,
      splitRows,
      unifiedLines,
    });
  }

  return files;
}

export default function GitDiffModal({
  projectId,
  apiUrl,
  diff,
  suggestedCommitMessage = 'fix(security): apply defensive patch [Red-Team-Verified]',
  taskTitle,
  onClose,
  onCommitSuccess,
  onRejectSuccess,
}: GitDiffModalProps) {
  const [commitMessage, setCommitMessage] = useState(suggestedCommitMessage);
  const [liveDiff, setLiveDiff] = useState<string>(diff);
  const [fetchingDiff, setFetchingDiff] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [rejectedBranch, setRejectedBranch] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [sensitiveFiles, setSensitiveFiles] = useState<string[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de Visualização IDE
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [viewedFiles, setViewedFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFetchingDiff(true);
    const query = taskTitle ? `?taskTitle=${encodeURIComponent(taskTitle)}` : '';
    fetch(`${apiUrl}/api/projects/${projectId}/git/diff${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.diff) setLiveDiff(data.diff);
          if (data.suggestedMessage && (!commitMessage || commitMessage === suggestedCommitMessage)) {
            setCommitMessage(data.suggestedMessage);
          }
          if (data.sensitiveFilesDetected) {
            setSensitiveFiles(data.sensitiveFilesDetected);
            setIsBlocked(!!data.isBlocked);
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetchingDiff(false));
  }, [projectId, apiUrl, taskTitle]);

  const parsedFiles = useMemo(() => {
    return parseGitDiff(liveDiff || diff);
  }, [liveDiff, diff]);

  // Inicializa todos os arquivos abertos
  useEffect(() => {
    if (parsedFiles.length > 0) {
      const initialExpanded: Record<string, boolean> = {};
      parsedFiles.forEach(f => {
        if (expandedFiles[f.id] === undefined) {
          initialExpanded[f.id] = true;
        }
      });
      setExpandedFiles(prev => ({ ...initialExpanded, ...prev }));
    }
  }, [parsedFiles]);

  const toggleExpand = (fileId: string) => {
    setExpandedFiles(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const toggleViewed = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowViewed = !viewedFiles[fileId];
    setViewedFiles(prev => ({ ...prev, [fileId]: isNowViewed }));
    if (isNowViewed) {
      setExpandedFiles(prev => ({ ...prev, [fileId]: false }));
    } else {
      setExpandedFiles(prev => ({ ...prev, [fileId]: true }));
    }
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    parsedFiles.forEach(f => {
      next[f.id] = expand;
    });
    setExpandedFiles(next);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isBlocked) return;
    setCommitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage.trim(), operator: 'Human Supervisor' }),
      });

      const data = await res.json();
      if (data.success) {
        setCommittedHash(data.commitHash);
        if (onCommitSuccess) onCommitSuccess(data.commitHash);
      } else {
        setErrorMsg(data.error || 'Falha ao executar commit.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro de conexão.');
    } finally {
      setCommitting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/git/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejeitado pelo Human Supervisor no Cockpit', operator: 'Human Supervisor' }),
      });

      const data = await res.json();
      if (data.success) {
        setRejectedBranch(data.backupBranch || 'backup/rejected');
        setShowRejectConfirm(false);
        if (onRejectSuccess) onRejectSuccess(data.backupBranch);
      } else {
        setErrorMsg(data.error || 'Falha ao rejeitar modificações.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro de conexão ao rejeitar.');
    } finally {
      setRejecting(false);
    }
  };

  const viewedCount = Object.values(viewedFiles).filter(Boolean).length;
  const totalFiles = parsedFiles.length;
  const reviewPercent = totalFiles > 0 ? Math.round((viewedCount / totalFiles) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Terminal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Revisão de Alterações no Repositório (Git Diff)
                </h3>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md">
                  {totalFiles} {totalFiles === 1 ? 'arquivo' : 'arquivos'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Inspeção interativa de modificações geradas pelos agentes antes da integração oficial ao Git.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Split vs Unified Mode Selector */}
            <div className="bg-zinc-950 p-1 border border-zinc-800 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Lado a Lado
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  viewMode === 'unified' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Unificado
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Security Warning Banner (Security Baseline) */}
        {isBlocked && (
          <div className="mx-4 mt-3 p-3 bg-red-950/60 border border-red-500/50 rounded-xl flex items-start gap-2.5 text-xs text-red-300 animate-in fade-in">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
            <div>
              <strong className="font-semibold text-red-200">Violação de Segurança (Security Baseline):</strong>
              <p className="mt-0.5 text-red-300/90 leading-relaxed">
                Arquivos confidenciais ou segredos detectados (<span className="font-mono text-red-200">{sensitiveFiles.join(', ')}</span>). O commit está bloqueado para prevenir o envio acidental de credenciais ao repositório.
              </p>
            </div>
          </div>
        )}

        {/* Progress & Quick Controls Bar */}
        <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Revisados: <strong className="text-zinc-200">{viewedCount}</strong> de <strong className="text-zinc-200">{totalFiles}</strong> ({reviewPercent}%)</span>
            </div>
            {reviewPercent === 100 && totalFiles > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md font-medium">
                Todos Verificados
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExpandAll(true)}
              className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800"
            >
              Expandir Todos
            </button>
            <span>•</span>
            <button
              onClick={() => handleExpandAll(false)}
              className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800"
            >
              Recolher Todos
            </button>
          </div>
        </div>

        {/* Main Diff Content: File Accordions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fetchingDiff ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-xs gap-3">
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
              <span>Inspecionando modificações no repositório com o Git...</span>
            </div>
          ) : parsedFiles.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 text-xs">
              Nenhuma modificação real detectada nos arquivos do repositório.
            </div>
          ) : (
            parsedFiles.map((file) => {
              const isExpanded = expandedFiles[file.id] ?? true;
              const isViewed = viewedFiles[file.id] ?? false;

              return (
                <div
                  key={file.id}
                  className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                    isViewed
                      ? 'border-zinc-800/50 bg-zinc-950/40 opacity-80'
                      : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  {/* File Accordion Header */}
                  <div
                    onClick={() => toggleExpand(file.id)}
                    className="p-3 bg-zinc-900/80 hover:bg-zinc-900 cursor-pointer flex items-center justify-between gap-3 border-b border-zinc-800/80 select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                        {file.displayPath}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                        {file.additions > 0 && (
                          <span className="text-emerald-400 font-bold">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-rose-400 font-bold">-{file.deletions}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* GitHub-style "Viewed" Checkbox */}
                      <label
                        onClick={(e) => toggleViewed(file.id, e)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={isViewed}
                          readOnly
                          className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-medium">Revisado</span>
                      </label>

                      <span className="text-zinc-500 text-xs font-mono">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* File Diff Body */}
                  {isExpanded && (
                    <div className="font-mono text-[11px] overflow-x-auto bg-zinc-950">
                      {viewMode === 'split' ? (
                        /* SIDE-BY-SIDE SPLIT VIEW */
                        <table className="w-full border-collapse">
                          <tbody>
                            {file.splitRows.map((row, idx) => {
                              if (row.type === 'hunk') {
                                return (
                                  <tr key={idx} className="bg-indigo-950/20 text-indigo-300/80 text-[10px]">
                                    <td colSpan={4} className="py-1 px-4 font-bold border-y border-indigo-900/30">
                                      {row.hunkHeader}
                                    </td>
                                  </tr>
                                );
                              }

                              const isAdd = row.type === 'add';
                              const isDel = row.type === 'del';

                              return (
                                <tr key={idx} className="hover:bg-zinc-900/40">
                                  {/* Left Pane (Old) */}
                                  <td className="w-10 text-right pr-2 select-none text-zinc-600 bg-zinc-900/30 border-r border-zinc-900">
                                    {row.oldLine?.num ?? ''}
                                  </td>
                                  <td
                                    className={`w-[50%] px-2 whitespace-pre font-mono ${
                                      isDel ? 'bg-rose-950/30 text-rose-300' : 'text-zinc-400'
                                    }`}
                                  >
                                    {row.oldLine?.content ?? ''}
                                  </td>

                                  {/* Right Pane (New) */}
                                  <td className="w-10 text-right pr-2 select-none text-zinc-600 bg-zinc-900/30 border-r border-zinc-900 border-l border-zinc-900">
                                    {row.newLine?.num ?? ''}
                                  </td>
                                  <td
                                    className={`w-[50%] px-2 whitespace-pre font-mono ${
                                      isAdd ? 'bg-emerald-950/30 text-emerald-300' : 'text-zinc-400'
                                    }`}
                                  >
                                    {row.newLine?.content ?? ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        /* UNIFIED DIFF VIEW */
                        <div className="divide-y divide-zinc-900">
                          {file.unifiedLines.map((line, idx) => {
                            if (line.type === 'hunk') {
                              return (
                                <div key={idx} className="bg-indigo-950/20 text-indigo-300/80 text-[10px] py-1 px-4 font-bold">
                                  {line.content}
                                </div>
                              );
                            }

                            const isAdd = line.type === 'add';
                            const isDel = line.type === 'del';

                            return (
                              <div
                                key={idx}
                                className={`flex items-start px-2 py-0.5 hover:bg-zinc-900/40 ${
                                  isAdd
                                    ? 'bg-emerald-950/25 text-emerald-300'
                                    : isDel
                                    ? 'bg-rose-950/25 text-rose-300'
                                    : 'text-zinc-400'
                                }`}
                              >
                                <span className="w-8 text-right pr-2 select-none text-zinc-600 text-[10px]">
                                  {line.oldNum ?? ''}
                                </span>
                                <span className="w-8 text-right pr-2 select-none text-zinc-600 text-[10px]">
                                  {line.newNum ?? ''}
                                </span>
                                <span className="w-4 select-none text-center font-bold">
                                  {isAdd ? '+' : isDel ? '-' : ' '}
                                </span>
                                <span className="flex-1 whitespace-pre font-mono pl-1">
                                  {line.content}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Commit / Reject Action Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80">
          {committedHash ? (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} />
                <span>
                  Commit criado com sucesso no repositório! Hash:{' '}
                  <strong className="font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-200">
                    {committedHash}
                  </strong>
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          ) : rejectedBranch ? (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-300 text-xs">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} />
                <span>
                  Modificações revertidas no repositório. Backup preservado na branch:{' '}
                  <strong className="font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40 text-amber-200">
                    {rejectedBranch}
                  </strong>
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {errorMsg && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Mensagem do Commit Git (Conventional Commits)..."
                  className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setShowRejectConfirm(true)}
                    disabled={committing || rejecting}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-700/50 text-rose-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    <RotateCcw size={14} />
                    Rejeitar Modificações
                  </button>

                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-zinc-400 hover:text-white text-xs font-medium"
                  >
                    Fechar
                  </button>

                  <button
                    onClick={handleCommit}
                    disabled={committing || rejecting || isBlocked || !commitMessage.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
                  >
                    {committing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Comitando...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Aprovar e Comitar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Reject with Backup (Resiliency Baseline) */}
      {showRejectConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <RotateCcw size={18} />
              <span>Confirmar Rejeição de Modificações</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              As alterações serão revertidas na working tree. Para garantir total resiliência (<strong>Resiliency Baseline</strong>), uma branch de backup temporária (<code className="text-amber-300 font-mono">backup/rejected-...</code>) será criada automaticamente no repositório antes da limpeza, permitindo recuperar qualquer código gerado caso a rejeição tenha sido um engano.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white"
                disabled={rejecting}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-lg"
              >
                {rejecting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Criando Backup & Revertendo...
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    Confirmar Rejeição & Backup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
