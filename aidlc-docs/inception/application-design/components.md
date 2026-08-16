# Application Components Specification: Hivemind Autonomous Ecosystem

## 1. Backend Server Components (`@ai-dlc/server`)

### COMP-01: LangGraph Multi-Agent Orchestration Engine (`src/services/langgraph/`)
- **Propósito**: Executar a máquina de estados distribuída baseada em grafos cíclicos (`StateGraph`) para coordenar o fluxo entre múltiplos agentes especialistas.
- **Responsabilidades**:
  - Manter os canais de estado tipados (`AgentGraphState`).
  - Executar o nó **Supervisor** que avalia a intenção e roteia para o agente correto.
  - Detectar convergência técnica (`task_done`) ou esgotamento de turnos (anti-loop).
  - Pausar o fluxo com `interrupt()` para decisões críticas de arquitetura.
  - Salvar snapshots de estado via **SQLiteSaver / Checkpointer**.

### COMP-02: Antigravity Bridge Daemon (`src/services/bridge/`)
- **Propósito**: Daemon orientado a eventos para invocar instâncias locais do `agy` CLI e capturar respostas de forma assíncrona e não-bloqueante.
- **Responsabilidades**:
  - Escutar eventos de novas mensagens direcionadas no Hivemind.
  - Disparar subprocessos isolados com `agy -p "<prompt>" --continue --agent <role> --dangerously-skip-permissions`.
  - Gerenciar fila de concorrência e impor timeouts por processo (default: 120s).
  - Acionar circuit breaker em caso de travamento ou erro repetido no CLI.
  - Publicar a resposta do agente de volta no Hivemind via REST/Socket.IO.

### COMP-03: LangSmith Observability & Telemetry Service (`src/services/telemetry/`)
- **Propósito**: Instrumentação completa de traces, spans de nós e contabilidade de consumo de tokens.
- **Responsabilidades**:
  - Rastrear chamadas de LLM (Gemini 1.5) e transições de nós do LangGraph.
  - Ingerir spans de execução do Antigravity CLI com métricas de tempo e contagem de tokens.
  - Expor métricas agregadas de custo e tempo de resposta para o dashboard.

### COMP-04: Project Auto-Setup & Onboarding Assistant (`src/services/setup/`)
- **Propósito**: Inicializar bases de código novas (greenfield) ou existentes (brownfield) com a suíte AI-DLC e MCP `codebase-memory`.
- **Responsabilidades**:
  - Verificar existência e integridade de `.aidlc/`, `.agent/rules/`, `.agent/skills/` e `AGENTS.md`.
  - Criar e configurar arquivos de steering para Kiro e Antigravity.
  - Invocar o MCP `codebase-memory` para construir o grafo de símbolos e dependências.

### COMP-05: Cloud Resilience & S3 Backup Service (`src/services/backup/`)
- **Propósito**: Gerenciamento de snapshots criptografados para backup e restauração na nuvem.
- **Responsabilidades**:
  - Compactar e criptografar o banco de dados SQLite, arquivos de estado e grafos de conhecimento.
  - Fazer upload e download de snapshots em buckets compatíveis com Amazon S3.
  - Restaurar o estado do projeto em novos ambientes de desenvolvimento.

---

## 2. Frontend UI Components (`web/`)

### COMP-06: Human-in-the-Loop Cockpit (`web/src/components/cockpit/`)
- **Propósito**: Painel de comando para o Engenheiro Humano Líder supervisionar e controlar os agentes.
- **Responsabilidades**:
  - Exibir visualmente o status da máquina de estados (Ativo, Em Pausa, Aguardando Humano, Concluído).
  - Oferecer botões de ação rápida: **Pausar Loop**, **Retomar Loop**, **Intervir no Chat**.
  - Renderizar cards interativos para resolver `interrupt()` e `blocker` em 1 clique.

### COMP-07: Real-Time Multi-Agent Live Feed (`web/src/components/chat/`)
- **Propósito**: Visualização das conversas e interações entre agentes em tempo real via Socket.IO.
- **Responsabilidades**:
  - Renderizar mensagens com badges de especialidade (Frontend, Backend, QA, Red Team, Infra).
  - Destacar decisões tomadas, diagramas gerados e blockers com tipografia e cores acessíveis.

### COMP-08: Telemetry & Token Usage Monitor (`web/src/components/telemetry/`)
- **Propósito**: Exibir métricas de consumo de tokens, custos estimados e tempo de resposta por agente.

---

## 3. Specialized Skills Components (`.agent/skills/`)

### COMP-09: Modular Skills Catalog (`.agent/skills/*`)
- **Propósito**: Diretrizes de execução, instruções e ferramentas pré-configuradas para cada papel de agente:
  1. `frontend-engineer`: React 19, Vite, TailwindCSS, acessibilidade.
  2. `backend-engineer`: Node.js, Express, SQLite/PostgreSQL, APIs REST.
  3. `ui-figma-reader`: Leitura e extração de design tokens e specs do Figma.
  4. `doc-researcher`: Análise técnica de documentação e APIs externas.
  5. `qa-engineer`: Automação de testes unitários, de integração e PBT com fast-check.
  6. `security-adversarial`: Auditoria de segurança e simulação Red Team vs. Blue Team.
  7. `infra-devops`: Contêineres, CI/CD, variáveis e deploys.
