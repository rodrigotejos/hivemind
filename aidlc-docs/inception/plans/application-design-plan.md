# Application Design Plan

## Purpose
Modelar a arquitetura técnica de alto nível, os componentes de software, métodos, serviços orquestradores e matriz de dependências do ecossistema Hivemind com LangGraph, LangSmith, Bridge Daemon e Cockpit HITL.

---

## Execution Checklist

- [x] **Step 1: Identificação de Componentes & Responsabilidades**
  - [x] Mapear componentes do Backend (`@ai-dlc/server`), Frontend (`web`), SDK (`@ai-dlc/sdk`), Bridge Daemon e Skills (`.agent/skills/`)
  - [x] Gerar `aidlc-docs/inception/application-design/components.md`

- [x] **Step 2: Definição de Interfaces e Métodos**
  - [x] Especificar assinaturas tipadas, payloads de entrada/saída e contratos
  - [x] Gerar `aidlc-docs/inception/application-design/component-methods.md`

- [x] **Step 3: Definição da Camada de Serviços & Orquestração**
  - [x] Modelar o StateGraph do LangGraph, nó Supervisor, checkpointer SQLite, LangSmith tracer, Bridge Daemon e S3 Snapshot adapter
  - [x] Gerar `aidlc-docs/inception/application-design/services.md`

- [x] **Step 4: Mapeamento de Dependências e Padrões de Comunicação**
  - [x] Elaborar matriz de dependências e diagramas de fluxo de dados
  - [x] Gerar `aidlc-docs/inception/application-design/component-dependency.md`

- [x] **Step 5: Documento Consolidado de Design de Aplicação**
  - [x] Gerar `aidlc-docs/inception/application-design/application-design.md`

---

## Design Decisions Summary (Pre-Approved)

1. **State Machine Framework**: `@langchain/langgraph` com nós tipados (`Supervisor`, `AgentWorker`, `HumanGate`) e persistência via SQLite Checkpointer.
2. **Observability Stack**: `langsmith` SDK instrumentando nós, spans de LLM e execuções do `agy` CLI.
3. **Execution Runtime**: `child_process.spawn` gerenciado pelo `BridgeDaemon` com controle de concorrência, timeouts e circuit breaker.
4. **Human Interaction Pattern**: `interrupt()` nativo do LangGraph + endpoint REST `/api/projects/:id/resume` acionado pelo botão no React 19 Dashboard.
5. **Persistence & Backup**: SQLite transacional local (`better-sqlite3`) + adapter AWS S3 para snapshots criptografados (`@aws-sdk/client-s3`).
