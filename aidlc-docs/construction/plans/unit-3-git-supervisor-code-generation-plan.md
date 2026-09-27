# Code Generation Plan - Unit 3: Git Supervisor & Commit Approval

## Unit Context & Traceability
- **Unit Name**: `unit-3-git-supervisor`
- **Assigned Stories**:
  - `US-4`: Aprovação Interativa de Commit (Inspeção visual de Git Diff e aprovação humana direta no Cockpit)
- **Enforced Extensions**:
  - `Security Baseline`: Prevenção de shell command injection com uso estrito de `execFile`, bloqueio rígido de arquivos sensíveis (.env, .pem, credenciais).
  - `Resiliency Baseline`: Rejeição com preservação resiliente via branch de backup `backup/rejected-<timestamp>`.
  - `Property-Based Testing`: Testes procedurais com fast-check validando 4 invariantes da Unit 3.
- **Status**: COMPLETED

---

## Detailed Generation Sequence

### [x] Step 1: Backend GitSupervisor Service Implementation (US-4, Security & Resiliency)
- **Target File**: `packages/server/src/services/git-supervisor.ts` (Created)
- **Details**:
  - Implementada classe `GitSupervisor` encapsulando operações do Git CLI.
  - Implementado `checkSensitiveFiles(files: string[])` contra padrões proibidos (`.env*`, `*.pem`, `*.key`, `id_rsa*`, etc.).
  - Implementado `generateSuggestedCommitMessage(taskTitle?, files?)` seguindo o formato Conventional Commits.
  - Implementado `commitChanges(workingDir, message, operator)` invocando `execFile('git', ['commit', '-m', message])` de forma atômica e segura.
  - Implementado `rejectChanges(workingDir, reason, operator)` criando branch `backup/rejected-<timestamp>`, commitando o backup e executando `git reset --hard HEAD && git clean -fd`.

### [x] Step 2: Backend Git Routes Enhancement (US-4)
- **Target File**: `packages/server/src/routes/git.ts` (Modified in-place)
- **Details**:
  - Integrado `GitSupervisor` nos endpoints existentes.
  - Atualizado `GET /api/projects/:projectId/git/diff` para incluir verificação de arquivos sensíveis e sugestão de commit.
  - Atualizado `POST /api/projects/:projectId/git/commit` para aplicar bloqueio de segurança em caso de arquivos sensíveis e emitir evento Socket.IO `commit_completed`.
  - Adicionado `POST /api/projects/:projectId/git/reject` executando a rejeição resiliente e emitindo evento Socket.IO `commit_rejected`.
  - Adicionado `POST /api/projects/:projectId/git/review-request` para emissão de `commit_review_requested`.

### [x] Step 3: Frontend GitDiffModal Enhancement (US-4, Resiliency & UX)
- **Target File**: `packages/web/src/components/GitDiffModal.tsx` (Modified in-place)
- **Details**:
  - Adicionado botão "Rejeitar Modificações" com modal de confirmação explicativo do backup branch.
  - Adicionado banner de segurança vermelho no topo caso arquivos sensíveis sejam detectados, desabilitando o botão de commit.
  - Campo de mensagem de commit com suporte à sugestão automática e edição livre.
  - Feedback visual de conclusão de commit e backup salvo.

### [x] Step 4: Frontend Cockpit Integration (US-4)
- **Target File**: `packages/web/src/pages/MessagesView.tsx` (Modified in-place)
- **Details**:
  - Adicionados listeners Socket.IO para `commit_review_requested`, `commit_completed`, `commit_rejected`, `git_status_changed`.
  - Renderizado `CommitReviewCard` na timeline de mensagens quando código pronto para revisão for detectado.
  - Adicionado badge indicador de status do Git no header do Cockpit com contagem de arquivos pendentes e quick-action.

### [x] Step 5: Unit Tests Generation
- **Target File**: `packages/server/tests/unit/git-supervisor.test.ts` (Created)
- **Details**: 6 testes unitários para detecção de arquivos sensíveis, formatação de Conventional Commits, execução de commit seguro e rollback com backup branch (6/6 aprovados).

### [x] Step 6: Property-Based Testing Generation (PBT Baseline)
- **Target File**: `packages/server/tests/pbt/unit-3-invariants.test.ts` (Created)
- **Details**: 4 testes de invariantes com `fast-check` verificando:
  - `PBT-U3-01`: Detecção 100% confiável de arquivos sensíveis sob caminhos arbitrários (100 runs).
  - `PBT-U3-02`: Não-bloqueio de arquivos seguros arbitrários (100 runs).
  - `PBT-U3-03`: Conformidade do formato da sugestão de Conventional Commits (100 runs).
  - `PBT-U3-04`: Invariante de integridade da ref da branch de backup (50 runs).

### [x] Step 7: Documentation Summary
- **Target File**: `aidlc-docs/construction/unit-3-git-supervisor/code/unit-3-code-summary.md` (Created)
- **Details**: Resumo técnico da implementação e rastreabilidade para a história US-4.
