# Unit 1 Functional Design: Business Logic Model (SDK & Skills)

## 1. Domain Entities & State Models

### 1.1 `AgentGraphState`
Estrutura que trafega pelos canais de estado do LangGraph.
- `projectId`: Identificador único do projeto.
- `taskId`: Identificador da tarefa em execução.
- `goal`: Meta de alto nível definida pelo humano ou supervisor.
- `messages`: Histórico de mensagens estruturadas (`role`, `content`, `agentId`, `timestamp`).
- `currentAgent`: Agente especialista com a posse da execução.
- `nextStep`: Próximo nó a ser executado.
- `turnCount`: Contador incremental de rodadas de diálogo (anti-loop guard).
- `maxTurns`: Teto máximo de rodadas (default: 5).
- `isConverged`: Flag booleana indicando consenso técnico.
- `status`: Estado atual (`idle` | `running` | `paused` | `waiting_human` | `completed` | `error`).
- `pendingDecision`: Payload de interrupção contendo pergunta, opções e autor da proposta.

### 1.2 `SpecializedSkill`
Modelo de definição de uma habilidade de IA no padrão Antigravity / AI-DLC.
- `name`: Nome identificador único da skill.
- `description`: Descrição em linguagem natural para descoberta e auto-atribuição.
- `systemPrompt`: Instruções detalhadas de comportamento e restrições de código.
- `tools`: Ferramentas habilitadas (read, write, bash, mcp).

---

## 2. Business Workflows & Invariants

1. **Atribuição Determinística de Skills**:
   - Um agente com `role: "frontend"` sempre recebe a skill `frontend-engineer`.
   - Um agente com `role: "qa"` sempre recebe a skill `qa-engineer`.
2. **Serialização Round-Trip**:
   - Todos os modelos e payloads do SDK devem suportar serialização JSON sem perda de precisão ou de campos opcionais (`JSON.parse(JSON.stringify(state)) == state`).
