# Code Generation Plan: Unit 1 - Backend SQLite Schema (`security_runs`), Service Persistence & Lockout

## Unit Context & Stories
- **Unit Name**: `unit-1-security-runs-persistence`
- **Stories Covered**: US-13 (Persistência em `security_runs`), US-14 (Resiliência pós-refresh), US-15 (Bloqueio Concorrente por Banco)
- **Target Package**: `packages/server`
- **Single Source of Truth**: Este documento é o plano executivo para a geração de código da Unit 1.

---

## Detailed Implementation Steps

- [x] **Step 1: Database Schema & Auto-Migration**
  - **Files**: `packages/server/src/db/schema.sql`, `packages/server/src/db/connection.ts`
  - **Action**:
    - Declarar a tabela `security_runs` e índices no `schema.sql`.
    - Implementar auto-migração no `connection.ts` com `CREATE TABLE IF NOT EXISTS security_runs` e índices para garantir retrocompatibilidade imediata com bancos existentes.
  - **Story**: US-13

- [x] **Step 2: Database Queries Implementation**
  - **Files**: `packages/server/src/db/queries.ts`
  - **Action**:
    - Exportar a interface TypeScript `SecurityRun`.
    - Implementar `createSecurityRun`, `updateSecurityRunProgress`, `getLatestSecurityRun` e `getActiveSecurityRun`.
  - **Story**: US-13, US-14

- [x] **Step 3: SecurityPipelineService Evolution with `run_id` & Realistic Timing**
  - **Files**: `packages/server/src/services/security-pipeline.ts`
  - **Action**:
    - Gerar `run_id` único para cada execução (`run_sec_<timestamp>_<hash>`).
    - Gravar síncronamente no SQLite a cada fase ($1 \rightarrow 2 \rightarrow 3 \rightarrow 4 \rightarrow 5$) antes de emitir o evento Socket.IO.
    - Ajustar o delay padrão de inspeção para 2.000ms por etapa para proporcionar visibilidade técnica real do ticker.
    - Em caso de exceção, marcar `status = 'failed'` no banco e liberar a trava.
  - **Story**: US-13, US-15

- [x] **Step 4: REST Routes Implementation**
  - **Files**: `packages/server/src/routes/security.ts`
  - **Action**:
    - Implementar endpoint `GET /api/projects/:projectId/security/run-status`.
    - Evoluir `POST /api/projects/:projectId/security/scan` com checagem de scan ativo no banco e retorno de `HTTP 409 Conflict` em caso de concorrência.
  - **Story**: US-14, US-15

- [x] **Step 5: Unit Tests & Property-Based Testing (PBT)**
  - **Files**:
    - `packages/server/tests/unit/security-runs-persistence.test.ts`
    - `packages/server/tests/pbt/security-runs-invariants.test.ts`
  - **Action**:
    - Validar ciclo de vida completo de `security_runs`, bloqueio de concorrência 409 e recuperação do último status.
    - PBT com `fast-check`: testar invariantes de máquina de estados, limitação de fases $1..5$ e unicidade de run ativo.
  - **Story**: US-13, US-14, US-15

- [x] **Step 6: Backend Build & Summary Documentation**
  - **Files**: `aidlc-docs/construction/unit-1-security-runs-persistence/code/unit-1-summary.md`
  - **Action**:
    - Executar compilação TypeScript com `npm run build -w @ai-dlc/server`.
    - Documentar todos os métodos e alterações gerados na Unit 1.
