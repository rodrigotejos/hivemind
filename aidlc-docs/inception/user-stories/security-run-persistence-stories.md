# User Stories: Iteration 4 - Persistent Security Run State & Universal Stepper

## Personas
- **Rodrigo (Tech Lead / Supervisor Humano)**: Supervisiona projetos de ponta a ponta no Cockpit. Precisa de feedback transparente, persistente e à prova de falhas. Não aceita perder o progresso ou o status da auditoria ao dar refresh na página ou alternar abas.
- **Delta Security (Agente Red Team)**: Executa varreduras de rotas, CORS, segredos e vulnerabilidades OWASP, registrando o progresso de cada fase de forma atômica.
- **Beta Backend & Blue Team**: Elabora mitigações, verifica conformidade e grava o score consolidado na conclusão do pipeline.

---

## US-13: Persistência de Execução de Segurança em `security_runs` no SQLite
**Como** Tech Lead auditando a segurança do projeto,  
**Quero** que cada execução do pipeline de segurança gere um registro estruturado na tabela `security_runs` com `run_id`, fase atual ($1..5$), status, timestamps e agente ativo,  
**Para que** o histórico e o estado da execução nunca sejam perdidos da memória volátil do processo.

### Acceptance Criteria
- **Scenario 1: Criação de novo run ao disparar auditoria**
  - **Given** que o usuário ou sistema dispara um novo scan para o `projectId`
  - **When** o pipeline inicia
  - **Then** um registro é inserido na tabela `security_runs` com `id = 'run_sec_<timestamp>_<hash>'`, `phase = 1`, `status = 'running'`, `agent_role = 'delta-security'`
  - **And** `queries.getLatestSecurityRun(projectId)` retorna este registro.

- **Scenario 2: Atualização progressiva de fase no SQLite**
  - **Given** que o scan está em progresso
  - **When** o pipeline transita para a Fase 2, 3, 4 e 5
  - **Then** a linha do `run_id` é atualizada com `phase = N`, `phase_name`, `target_file`, `current_check` e `updated_at = CURRENT_TIMESTAMP`
  - **And** no término da Fase 5, o status é marcado como `'completed'` e `completed_at` é preenchido.

---

## US-14: Resiliência e Re-hidratação de Estado após Page Refresh (F5) ou Troca de Abas
**Como** Tech Lead acompanhando a auditoria no navegador,  
**Quero** que ao dar refresh (F5), mudar de aba ou reabrir o navegador, a tela carregue imediatamente a fase exata gravada no banco de dados,  
**Para que** eu nunca veja a tela resetar para o estado inicial ("Pronto") enquanto o scan estiver em andamento ou recém-concluído.

### Acceptance Criteria
- **Scenario 1: Refresh durante scan em andamento**
  - **Given** que um scan com `id = 'run_sec_123'` está na Fase 3 (`status = 'running'`)
  - **When** o usuário dá refresh (F5) na página `ProjectView`
  - **Then** o frontend consulta `GET /api/projects/:projectId/security/run-status`
  - **And** o Stepper é renderizado imediatamente na Fase 3/5 com badge "Em execução"
  - **And** o cliente se conecta ao Socket.IO para continuar recebendo os eventos da Fase 4 e 5 sem interrupção.

- **Scenario 2: Carga de página após scan concluído**
  - **Given** que a última auditoria finalizou com sucesso
  - **When** a página é carregada
  - **Then** o Stepper exibe as 5 fases como "Concluído 100%" com o score do projeto persistido.

---

## US-15: Bloqueio Concorrente por Banco & Idempotência de Scan
**Como** operador da plataforma,  
**Quero** que o sistema impeça estritamente múltiplos disparos de scan concorrentes para o mesmo projeto,  
**Para que** dois pipelines não disputem recursos, não corrompam os achados e não gerem duplicidade de trabalho dos agentes.

### Acceptance Criteria
- **Scenario 1: Tentativa de disparo com scan ativo no banco**
  - **Given** que existe um registro em `security_runs` para o projeto com `status = 'running'`
  - **When** uma requisição `POST /api/projects/:projectId/security/scan` é recebida
  - **Then** o servidor responde com `HTTP 409 Conflict` e JSON `{ error: 'SCAN_ALREADY_RUNNING', runId: string, phase: number }`
  - **And** nenhum novo pipeline paralelo é inicializado.

- **Scenario 2: Feedback visual de bloqueio nos botões**
  - **Given** que o frontend detectou um scan com status `'running'`
  - **Then** tanto o botão "Disparar Scan Red Team" quanto "Disparar Auditoria Adversarial" ficam desabilitados com spinner animado e texto indicativo da fase ativa.

---

## US-16: Stepper Universal de 5 Fases no `SecurityAuditPanel` com Ticker Dinâmico
**Como** Tech Lead utilizando a aba "Auditoria Red Team vs. Blue Team",  
**Quero** visualizar o Stepper visual de 5 etapas e o ticker ao vivo diretamente dentro do painel analítico de segurança,  
**Para que** eu possa acompanhar as 5 fases determinísticas antes, durante e depois da execução sem depender do card superior.

### Acceptance Criteria
- **Scenario 1: Visualização do roteiro antes do disparo**
  - **Given** que o usuário está na aba "Auditoria Red Team vs. Blue Team"
  - **Then** o painel renderiza os 5 passos do pipeline: `1. Rotas & CORS`, `2. Segredos .env`, `3. Red Team (OWASP)`, `4. Blue Team (Patch)` e `5. Verificação & DB`
  - **And** o usuário sabe exatamente quais verificações serão executadas.

- **Scenario 2: Ticker ao vivo durante a auditoria**
  - **Given** que o scan foi disparado
  - **When** os eventos Socket.IO ou atualizações de banco ocorrem
  - **Then** o Stepper dentro de `SecurityAuditPanel` destaca a fase ativa com brilho âmbar pulsante e o mini-ticker exibe o agente e arquivo auditado em tempo real.
