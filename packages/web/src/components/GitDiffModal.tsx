import { useState } from 'react';
import { Terminal, CheckCircle, RefreshCw, X, Send } from 'lucide-react';

interface GitDiffModalProps {
  projectId: string;
  apiUrl: string;
  diff: string;
  suggestedCommitMessage?: string;
  onClose: () => void;
  onCommitSuccess?: (commitHash: string) => void;
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
  const [committing, setCommitting] = useState(false);
  const [committedHash, setCommittedHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Terminal size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Revisão de Alterações no Repositório (Git Diff)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Linhas adicionadas (<span className="text-emerald-400 font-mono">+</span>) e removidas (<span className="text-rose-400 font-mono">-</span>) pelas correções dos agentes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Diff View Box */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-black/40">
          {diff ? (
            <div className="space-y-0.5">
              {diff.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                const isDel = line.startsWith('-') && !line.startsWith('---');
                const isHeader = line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++');
                const isHunk = line.startsWith('@@');

                let lineClass = 'text-zinc-400';
                if (isAdd) lineClass = 'text-emerald-400 bg-emerald-950/20 px-1 rounded-sm block';
                else if (isDel) lineClass = 'text-rose-400 bg-rose-950/20 px-1 rounded-sm block';
                else if (isHeader) lineClass = 'text-indigo-300 font-bold border-t border-zinc-900 pt-2 block';
                else if (isHunk) lineClass = 'text-cyan-400 font-semibold bg-cyan-950/20 px-1 block';

                return (
                  <div key={idx} className={lineClass}>
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              Nenhuma alteração detectada no git diff.
            </div>
          )}
        </div>

        {/* Commit Action Box */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/70 space-y-3">
          {committedHash ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} />
                <span>Commit realizado com sucesso! Hash: <strong className="font-mono">{committedHash}</strong></span>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Concluir
              </button>
            </div>
          ) : (
            <>
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
                  className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-zinc-400 hover:text-white text-xs font-medium"
                  >
                    Cancelar
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
