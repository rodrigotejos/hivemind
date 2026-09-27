# Code Generation Plan - Unit 2: Cockpit Streaming & Auto-Recovery UI

## Unit Context & Traceability
- **Unit Name**: `unit-2-cockpit-streaming`
- **Assigned Stories**:
  - `US-1`: Feedback de Raciocínio (Agent Thinking & Typing em Real-time)
  - `US-2`: Notificação Não-Intrusiva de Retentativa (Auto-Recovery Toasts com Backoff)
  - `US-3`: Falha Crítica Pós-Retentativas com Pausa no Grafo e Intervenção Humana
- **Enforced Extensions**:
  - `Resiliency Baseline`: Adaptive Backoff com checagem de Retry-After e Jitter ±15%, teto de 60s e max 5 tentativas
  - `Property-Based Testing`: Testes com fast-check validando 4 invariantes da Unit 2
- **Status**: COMPLETED

---

## Detailed Generation Sequence

### [x] Step 1: Backend Adaptive Backoff & StreamChat Implementation (US-1, US-2, US-3)
- **Target File**: `packages/server/src/services/ai-manager.ts` (Modified in-place)
- **Details**:
  - Implementado `classifyLLMError(error: any): { type: string; baseDelayMs: number; retryAfterMs?: number }`.
  - Implementado `executeWithAdaptiveBackoff<T>(operation, context, maxAttempts = 5): Promise<T>` emitindo eventos `agent_recovery` (`retrying`, `recovered`, `exhausted`) via Socket.IO.
  - Implementado `streamChat(prompt, model, onChunk): AsyncGenerator<string>` para emissão de deltas.

### [x] Step 2: LangGraph Worker Streaming & Interrupt Integration (US-1, US-3)
- **Target File**: `packages/server/src/services/langgraph/nodes.ts` (Modified in-place)
- **Details**:
  - Integrado `streamChat` e `executeWithAdaptiveBackoff` na execução do fallback Gemini dentro de `createAgentWorkerNode`.
  - Emitido evento `agent_typing` para cada chunk recebido.
  - Se todas as retentativas falharem (`exhausted`), pausar com `status: 'waiting_human'` e payload de `human_gate`.

### [x] Step 3: Frontend RecoveryToast Component (US-2, US-3)
- **Target File**: `packages/web/src/components/RecoveryToast.tsx` (Created)
- **Details**:
  - Componente React com container flutuante (`fixed top-4 right-4 z-50`).
  - Dark glassmorphism (`bg-zinc-950/95 border border-amber-500/30 backdrop-blur-xl`).
  - Barra de progresso regressiva do timer de retry.
  - Feedback visual de recuperação (`recovered`) em verde esmeralda e auto-dismiss.

### [x] Step 4: Frontend MessagesView & CockpitPanel Integration (US-1, US-2)
- **Target File**: `packages/web/src/pages/MessagesView.tsx` (Modified in-place)
- **Details**:
  - Adicionado listener para o evento `agent_recovery` e gerenciamento de pilha de `recoveryToasts`.
  - Renderizada stack de `RecoveryToast` no topo direito.
  - Aperfeiçoado o balão de mensagem em streaming com cursor pulsante `▋` (`animate-pulse text-indigo-400 font-mono`) e badge "Digitando...".
  - Transição suave na conclusão da mensagem.

### [x] Step 5: Unit Tests Generation
- **Target File**: `packages/server/tests/unit/adaptive-backoff.test.ts` (Created)
- **Details**: Testes unitários para classificação de erros (429 vs 503 vs retry-after), cálculo de delay e eventos emitidos.

### [x] Step 6: Property-Based Testing Generation (PBT Baseline)
- **Target File**: `packages/server/tests/pbt/unit-2-invariants.test.ts` (Created)
- **Details**: Testes com `fast-check` verificando:
  - `PBT-U2-01`: Monotonicidade e teto máximo de 60s do backoff.
  - `PBT-U2-02`: Limites rigorosos do Jitter (sempre entre 85% e 115% do delay nominal).
  - `PBT-U2-03`: Integridade de concatenação do streaming de deltas.
  - `PBT-U2-04`: Teto estrito de no máximo 5 tentativas antes de falha crítica.

### [x] Step 7: Documentation Summary
- **Target File**: `aidlc-docs/construction/unit-2-cockpit-streaming/code/unit-2-code-summary.md` (Created)
- **Details**: Resumo técnico das alterações e rastreabilidade para as histórias US-1 a US-3.
