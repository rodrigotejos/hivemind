# Units of Work Specification: Hivemind Autonomous Multi-Agent Platform

## Overview
O sistema é decomposto em **6 Unidades de Trabalho (Units of Work)** independentes e testáveis, cobrindo o ciclo completo da plataforma.

---

### Unit 1: SDK Models & Specialized Skills Catalog
- **Identificador**: `UOW-01`
- **Pacotes / Diretórios**: `packages/sdk/`, `.agent/skills/`
- **Escopo**:
  - Atualização dos tipos TypeScript em `@ai-dlc/sdk` (`AgentGraphState`, `InterruptPayload`, `CLISpanPayload`, `SnapshotMetadata`).
  - Criação do catálogo completo de 7 skills em `.agent/skills/` (`frontend-engineer`, `backend-engineer`, `ui-figma-reader`, `doc-researcher`, `qa-engineer`, `security-adversarial`, `infra-devops`).
- **Critérios de Conclusão**: Tipagens exportadas e suíte de skills testada e validada.

---

### Unit 2: LangGraph State Machine & Supervisor Orchestrator
- **Identificador**: `UOW-02`
- **Pacotes / Diretórios**: `packages/server/src/services/langgraph/`, `packages/server/src/routes/`
- **Escopo**:
  - Implementação do grafo de estados com `@langchain/langgraph`.
  - Supervisor Node com avaliação de intenção, anti-loop (teto de 5 turnos) e convergência (`task_done`).
  - Checkpointer SQLite para persistência síncrona e mecanismo de interrupção (`interrupt()`).
  - Endpoints `/api/projects/:id/interrupt` e `/api/projects/:id/resume`.
- **Critérios de Conclusão**: Grafo cicla e transiciona estados com persistência no SQLite e pausa/retomada funcionais.

---

### Unit 3: Antigravity Bridge Daemon & Subprocess Execution
- **Identificador**: `UOW-03`
- **Pacotes / Diretórios**: `packages/server/src/services/bridge/`, `packages/server/src/routes/`
- **Escopo**:
  - Bridge Daemon escutando eventos de mensagens via Socket.IO/REST.
  - Subprocess runner com `child_process.spawn` invocando `agy -p "<prompt>" --continue --agent <role> --dangerously-skip-permissions`.
  - Fila assíncrona com controle de concorrência e circuit breaker contra travamentos/timeouts.
- **Critérios de Conclusão**: Subprocessos do `agy` disparam de forma isolada e postam respostas de volta ao Hivemind.

---

### Unit 4: LangSmith Observability & Token Telemetry Service
- **Identificador**: `UOW-04`
- **Pacotes / Diretórios**: `packages/server/src/services/telemetry/`, `packages/server/src/routes/telemetry.ts`
- **Escopo**:
  - Instrumentação com `langsmith` SDK para nós do grafo, chamadas de LLM e spans de subprocessos `agy`.
  - Agregação de custos e tokens consumidos por agente e por projeto.
  - Endpoint `/api/projects/:id/telemetry`.
- **Critérios de Conclusão**: Traces e métricas de tokens geradas e acessíveis via API.

---

### Unit 5: Project Auto-Setup & Cloud S3 Snapshot Resilience
- **Identificador**: `UOW-05`
- **Pacotes / Diretórios**: `packages/server/src/services/setup/`, `packages/server/src/services/backup/`, `packages/server/src/routes/`
- **Escopo**:
  - Assistente de onboarding automatizado para projetos (geração de `.aidlc/`, `.agent/rules/`, `AGENTS.md` e MCP `codebase-memory`).
  - Mecanismo de compactação, criptografia AES-256 e upload/download de snapshots para Amazon S3.
  - Endpoints `/api/projects/:id/setup` e `/api/projects/:id/snapshots`.
- **Critérios de Conclusão**: Repositórios configuram com 1 clique e snapshots exportam/restauram com RPO = 0.

---

### Unit 6: Cockpit HITL Web Dashboard & Live Telemetry UI
- **Identificador**: `UOW-06`
- **Pacotes / Diretórios**: `packages/web/src/components/cockpit/`, `packages/web/src/components/chat/`, `packages/web/src/components/telemetry/`
- **Escopo**:
  - Painel de controle no React 19 com botões **Pausar Loop**, **Retomar Loop** e **Intervir**.
  - Cards interativos de aprovação de `interrupt()` e resolução de `blocker` em 1 clique.
  - Live feed de mensagens com badges de especialistas e visualizador de telemetria/tokens.
- **Critérios de Conclusão**: Interface fluida, responsiva e interativa consumindo eventos em tempo real via Socket.IO.
