# Code Generation Plan - Unit 1: Infraestrutura de LLM & Segurança

## Unit Context & Traceability
- **Unit Name**: `unit-1-llm-infra-security`
- **Assigned Stories**:
  - `US-5`: Structured Output e Prevenção de Injeção
  - `US-6`: Sliding Window de Tokens & Sumarização Recursiva
  - `US-7`: Desacoplamento de Prompts em JSON com Hot-Reload
  - `US-8`: Resiliência Assíncrona e Heartbeat Lease no Daemon
- **Enforced Extensions**:
  - `Security Baseline`: Schemas Zod, eliminação de regex para JSON, sanitização de interpolação
  - `Resiliency Baseline`: Reflection loop de 2 tentativas em schema inválido, lease de 60s com grace period SIGTERM/SIGKILL
  - `Property-Based Testing`: Testes com fast-check validando 4 propriedades invariantes

---

## Detailed Generation Sequence

### Step 1: Prompt Registry Implementation (US-7)
- **Target File**: `packages/server/src/services/prompt-registry.ts` (Create)
- **Prompt Files**: `packages/server/prompts/*.json` (Create canonical prompts: `supervisor.json`, `triage.json`, `alpha_frontend.json`, `beta_backend.json`, `gamma_qa.json`, `delta_security.json`, `epsilon_infra.json`)
- **Details**: Implementar `PromptRegistry` singleton que lê os JSONs, realiza validação via Zod `PromptDefinitionSchema`, checa `mtime` para hot-reload transparente, e sanitiza interpolação de `${var}`.

### Step 2: Structured Output & Sliding Window in AIManager (US-5, US-6)
- **Target File**: `packages/server/src/services/ai-manager.ts` (Modify in-place)
- **Details**:
  - Implementar método genérico `generateStructuredOutput<T>(schema: z.ZodSchema<T>, promptKey: string, params: Record<string, any>): Promise<T>` com Reflection Loop (até 2 tentativas enviando erro do Zod para autocorreção pela LLM).
  - Atualizar `analyzeMessagePriority` para usar `generateStructuredOutput` com `MessagePrioritySchema`.
  - Implementar `calculateTokenWindow` com Sliding Window e sumarização recursiva (preserva sistema + âncora condensada + últimas N mensagens que caibam no token budget).
  - Integrar com `PromptRegistry` para carregar templates sem strings literais hardcoded.

### Step 3: LangGraph Nodes Refactoring (US-7)
- **Target File**: `packages/server/src/services/langgraph/nodes.ts` (Modify in-place)
- **Details**: Remover strings hardcoded de prompts para supervisor e agentes operacionais (`alpha_frontend`, `beta_backend`, `gamma_qa`, `delta_security`, `epsilon_infra`), substituindo por chamadas a `promptRegistry.renderPrompt(role, vars)`.

### Step 4: Heartbeat Lease Manager in Bridge Daemon (US-8)
- **Target File**: `packages/server/src/services/heartbeat-lease-manager.ts` (Create)
- **Target File**: `packages/server/src/services/bridge-daemon.ts` (Modify in-place)
- **Details**:
  - Criar `HeartbeatLeaseManager` gerenciando leases com timeout de 60s, polling de checagem a cada 5s, e fluxo de cancelamento gracioso (`SIGTERM` -> 5s grace period -> `SIGKILL`).
  - Atualizar o `BridgeDaemon` para substituir o timeout estático de 300000ms pela renovação de leases baseada em heartbeats do subprocesso.

### Step 5: Unit Tests Generation
- **Target Files**:
  - `packages/server/tests/unit/prompt-registry.test.ts` (Create)
  - `packages/server/tests/unit/sliding-window.test.ts` (Create)
  - `packages/server/tests/unit/structured-output.test.ts` (Create)
  - `packages/server/tests/unit/heartbeat-lease-manager.test.ts` (Create)
- **Details**: Testes unitários com Jest/Vitest cobrindo cenários nominais e de erro.

### Step 6: Property-Based Testing Generation (PBT Baseline)
- **Target File**: `packages/server/tests/pbt/unit-1-invariants.test.ts` (Create)
- **Details**: Testes com `fast-check` verificando:
  - `PBT-U1-01`: Token budget nunca é excedido independentemente do número de mensagens geradas aleatoriamente.
  - `PBT-U1-02`: Conformance rigorosa ao schema Zod do output estruturado.
  - `PBT-U1-03`: Integridade de interpolação e ausência de injeção em templates.
  - `PBT-U1-04`: Monotonicidade da expiração do lease de heartbeat.

### Step 7: Documentation Summary
- **Target File**: `aidlc-docs/construction/unit-1-llm-infra-security/code/unit-1-code-summary.md` (Create)
- **Details**: Resumo técnico das alterações e rastreabilidade para as histórias US-5 a US-8.

