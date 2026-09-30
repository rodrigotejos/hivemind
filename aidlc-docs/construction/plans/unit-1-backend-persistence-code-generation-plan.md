# Code Generation Plan: Unit 1 - Backend Persistence & 5-Phase Security Pipeline

## Unit Context & Stories
- **Unit Name**: `unit-1-backend-persistence-5-phase-pipeline`
- **Stories Covered**: US-9 (Persistência Real do Security Score no Banco), US-11 (Pipeline de 5 Fases Determinísticas & Live Ticker)
- **Target Package**: `packages/server`
- **Single Source of Truth**: Este documento é o plano executivo para a geração de código da Unit 1.

---

## Detailed Implementation Steps

- [x] **Step 1: Database Migration Scripts & Schema Update**
  - **Files**: `packages/server/src/db/connection.ts`, `packages/server/src/db/schema.sql`
  - **Action**: Adicionar auto-migração `ALTER TABLE projects ADD COLUMN security_score INTEGER DEFAULT NULL`, `ALTER TABLE projects ADD COLUMN security_rating TEXT DEFAULT NULL` e `ALTER TABLE projects ADD COLUMN last_security_audit_at DATETIME DEFAULT NULL`. Atualizar `initDb()` para calcular e sincronizar retroativamente os scores existentes se já houver findings para o projeto.
  - **Story**: US-9

- [x] **Step 2: Repository & Database Queries Layer**
  - **Files**: `packages/server/src/db/queries.ts`
  - **Action**: Criar funções `updateProjectSecurityScore(projectId, score, rating)` e atualizar `getProject(projectId)` para retornar os novos campos persistidos. Garantir que `getProjectSecuritySummary` atualize atômica e idempotentemente a tabela `projects`.
  - **Story**: US-9

- [x] **Step 3: 5-Phase Security Pipeline Service & Socket.IO Emission**
  - **Files**: `packages/server/src/services/security-pipeline.ts`, `packages/server/src/routes/security.ts`
  - **Action**: Criar o serviço `SecurityPipelineService` que executa as 5 fases determinísticas:
    1. `Mapeamento de Rotas, CORS & Headers` (fase 1/5)
    2. `Varredura Estrita de Segredos e .env` (fase 2/5)
    3. `Simulação Adversarial OWASP (Delta Red Team)` (fase 3/5)
    4. `Elaboração e Validação de Defesas (Beta Blue Team)` (fase 4/5)
    5. `Verificação Formal PBT & Persistência no SQLite` (fase 5/5)
    Emitir via `io.to("project_" + projectId).emit("security_phase_progress", payload)` a cada transição e atualizar o score persistido na conclusão.
  - **Story**: US-11

- [x] **Step 4: Unit Testing & Property-Based Testing (PBT)**
  - **Files**: `packages/server/tests/unit/security-persistence.test.ts`, `packages/server/tests/pbt/security-phase-invariants.test.ts`
  - **Action**:
    - Testes unitários para migração, persistência de score e transições de fase.
    - PBT com `fast-check` validando:
      - Invariante 1: Clamping do score entre $0$ e $100$ para qualquer número e severidade de findings arbitrários.
      - Invariante 2: Sequenciamento estritamente monotonicamente crescente das fases ($1 \to 2 \to 3 \to 4 \to 5$).
  - **Story**: US-9, US-11

- [x] **Step 5: TypeScript Compilation & Verification**
  - **Action**: Executar `npm run build -w @ai-dlc/server` e rodar suite de testes para garantir 100% de sucesso sem quebras.

- [x] **Step 6: Code Generation Documentation & Summary**
  - **Files**: `aidlc-docs/construction/unit-1-backend-persistence-5-phase-pipeline/code/unit-1-summary.md`
  - **Action**: Documentar os arquivos modificados, funções exportadas e cobertura de testes.
