# Frontend Components - Unit 3: Git Supervisor & Commit Approval

## 1. Overview
Este documento especifica os componentes visuais, interações de usuário e integração de eventos Socket.IO para o Cockpit do Hivemind, garantindo que o Human Supervisor tenha controle total e visual sobre o ciclo de commits.

---

## 2. Component Specifications

### 2.1 `CommitReviewCard` (Chat Timeline Integration)
Card inserido na timeline do chat (`MessagesView.tsx`) sempre que o agente ou o supervisor detecta código pronto para revisão.

- **Trigger de Exibição**: Evento Socket.IO `commit_review_requested`.
- **Layout & Estilização**:
  - Container Dark Glassmorphism com borda azul ciano / índigo (`border-cyan-500/30 bg-zinc-950/80 backdrop-blur-md`).
  - Ícone de Git Commit (`GitCommit` ou `GitPullRequest` de `lucide-react`).
  - Título: **"Modificações de Código Prontas para Revisão"**.
  - Metadados visuais:
    - Lista resumida dos arquivos tocados.
    - Badges de adições (`+N lines` em verde) e deleções (`-M lines` em vermelho).
    - Mensagem sugerida prévia no padrão Conventional Commits.
  - Ação Primária: Botão **"Inspecionar Git Diff & Comitar"** com efeito hover destacado, que abre o `GitDiffModal`.

---

### 2.2 `GitDiffModal` (Aprimoramentos de Governança)
O modal existente (`packages/web/src/components/GitDiffModal.tsx`) é enriquecido com controles completos de aprovação e rejeição resiliente:

1. **Banner de Violação de Segurança (Security Baseline)**:
   - Se `sensitiveFilesDetected.length > 0`:
     - Exibe banner vermelho no topo (`bg-red-950/50 border border-red-500/40 text-red-300`).
     - Alerta: *"Arquivos confidenciais ou segredos detectados (.env, .pem). O commit está bloqueado até a remoção destes arquivos."*
     - O botão de "Comitar Alterações" fica desabilitado (`disabled opacity-50 cursor-not-allowed`).
2. **Botão "Rejeitar Modificações" (Resiliency Baseline)**:
   - Adicionado botão secundário de rejeição (`border-red-500/30 text-red-400 hover:bg-red-950/30`).
   - Ao ser clicado, abre submodal ou diálogo inline de confirmação:
     - *"Tem certeza que deseja rejeitar? Uma branch de backup `backup/rejected-...` será criada automaticamente para preservar o código."*
   - Ao confirmar, dispara chamada `POST /api/projects/:projectId/git/reject`.
3. **Barra de Ações Aprimorada**:
   - Botão "Fechar".
   - Botão "Rejeitar Modificações".
   - Botão "Aprovar & Comitar" (com spinner de loading enquanto o Git CLI executa).

---

### 2.3 Header Quick-Action Indicator
No cabeçalho do projeto (`MessagesView.tsx` / `CockpitPanel`), um badge discreto de status do Git exibe se o repositório possui alterações não commitadas:
- Se houver alterações: Badge âmbar pulsante `● Git: N arquivos alterados`, clicável para abrir o `GitDiffModal` a qualquer momento.
- Se limpo: Indicador verde `● Git: Clean`.

---

## 3. Socket.IO Events & Client Handlers

| Evento | Direção | Payload | Ação no Cockpit |
| :--- | :--- | :--- | :--- |
| `commit_review_requested` | Server -> Client | `CommitApprovalRequest` | Renderiza `CommitReviewCard` no chat e atualiza o badge do header. |
| `commit_completed` | Server -> Client | `{ commitHash, message, filesCount }` | Fecha o modal, emite toast de sucesso verde e atualiza o status do Git para Clean. |
| `commit_rejected` | Server -> Client | `{ backupBranch, reason }` | Fecha o modal, emite toast informativo âmbar com o nome da branch de backup. |
| `git_status_changed` | Server -> Client | `{ hasChanges, count }` | Atualiza o contador de arquivos pendentes no header. |
