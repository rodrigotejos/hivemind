# Functional Design Plan - Unit 1: Backend SQLite Schema (`security_runs`), Service Persistence & Lockout

## Context & Stories
- **Unit**: Unit 1 (Backend SQLite Schema, Service Persistence & Lockout)
- **Stories**: US-13 (Persistência em `security_runs`), US-14 (Resiliência pós-refresh), US-15 (Bloqueio Concorrente por Banco)
- **Target Package**: `packages/server`

---

## Detailed Plan Steps
- [x] **Step 1: Domain Entities (`domain-entities.md`)**:
  - Especificar a entidade de domínio `SecurityRun` com seus campos no SQLite, estados do ciclo de vida (`running`, `completed`, `failed`), relacionamentos e auto-migração.
- [x] **Step 2: Business Rules (`business-rules.md`)**:
  - Definir regras de idempotência (BR-01), progressão atômica de fases (BR-02), bloqueio concorrente com HTTP 409 (BR-03) e sincronização com `security_score` do projeto (BR-04).
- [x] **Step 3: Business Logic Model (`business-logic-model.md`)**:
  - Modelar o fluxo de execução do `SecurityPipelineService`, diagramas de sequência, novos métodos em `queries.ts` e assinaturas dos endpoints REST (`GET /run-status`, `POST /scan`).
- [ ] **Step 4: Formal Review & Approval Gate**:
  - Apresentar o design funcional para aprovação e transição para o Code Generation da Unit 1.
