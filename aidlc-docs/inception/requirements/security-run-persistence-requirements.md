# Requirements Specification: Iteration 4 - Persistent Security Run State & Universal Stepper

## 1. Executive Summary & Intent Analysis
- **User Intent**: Garantir resiliência absoluta e persistência do pipeline de segurança no banco de dados SQLite. Se o usuário recarregar a página (F5), mudar de rota ou trocar de aba, o estado do pipeline (qual fase está, ID da execução, agente ativo, arquivo sob inspeção) deve ser carregado diretamente do SQLite. Além disso, se houver um scan ativo, deve ser estritamente bloqueada nova execução simultânea (idempotência no DB), e o Stepper visual de 5 fases deve estar disponível tanto no `SecurityAuditPanel` quanto no `CockpitPanel` sem perda de dados dos agentes.
- **Project Scope**: Monorepo Hivemind AI-DLC (`@ai-dlc/server` e `web`).

---

## 2. Functional Requirements (FR)

### FR-01: Tabela `security_runs` no SQLite & Auto-Migração
- O banco de dados deve criar a tabela `security_runs` com os campos:
  - `id TEXT PRIMARY KEY`: Identificador único da execução (ex: `sec_run_<timestamp>_<uuid/random>`).
  - `project_id TEXT NOT NULL`: Chave estrangeira referenciando o projeto.
  - `phase INTEGER NOT NULL`: Fase atual ($1..5$, ou $0$ em falha).
  - `total_phases INTEGER NOT NULL DEFAULT 5`: Total de fases.
  - `phase_name TEXT NOT NULL`: Nome legível da etapa.
  - `status TEXT NOT NULL`: `'running' | 'completed' | 'failed'`.
  - `agent_role TEXT NOT NULL`: Papel do agente ativo (`delta-security`, `beta-backend`, `system`).
  - `agent_name TEXT NOT NULL`: Nome legível do agente.
  - `current_check TEXT`: Descrição da verificação técnica em andamento.
  - `target_file TEXT`: Arquivo inspecionado no momento.
  - `findings_count INTEGER DEFAULT 0`: Quantidade de achados computados até a fase.
  - `score INTEGER DEFAULT NULL`: Score parcial ou final.
  - `started_at DATETIME DEFAULT CURRENT_TIMESTAMP`: Data de início.
  - `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`: Data da última transição de fase.
  - `completed_at DATETIME DEFAULT NULL`: Data de conclusão.

### FR-02: Registro e Atualização Contínua no `SecurityPipelineService`
- Ao iniciar uma auditoria, o serviço gera um novo `run_id`, persiste o registro inicial (`phase: 1, status: 'running'`) e associa ao `activeScans`.
- A cada transição de fase ($1 \rightarrow 2 \rightarrow 3 \rightarrow 4 \rightarrow 5$), o serviço atualiza a linha daquele `run_id` no SQLite (`queries.updateSecurityRunProgress(...)`).
- Na Fase 5, atualiza `status: 'completed'`, `completed_at: CURRENT_TIMESTAMP` e persiste o score na tabela `projects`.
- Em caso de exceção, marca `status: 'failed'` com a mensagem de erro em `current_check`.

### FR-03: Endpoint de Consulta `GET /api/projects/:projectId/security/run-status`
- O backend deve expor rota para consultar a execução mais recente (`getLatestSecurityRun(projectId)`).
- Retorna o objeto completo do run ativo ou do último run concluído.

### FR-04: Bloqueio Concorrente por Banco & Idempotência
- Se já existir uma execução com `status = 'running'` para o `projectId`, qualquer chamada a `POST /api/projects/:projectId/security/scan` deve retornar HTTP `409 Conflict` informando o `runId` ativo e a fase atual.
- O frontend deve consultar o `run-status` ao carregar a página e desabilitar os botões de scan se o status for `'running'`.

### FR-05: Stepper Universal de 5 Fases no `SecurityAuditPanel`
- O `SecurityAuditPanel.tsx` deve incluir o Stepper visual de 5 fases e ticker dinâmico.
- O estado inicial do Stepper deve ser carregado a partir do `run-status` retornado pelo backend.
- Se o usuário der refresh na página durante o scan, o frontend recupera a fase e o `run_id`, conectando-se ao Socket.IO para continuar recebendo as atualizações em tempo real.

### FR-06: Preservação de Estado dos Agentes do LangGraph
- O pipeline de auditoria opera de forma desacoplada do runtime de mensagens/sessões do grafo LangGraph, preservando os agentes, sessões e checkpoints existentes.

---

## 3. Non-Functional Requirements (NFR)
- **NFR-01 (Resiliência a Page Refresh)**: Um refresh no navegador durante ou após o scan não perde o progresso da auditoria; o Stepper exibe a fase real persistida no SQLite.
- **NFR-02 (Consistência & Integridade Transacional)**: Atualizações de fase devem ser atômicas e com timestamp determinístico.
- **NFR-03 (Property-Based Invariants)**: Validação com `fast-check` das invariantes de ciclo de vida do `security_runs` (transições válidas $1 \le phase \le 5$, monotonicidade temporal `started_at <= updated_at`, e unicidade de run ativo por projeto).
