import { useState, useEffect, useMemo } from 'react';
import { Terminal, CheckCircle, RefreshCw, X, Send, ShieldCheck } from 'lucide-react';

interface GitDiffModalProps {
  projectId: string;
  apiUrl: string;
  diff: string;
  suggestedCommitMessage?: string;
  onClose: () => void;
  onCommitSuccess?: (commitHash: string) => void;
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

  for (let index = 0; index < fileChunks.length; index++) {
    const chunk = fileChunks[index];
    const lines = chunk.split('\n');
    const headerLine = lines[0] || '';
    const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/);

    let oldPath = match ? match[1] : '';
    let newPath = match ? match[2] : '';
    let status: 'modified' | 'added' | 'deleted' = 'modified';

    if (chunk.includes('new file mode')) {
      status = 'added';
    } else if (chunk.includes('deleted file mode')) {
      status = 'deleted';
    }

    const displayPath = newPath || oldPath || `arquivo_${index + 1}`;
    let additions = 0;
    let deletions = 0;

    const splitRows: SplitRow[] = [];
    const unifiedLines: ParsedDiffFile['unifiedLines'] = [];

    let oldLineNum = 0;
    let newLineNum = 0;

    let pendingDels: Array<{ num: number; content: string }> = [];
    let pendingAdds: Array<{ num: number; content: string }> = [];

