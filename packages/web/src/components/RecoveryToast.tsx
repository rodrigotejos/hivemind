import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';

export interface RecoveryToastItem {
  id: string;
  agentId: string;
  agentRole: string;
  status: 'retrying' | 'recovered' | 'exhausted';
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  errorMessage?: string;
  timestamp: number;
}

interface RecoveryToastProps {
  toasts: RecoveryToastItem[];
  onDismiss: (id: string) => void;
}

export default function RecoveryToast({ toasts, onDismiss }: RecoveryToastProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <SingleToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function SingleToast({ toast, onDismiss }: { toast: RecoveryToastItem; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast.status === 'retrying' && toast.delayMs > 0) {
      setProgress(100);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / toast.delayMs) * 100);
        setProgress(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [toast.id, toast.status, toast.delayMs]);

  const isRecovered = toast.status === 'recovered';
  const isExhausted = toast.status === 'exhausted';

  const borderColor = isRecovered
    ? 'border-emerald-500/50'
    : isExhausted
    ? 'border-rose-500/50'
    : 'border-amber-500/40';

  const bgColor = isRecovered
    ? 'bg-zinc-950/95 border-emerald-500/30'
    : isExhausted
    ? 'bg-zinc-950/95 border-rose-500/30'
    : 'bg-zinc-950/95 border-amber-500/30';

  return (
    <div
      className={`pointer-events-auto w-full p-4 rounded-xl border ${borderColor} ${bgColor} shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isRecovered ? (
            <CheckCircle className="text-emerald-400 shrink-0" size={18} />
          ) : isExhausted ? (
            <AlertCircle className="text-rose-400 shrink-0 animate-bounce" size={18} />
          ) : (
            <RefreshCw className="text-amber-400 shrink-0 animate-spin" size={18} />
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white capitalize">
                {toast.agentId.replace(/[-_]/g, ' ')}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isRecovered
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isExhausted
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {isRecovered
                  ? 'Recuperado'
                  : isExhausted
                  ? 'Esgotado'
                  : `Retry ${toast.attempt}/${toast.maxAttempts}`}
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-1 line-clamp-2">
              {isRecovered
                ? 'Conexão com a LLM restabelecida com sucesso!'
                : isExhausted
                ? 'Todas as retentativas falharam. Intervenção humana necessária.'
                : toast.errorMessage || 'Rate limit / Timeout transitório. Retentando em instantes...'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {toast.status === 'retrying' && (
        <div className="mt-3 w-full bg-zinc-800/80 rounded-full h-1 overflow-hidden">
          <div
            className="bg-amber-400 h-full transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
