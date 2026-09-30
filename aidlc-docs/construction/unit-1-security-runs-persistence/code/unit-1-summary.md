# Unit 1 Code Summary: Backend SQLite Schema (`security_runs`), Service Persistence & Lockout

## Resumo da Implementação
A Unit 1 da Iteração 4 implementou a infraestrutura backend e o modelo de dados para persistência do ciclo de vida das auditorias de segurança, atendendo às User Stories **US-13, US-14 e US-15**:

1. **Esquema de Dados & Auto-Migração SQLite (`security_runs`)**:
   - [`packages/server/src/db/schema.sql`](file:///e:/code/hivemind/packages/server/src/db/schema.sql): Tabela `security_runs` adicionada com chaves estrangeiras e índices em `(project_id, status)` e `(project_id, started_at DESC)`.
   - [`packages/server/src/db/connection.ts`](file:///e:/code/hivemind/packages/server/src/db/connection.ts): Auto-migração idempotente executada no `initDb()` para garantir retrocompatibilidade imediata com instâncias existentes do SQLite.

2. **Queries Especializadas no `queries.ts`**:
   - `createSecurityRun`: Registra a inicialização de uma auditoria com `run_id` determinístico e status `'running'`.
   - `updateSecurityRunProgress`: Atualiza síncrona e progressivamente as fases $1..5$, agente ativo, arquivo sob inspeção e status.
   - `getLatestSecurityRun`: Recupera o run mais recente (ativo ou concluído) para re-hidratação de tela em caso de refresh (F5).
   - `getActiveSecurityRun`: Identifica se há algum scan em andamento (`status = 'running'`).

3. **Evolução do `SecurityPipelineService`**:
   - Geração de `run_id`: `run_sec_<timestamp>_<hash>`.
   - Escrita síncrona no SQLite a cada etapa antes de emitir o evento Socket.IO `security_phase_progress`.
   - Delay padrão de inspeção ajustado para 2.000ms por etapa (~10s no total) para proporcionar visibilidade técnica real das checagens do ticker.
   - Conclusão na Fase 5 com persistência atômica tanto em `security_runs` quanto na tabela `projects`.

4. **Endpoints REST da API de Segurança**:
   - `GET /api/projects/:projectId/security/run-status`: Retorna `{ success: true, isRunning, latestRun }`.
   - `POST /api/projects/:projectId/security/scan`: Protegido contra concorrência; se houver scan em andamento, retorna estritamente `HTTP 409 Conflict` com `{ error: 'SCAN_ALREADY_RUNNING', activeRun }`.

5. **Testes & Invariantes**:
   - Testes Unitários: 5/5 testes aprovados em [`security-runs-persistence.test.ts`](file:///e:/code/hivemind/packages/server/tests/unit/security-runs-persistence.test.ts).
   - Testes PBT com `fast-check`: 3 invariantes (700 runs) aprovadas em [`security-runs-invariants.test.ts`](file:///e:/code/hivemind/packages/server/tests/pbt/security-runs-invariants.test.ts).
   - Compilação: `@ai-dlc/server` compilado com 0 erros via `tsc`.