    const flushPending = () => {
      const maxLen = Math.max(pendingDels.length, pendingAdds.length);
      for (let i = 0; i < maxLen; i++) {
        const del = pendingDels[i];
        const add = pendingAdds[i];
        let type: SplitRow['type'] = 'normal';
        if (del && add) type = 'mod';
        else if (del) type = 'del';
        else if (add) type = 'add';

        splitRows.push({
          oldLine: del,
          newLine: add,
          type,
        });
      }
      pendingDels = [];
      pendingAdds = [];
    };

    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
        continue;
      }

      if (line.startsWith('@@')) {
        flushPending();
        const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          oldLineNum = parseInt(hunkMatch[1], 10);
          newLineNum = parseInt(hunkMatch[2], 10);
        }
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

      if (line.startsWith('-')) {
        deletions++;
        const content = line.slice(1);
        pendingDels.push({ num: oldLineNum++, content });
        unifiedLines.push({
          type: 'del',
          oldNum: oldLineNum - 1,
          content,
        });
      } else if (line.startsWith('+')) {
        additions++;
        const content = line.slice(1);
        pendingAdds.push({ num: newLineNum++, content });
        unifiedLines.push({
          type: 'add',
          newNum: newLineNum - 1,
          content,
        });
      } else if (line.startsWith(' ') || line === '') {
        flushPending();
        const content = line.startsWith(' ') ? line.slice(1) : line;
        splitRows.push({
          oldLine: { num: oldLineNum++, content },
          newLine: { num: newLineNum++, content },
          type: 'normal',
        });
        unifiedLines.push({
          type: 'normal',
          oldNum: oldLineNum - 1,
          newNum: newLineNum - 1,
          content,
        });
      }
    }
    flushPending();

    files.push({
      id: `file_${index}_${displayPath}`,
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
  onClose,
  onCommitSuccess,
}: GitDiffModalProps) {
  const [commitMessage, setCommitMessage] = useState(suggestedCommitMessage);
  const [liveDiff, setLiveDiff] = useState<string>(diff);
  const [fetchingDiff, setFetchingDiff] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de Visualização IDE
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [viewedFiles, setViewedFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFetchingDiff(true);
    fetch(`${apiUrl}/api/projects/${projectId}/git/diff`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.diff) {
          setLiveDiff(data.diff);
        }
      })
      .catch(() => {})
      .finally(() => setFetchingDiff(false));
  }, [projectId, apiUrl]);

  const parsedFiles = useMemo(() => {
    return parseGitDiff(liveDiff || diff);
  }, [liveDiff, diff]);

  // Inicializa todos os arquivos abertos (True por padrão)
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
    // Quando marcado como visto, colapsa suavemente o card
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
    if (!commitMessage.trim()) return;
    setCommitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage.trim() }),
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
                Validação visual das defesas aplicadas pelo Blue Team e auditadas pelo Red Team.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Split vs Unified Mode Selector */}
            <div className="bg-zinc-950 p-1 border border-zinc-800 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ◫ Lado a Lado
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  viewMode === 'unified' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ≡ Unificado
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress & Review Status Bar */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <span className="text-zinc-400 font-medium whitespace-nowrap text-[11px]">
              Progresso da Revisão: <strong className="text-white">{viewedCount} de {totalFiles}</strong> ({reviewPercent}%)
            </span>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${reviewPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExpandAll(true)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Expandir Todos
            </button>
            <span className="text-zinc-600">|</span>
            <button
              onClick={() => handleExpandAll(false)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Recolher Todos
            </button>
          </div>
        </div>

        {/* Main Diff Content: File Accordions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/50">
          {fetchingDiff ? (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400 text-sm gap-2">
              <RefreshCw className="animate-spin text-indigo-400" size={24} />
              <span>Inspecionando modificações no repositório com o Git...</span>
            </div>
          ) : parsedFiles.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
              <ShieldCheck size={36} className="text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-zinc-300">Nenhuma alteração pendente detectada no repositório.</p>
              <p className="text-xs text-zinc-500 mt-1">O workspace está limpo e sincronizado com o branch.</p>
            </div>
          ) : (
            parsedFiles.map(file => {
              const isExpanded = expandedFiles[file.id] ?? true;
              const isViewed = !!viewedFiles[file.id];

              return (
                <div
                  key={file.id}
                  className={`bg-zinc-950 border rounded-xl overflow-hidden transition-all shadow-sm ${
                    isViewed ? 'border-zinc-800/60 opacity-80' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* File Header (Accordion Bar) */}
                  <div
                    onClick={() => toggleExpand(file.id)}
                    className="p-3.5 bg-zinc-900/50 hover:bg-zinc-900/80 cursor-pointer select-none flex items-center justify-between border-b border-zinc-800/80 flex-wrap gap-2"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-zinc-500 text-xs font-bold w-4 text-center">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="text-xs font-mono font-bold text-white tracking-wide">
                        {file.displayPath}
                      </span>

                      {/* Status Tag */}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        file.status === 'added' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        file.status === 'deleted' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                        'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      }`}>
                        {file.status === 'added' ? 'Novo Arquivo' : file.status === 'deleted' ? 'Excluído' : 'Modificado'}
                      </span>

                      {/* Stats (+/-) */}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
                        {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                        {file.deletions > 0 && <span className="text-rose-400">-{file.deletions}</span>}
                      </div>
                    </div>

                    {/* GitHub-style "Viewed" Checkbox */}
                    <div
                      onClick={(e) => toggleViewed(file.id, e)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                        isViewed
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-700/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isViewed}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded border-zinc-700 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Marcado como lido</span>
                    </div>
                  </div>

                  {/* File Diff Body */}
                  {isExpanded && (
                    <div className="overflow-x-auto text-[11px] font-mono leading-relaxed custom-scrollbar">
                      {viewMode === 'split' ? (
                        /* SIDE-BY-SIDE (SPLIT) TABLE */
                        <table className="w-full border-collapse table-fixed">
                          <thead>
                            <tr className="bg-zinc-900/30 text-[10px] text-zinc-500 border-b border-zinc-800">
                              <th className="w-12 py-1 text-center border-r border-zinc-800/80 font-normal">Antigo</th>
                              <th className="w-[calc(50%-3rem)] py-1 px-3 text-left border-r border-zinc-800 font-normal text-rose-400/80">
                                Original / Removido
                              </th>
                              <th className="w-12 py-1 text-center border-r border-zinc-800/80 font-normal">Novo</th>
                              <th className="w-[calc(50%-3rem)] py-1 px-3 text-left font-normal text-emerald-400/80">
                                Novo / Adicionado
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {file.splitRows.map((row, rIdx) => {
                              if (row.type === 'hunk') {
                                return (
                                  <tr key={rIdx} className="bg-cyan-950/20 border-y border-cyan-900/30 text-cyan-400 font-bold">
                                    <td colSpan={4} className="py-1 px-4 text-xs">
                                      {row.hunkHeader}
                                    </td>
                                  </tr>
                                );
                              }

                              const isDel = row.type === 'del' || row.type === 'mod';
                              const isAdd = row.type === 'add' || row.type === 'mod';

                              return (
                                <tr key={rIdx} className="border-b border-zinc-900/60 hover:bg-zinc-900/30 transition-colors">
                                  {/* Left Line Number */}
                                  <td className={`py-0.5 text-center text-zinc-600 select-none border-r border-zinc-800/80 ${
                                    isDel ? 'bg-rose-950/40 text-rose-400' : ''
                                  }`}>
                                    {row.oldLine?.num || ''}
                                  </td>
                                  {/* Left Code (Old) */}
                                  <td className={`py-0.5 px-3 border-r border-zinc-800 whitespace-pre overflow-x-hidden ${
                                    isDel ? 'bg-rose-950/25 text-rose-300' : 'text-zinc-400'
                                  }`}>
                                    {row.oldLine ? (
                                      <span>
                                        {isDel && <span className="text-rose-400 font-bold mr-1.5">-</span>}
                                        {row.oldLine.content}
                                      </span>
                                    ) : null}
                                  </td>

                                  {/* Right Line Number */}
                                  <td className={`py-0.5 text-center text-zinc-600 select-none border-r border-zinc-800/80 ${
                                    isAdd ? 'bg-emerald-950/40 text-emerald-400' : ''
                                  }`}>
                                    {row.newLine?.num || ''}
                                  </td>
                                  {/* Right Code (New) */}
                                  <td className={`py-0.5 px-3 whitespace-pre overflow-x-hidden ${
                                    isAdd ? 'bg-emerald-950/25 text-emerald-300' : 'text-zinc-400'
                                  }`}>
                                    {row.newLine ? (
                                      <span>
                                        {isAdd && <span className="text-emerald-400 font-bold mr-1.5">+</span>}
                                        {row.newLine.content}
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        /* UNIFIED DIFF VIEW */
                        <div className="p-3 space-y-0.5">
                          {file.unifiedLines.map((uLine, uIdx) => {
                            if (uLine.type === 'hunk') {
                              return (
                                <div key={uIdx} className="bg-cyan-950/30 text-cyan-400 font-bold px-3 py-1 rounded text-xs">
                                  {uLine.content}
                                </div>
                              );
                            }

                            const isAdd = uLine.type === 'add';
                            const isDel = uLine.type === 'del';

                            return (
                              <div
                                key={uIdx}
                                className={`flex items-start px-2 py-0.5 rounded-sm ${
                                  isAdd ? 'bg-emerald-950/25 text-emerald-300' :
                                  isDel ? 'bg-rose-950/25 text-rose-300' :
                                  'text-zinc-400'
                                }`}
                              >
                                <span className="w-10 text-zinc-600 select-none text-right pr-2">
                                  {uLine.oldNum || ''}
                                </span>
                                <span className="w-10 text-zinc-600 select-none text-right pr-3">
                                  {uLine.newNum || ''}
                                </span>
                                <span className="w-4 font-bold select-none">
                                  {isAdd ? '+' : isDel ? '-' : ' '}
                                </span>
                                <span className="flex-1 whitespace-pre">{uLine.content}</span>
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

        {/* Footer: Commit Action Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80">
          {committedHash ? (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} />
                <span>
                  Commit criado com sucesso no repositório! Hash: <strong className="font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-200">{committedHash}</strong>
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
              >
                Concluir
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
                  placeholder="Mensagem do Commit Git..."
                  className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-zinc-400 hover:text-white text-xs font-medium"
                  >
                    Fechar
                  </button>

                  <button
                    onClick={handleCommit}
                    disabled={committing || !commitMessage.trim()}
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
                        Subir Commit Automático
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
