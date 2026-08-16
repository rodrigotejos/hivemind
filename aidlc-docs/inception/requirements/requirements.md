# Requirements Specification: Autonomous Multi-Agent Collaboration & Hivemind Platform

## 1. Intent Analysis Summary

- **User Request**: Planejar e implementar uma nova funcionalidade no Hivemind para permitir colaboração e conversação autônoma em tempo real entre múltiplos agentes de IA (Antigravity CLI `agy`), com supervisão inteligente do AI Manager, governança do engenheiro humano (Human-in-the-Loop), catálogo de skills especializadas pré-definidas, assistente de auto-setup para novos/existentes projetos (AI-DLC + MCP codebase-memory) e backup resiliente em nuvem (S3/Cloud).
- **Request Type**: New Feature & System Enhancement (Inception Phase)
- **Scope Estimate**: System-wide (Multi-package: `@ai-dlc/server`, `web`, `@ai-dlc/sdk`, `.agent/skills/`, e novos módulos daemon/bridge).
- **Complexity Estimate**: Complex (Orquestração de subprocessos assíncronos, WebSocket bidirecional, supervisão por LLM, regras de segurança/resiliência e testes baseados em propriedades).
- **Requirements Depth**: Comprehensive (Alta criticidade, coordenação multi-agente e exigência de garantias de integridade).

---

## 2. Functional Requirements (FR)

### FR-01: Autonomous Multi-Agent Bridge Daemon (`agy` Runner)
- **FR-01.1**: O sistema deve possuir um daemon de ponte (`bridge-daemon`) que escuta eventos do Hivemind (via Socket.IO e REST).
- **FR-01.2**: Quando uma mensagem direcionada (`toAgentId`) ou um evento acionável (`question`, `task_start`, `blocker`, `handoff`) for publicado, o daemon deve invocar autonomamente a instância do Antigravity CLI correspondente (`agy -p` / `--continue` / `--conversation <id>` com `--dangerously-skip-permissions`).
- **FR-01.3**: O retorno gerado pelo CLI do agente deve ser postado de volta no Hivemind como uma resposta tipada (`answer`, `status`, `decision`, `task_done`), mantendo a thread e o histórico consistentes.
- **FR-01.4**: O daemon deve gerenciar a concorrência de múltiplos agentes locais em execução sem travar a interface nem criar conflitos de I/O na base de código.

### FR-02: AI Manager Supervision & Anti-Loop Convergence Gate
- **FR-02.1**: Toda interação autônoma gerada entre agentes deve passar pelo gate de supervisão do AI Manager (`ai-manager.ts`).
- **FR-02.2**: O AI Manager deve avaliar se a conversa atingiu convergência ou consenso técnico, encerrando o ciclo com `task_done` ou atualizando o `shared_context` automaticamente.
- **FR-02.3**: O AI Manager deve impor um teto de segurança (configurável, default: 5 rodadas) para interromper loops infinitos ou divagações não produtivas, escalando automaticamente para o humano se a convergência não for alcançada.

### FR-03: Human-in-the-Loop Hybrid Cockpit (Web Dashboard)
- **FR-03.1**: O painel React deve fornecer visualização em tempo real das mensagens trocadas entre agentes via WebSocket.
- **FR-03.2**: Ações de baixo risco (perguntas, alinhamentos e leituras) ocorrem de forma 100% autônoma.
- **FR-03.3**: O humano pode a qualquer momento clicar em **Pausar Loop**, **Intervir no Chat** ou **Aprovar/Rejeitar Decisão**.
- **FR-03.4**: Mudanças de arquitetura, decisões críticas (`type: 'decision'`) e remoção/criação em lote de arquivos exigem aprovação explícita do humano via botão no painel.

### FR-04: Catálogo de Skills Especializadas & Auto-Atribuição
- **FR-04.1**: O sistema deve fornecer um conjunto modular e padronizado de skills de alta performance em `.agent/skills/`:
  1. `ui-figma-reader`: Leitura de layouts, design tokens e especificações de UI.
  2. `backend-engineer`: Desenvolvimento Node.js, Express, APIs REST, schemas e queries SQL.
  3. `frontend-engineer`: Desenvolvimento React 19, Vite, TailwindCSS e componentes acessíveis.
  4. `doc-researcher`: Leitura técnica de documentação, papers, APIs e normas.
  5. `qa-engineer`: Elaboração de suítes de teste (Unitários, Integração e PBT).
  6. `security-adversarial`: Auditoria de vulnerabilidades com fluxo Red Team / Blue Team iterativo.
  7. `infra-devops`: Configuração de contêineres, CI/CD, variáveis e deploy.
- **FR-04.2**: O orquestrador deve atribuir e carregar automaticamente a skill adequada conforme o papel (`role`) registrado do agente ou seleção manual do usuário.

### FR-05: Assistente de Auto-Setup para Projetos (Greenfield & Brownfield)
- **FR-05.1**: O sistema deve permitir inicializar o Hivemind tanto em projetos novos (greenfield) quanto em bases de código existentes (brownfield).
- **FR-05.2**: Se um projeto não possuir as regras do AI-DLC (`.aidlc/`, `.agent/rules/`, `.agent/skills/`) ou a configuração do MCP `codebase-memory`, o Hivemind deve disponibilizar um comando/assistente via UI e CLI para gerar e configurar automaticamente todos os arquivos necessários de forma determinística e replicável.

