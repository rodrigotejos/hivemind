# Functional Design Plan - Unit 3: Git Supervisor & Commit Approval

## Unit Context & Traceability
- **Unit Name**: `unit-3-git-supervisor`
- **Assigned Stories**:
  - `US-4`: Aprovação Interativa de Commit (Inspeção visual de Git Diff e aprovação humana direta no Cockpit)
- **Enforced Extensions**:
  - `Security Baseline`: Sanitização de mensagens de commit (prevenção de injection), verificação estrita de arquivos sensíveis (.env, credenciais) antes do commit.
  - `Resiliency Baseline`: Rollback gracioso e seguro em caso de rejeição de modificações, com preservação automática em branch de backup `backup/rejected-<timestamp>`.
  - `Property-Based Testing`: Invariantes para parsing de diffs, sanitização de mensagens e integridade do ciclo de aprovação/rejeição.
- **Status**: COMPLETED

---

## Detailed Design Steps

### [x] Step 1: Clarifying Questions & User Alignment
- Respostas registradas e alinhadas:
  - 1:A (Salvar em branch de backup temporária `backup/rejected-<timestamp>` antes de reverter com `git reset --hard HEAD` e `git clean -fd`).
  - 2:A (Card interativo no chat "📦 Modificações prontas para revisão" + badge de status do Git no header).
  - 3:A (Sugestão semântica Conventional Commits gerada pelo supervisor e editável pelo usuário).
  - 4:A (Bloqueio rígido no backend contra arquivos sensíveis como `.env`, `.pem` ou credenciais).

### [x] Step 2: Domain Entities Design (`domain-entities.md`)
- Entidades definidas em `aidlc-docs/construction/unit-3-git-supervisor/functional-design/domain-entities.md`:
  - `CommitApprovalRequest`, `ChangedFileSummary`, `CommitDecision`, `CommitExecutionResult`, `SensitiveFileRule`.

### [x] Step 3: Business Logic Model (`business-logic-model.md`)
- Modelagem dos fluxos em `aidlc-docs/construction/unit-3-git-supervisor/functional-design/business-logic-model.md`:
  - Workflow 1: Inspeção de modificações, extração segura do diff e verificação de arquivos sensíveis.
  - Workflow 2: Aprovação humana e execução segura de commit via `execFile` com argumentos atômicos.
  - Workflow 3: Rejeição resiliente com criação de branch de backup e limpeza de working tree.

### [x] Step 4: Business Rules & Validation Constraints (`business-rules.md`)
- Regras especificadas em `aidlc-docs/construction/unit-3-git-supervisor/functional-design/business-rules.md`:
  - `BR-GIT-01`: Diff não vazio.
  - `BR-GIT-02`: Prevenção de shell command injection (uso estrito de `execFile`).
  - `BR-GIT-03`: Bloqueio imediato de arquivos sensíveis (.env, .pem, .key).
  - `BR-GIT-04`: Backup obrigatório antes de descarte em rejeição.
  - `BR-GIT-05`: Padrão Conventional Commits na sugestão de commit.
  - `BR-GIT-06`: Auditoria obrigatória de aprovação e rejeição.

### [x] Step 5: Frontend Components Design (`frontend-components.md`)
- Especificação em `aidlc-docs/construction/unit-3-git-supervisor/functional-design/frontend-components.md`:
  - `CommitReviewCard` no chat da tarefa.
  - `GitDiffModal` enriquecido com botão "Rejeitar Modificações" com modal de confirmação e banner de arquivos bloqueados.
  - Quick-action badge no header do Cockpit.
  - Mapeamento de eventos Socket.IO.
