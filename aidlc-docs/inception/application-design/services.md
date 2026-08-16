# Application Services & Orchestration Patterns

## 1. LangGraph State Machine Architecture (`LangGraphOrchestratorService`)

O `LangGraphOrchestratorService` encapsula a máquina de estados distribuída. Ele substitui chamadas de chains lineares por um grafo cíclico com persistência de checkpoints no SQLite.

### Estrutura do Grafo de Estados:
```
                                 [Entrada de Tarefa / Prompt]
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │    Supervisor Node   │
                                   └──────────┬───────────┘
                                              │
                 ┌────────────────────────────┼────────────────────────────┐
                 ▼                            ▼                            ▼
      ┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
      │  Frontend Node     │       │  Backend Node      │       │  QA & PBT Node     │
      │  (CLI Bridge)      │       │  (CLI Bridge)      │       │  (CLI Bridge)      │
      └──────────┬─────────┘       └──────────┬─────────┘       └──────────┬─────────┘
                 │                            │                            │
                 └────────────────────────────┼────────────────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ Convergence Checker  │
                                   └──────────┬───────────┘
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       │                                             │
             [Convergência OK]                                [Necessita Decisão]
                       │                                             │
                       ▼                                             ▼
            ┌──────────────────────┐                      ┌──────────────────────┐
            │  Update Wiki/Context │                      │    interrupt()       │
            │     & Task Done      │                      │ (Cockpit HITL Gate)  │
            └──────────────────────┘                      └──────────────────────┘
```

### Padrão de Execução do Supervisor:
1. O Supervisor avalia o histórico de mensagens e o `goal` da tarefa.
2. Define a rota: `goto: "alpha_frontend"` | `goto: "beta_backend"` | `goto: "gamma_qa"` | `goto: "human_decision"` | `goto: "complete"`.
3. Incrementa o contador `turnCount`. Se `turnCount >= maxTurns` (default: 5) e não houve consenso, aciona automaticamente o nó `human_decision`.

---

## 2. Antigravity Bridge Daemon Service (`BridgeDaemonService`)

O `BridgeDaemonService` é um serviço autônomo de background que faz a ponte entre a fila de eventos do Hivemind e os executáveis locais do `agy` CLI.

### Fluxo de Execução Assíncrono:
1. **Escuta de Eventos**: O daemon escuta eventos `message:created` no Socket.IO.
2. **Filtragem de Ação**: Se a mensagem tiver `toAgentId` apontando para um agente registrado como local, ou se for direcionada pelo Supervisor.
3. **Execução Segura**:
   - Cria um processo filho via `child_process.spawn` executando:
     `agy -p "<contexto + instrução>" --agent <role> --continue --dangerously-skip-permissions`
   - Impõe timeout configurável (default: 120 segundos).
   - Sanitiza variáveis de ambiente, garantindo que credenciais não vazem nos logs.
4. **Tratamento de Saída & Retorno**:
   - Captura stdout/stderr estruturado.
   - Envia span de métricas para o `TelemetryService`.
   - Posta a resposta de volta ao Hivemind no endpoint `/api/projects/:id/messages`.

---

## 3. Observability & Token Accounting Service (`TelemetryService`)

Integrado nativamente com o **LangSmith SDK** (`langsmith`).
- Cada sessão/projeto no Hivemind cria um trace identificado.
- Cada nó do LangGraph e execução do `agy` CLI cria um span filho com contagem precisa de tokens (`prompt_tokens`, `completion_tokens`, `total_cost_usd`).
- O serviço alimenta em tempo real a aba de telemetria no React Dashboard.

---

## 4. Onboarding & Bootstrap Service (`ProjectSetupService`)

Permite a qualquer desenvolvedor plugar o Hivemind em seus repositórios:
- **Inspeção**: Varre o repositório em busca de `.aidlc/`, regras e MCP.
- **Injeção**: Gera automaticamente os diretórios e templates padronizados.
- **Indexação**: Dispara o `codebase-memory` MCP para criar o grafo semântico do código.

---

## 5. Cloud Resilience & Backup Service (`CloudSnapshotService`)

Garante RPO = 0 e recuperação de desastres (DR):
- Compacta o banco `database.sqlite`, arquivos de contexto e snapshots do grafo.
- Criptografa o arquivo com chave AES-256 e envia via AWS SDK para Amazon S3.
- Permite restauração 1-clique em caso de falha de disco ou migração de máquina.
