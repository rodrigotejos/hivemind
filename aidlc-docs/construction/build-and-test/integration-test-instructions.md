# Integration Test Instructions: Hivemind AI-DLC (Iteration 3)

## Objetivo
Validar a integração ponta a ponta entre os componentes backend (`@ai-dlc/server`, Express, SQLite, Socket.IO) e o cliente frontend (`packages/web`, React 19, Vite).

---

## Cenários de Integração

### Cenário 1: Disparo de Auditoria Adversarial via REST & Streaming Socket.IO
- **Fluxo**:
  1. Frontend dispara `POST /api/projects/:projectId/security/scan`.
  2. Backend adquire trava de concorrência (`SecurityPipelineService.activeScans.add(projectId)`).
  3. Backend emite eventos sequenciais `security_phase_progress` (fases 1 a 5) pela sala `project:${projectId}` do Socket.IO.
  4. Frontend escuta os eventos e atualiza dinamicamente o **Stepper Visual de 5 Fases** e o **Mini-Ticker** com o agente ativo (`delta-security-red-team` / `beta-security-blue-team`), arquivo inspecionado e teste em andamento.
  5. Na Fase 5, backend atualiza SQLite atomicamente (`security_score`, `security_rating`, `last_security_audit_at`).
  6. Frontend recebe a conclusão e atualiza o badge do topo e o painel de auditoria.

### Cenário 2: Persistência Real de Score e Carga Imediata (Zero Flash de 100%)
- **Fluxo**:
  1. Frontend carrega a página `ProjectView` com `GET /api/projects/:projectId`.
  2. O backend responde com os campos persistidos (`security_score: 75`, `security_rating: 'B'`).
  3. O topo da página renderiza `75/100` imediatamente, eliminando o flash transitório de "100%".

### Cenário 3: Navegação de Abas e Busca na Wiki Técnica
- **Fluxo**:
  1. Usuário acessa a aba "Visão Geral & Wiki Técnica".
  2. Usuário digita termos na barra de busca (ex: `PBT`, `sqlite`).
  3. O componente executa `countMatches` e `highlightMatches`, destacando os termos com `<mark>` e atualizando a contagem dinâmica de resultados.
  4. O scrollbar customizado `.custom-scrollbar` permite rolagem fluida sem quebra de grid do cockpit.

---

## Verificação Manual em Ambiente Dev
1. Backend ativo em `http://localhost:3001` (porta verificada com CORS habilitado).
2. Frontend ativo em `http://localhost:5173`.
3. Acessar `http://localhost:5173/projects/travel_fun`.
4. Clicar no botão **"Disparar Auditoria Adversarial"** no Cockpit e acompanhar as 5 fases no stepper.