### FR-06: Persistência Resiliente & Backup em Nuvem (Cloud / S3 Snapshots)
- **FR-06.1**: O sistema deve fornecer funcionalidade para exportar e sincronizar snapshots completos do projeto (histórico de mensagens, decisões, metadados de projetos, grafo de memória do MCP e artefatos do AI-DLC) para armazenamento em nuvem (ex: AWS S3 ou bucket compatível).
- **FR-06.2**: Deve permitir restauração confiável de projetos a partir de snapshots remotos em caso de perda ou troca de máquina.

### FR-07: LangGraph Multi-Agent State Machine & Checkpointing
- **FR-07.1**: A orquestração do AI Manager e da equipe de agentes deve utilizar o **LangGraph.js** (`@langchain/langgraph`) como máquina de estados distribuída.
- **FR-07.2**: Deve implementar o padrão **Supervisor / Router**, onde o estado compartilhado (`AgentState`) é mantido em checkpointers (SQLiteSaver / MemorySaver).
- **FR-07.3**: Utilizar `interrupt()` nativo do LangGraph para pausar a execução da máquina de estados em decisões arquiteturais ou blocos críticos, retomando após a aprovação humana via Dashboard.

### FR-08: LangSmith Observability & Antigravity Telemetry
- **FR-08.1**: Toda execução de LLM, transição de estado no LangGraph e chamada do AI Manager deve ser rastreada via **LangSmith SDK** (`langsmith`).
- **FR-08.2**: O sistema deve coletar métricas de consumo de tokens (prompt, completion e custo total) por projeto e por agente.
- **FR-08.3**: As execuções do Antigravity CLI (`agy`) disparadas pelo Bridge Daemon devem ter seus spans e metadados de execução ingeridos nas traces do LangSmith e no MCP `codebase-memory`.

---

## 3. Non-Functional Requirements (NFR)

### NFR-01: Security Baseline (Enforced)
- **SEC-01**: Todas as chamadas de banco de dados SQLite utilizam statements parametrizados para impedir injeção de SQL.
- **SEC-02**: Toda entrada de API REST e WebSocket passa por validação estrita de schema e sanitização de payloads contra XSS e comandos maliciosos.
- **SEC-03**: A execução de subprocessos do CLI (`agy`) utiliza caminhos sanitizados e variáveis de ambiente isoladas, sem interpolação direta em shells vulneráveis.
- **SEC-04**: Credenciais e chaves de API (ex: `GOOGLE_API_KEY`, credenciais AWS) nunca são expostas em logs, payloads de mensagens ou código versionado.

### NFR-02: Resiliency Baseline (Enforced)
- **RES-01**: O bridge daemon e o servidor possuem recuperação automática com circuit breaker caso uma instância do `agy` CLI falhe, retorne timeout ou erro de execução.
- **RES-02**: Todas as mensagens e eventos em trânsito são persistidos no SQLite antes da confirmação, garantindo RPO = 0 em falhas de processo.
- **RES-03**: Auditoria e validação adversarial periódica (Red Team vs Blue Team) nas propostas dos agentes para garantir robustez técnica antes da aprovação final pelo humano.

### NFR-03: Property-Based Testing (PBT) (Enforced)
- **PBT-01**: Invariantes de serialização/desserialização de mensagens, snapshots de backup e decodificação de payloads devem ser validados via testes baseados em propriedades com geradores aleatórios.
- **PBT-02**: A máquina de estados de transição de mensagens (`active` → `waiting_response` → `resolved` / `archived`) deve manter invariantes formais comprovados por PBT.

### NFR-04: Performance & Usability
- **PERF-01**: Latência de transmissão de mensagens no WebSocket < 50ms para clientes locais.
- **PERF-02**: Interface do usuário fluida em React 19 com feedback visual imediato sobre o status de digitação e execução dos agentes (`idle`, `working`, `waiting`).

---

## 4. User Personas & Scenarios

### Personas:
1. **Rodrigo (Engenheiro Chefe / Humano Líder)**: Define objetivos de alto nível, supervisiona a timeline no Dashboard, desbloqueia agentes e bate o martelo em decisões críticas de arquitetura.
2. **Agente Alpha (Frontend Specialist)**: Constrói componentes React, lê designs e consome APIs.
3. **Agente Beta (Backend Specialist)**: Constrói endpoints REST, models e lógica de negócio.
4. **Agente Gamma (QA / Security Specialist)**: Escreve testes, executa PBT e atua no Red Team adversarial para encontrar falhas de segurança e resiliência.

### Cenário Exemplo: Diálogo Autônomo com Supervisão
1. Rodrigo cria uma tarefa: *"Implementar autenticação JWT no backend e tela de login no frontend"*.
2. Agente Beta inicia o backend, extrai o schema e posta: *"Criei o endpoint `/api/auth/login`. Formato esperado: `{ email, password }`, retorno `{ token }`"*.
3. O Bridge Daemon aciona o Agente Alpha, que lê a mensagem e gera o formulário de login no React consumindo o endpoint.
4. Agente Gamma é acionado para validar o fluxo, encontra uma brecha (falta rate-limiting no login) e posta um aviso técnico.
5. Agente Beta recebe o aviso, implementa o rate-limiting e responde com sucesso.
6. O AI Manager detecta convergência, atualiza a documentação técnica oficial (`shared_context`) e notifica o Rodrigo: *"Funcionalidade de login concluída e testada pelos agentes"*.
7. Rodrigo revisa no dashboard e dá o aceite final com 1 clique.
