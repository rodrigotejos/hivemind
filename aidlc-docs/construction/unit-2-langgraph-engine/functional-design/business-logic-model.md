# Unit 2 Functional Design: LangGraph State Machine & Supervisor Engine

## 1. State Channel Definitions (`AgentGraphAnnotation`)

Utilizando a API `@langchain/langgraph` com `Annotation.Root`:
- `projectId: Annotation<string>` — ID do projeto.
- `taskId: Annotation<string>` — ID da tarefa atual.
- `goal: Annotation<string>` — Meta descritiva da tarefa.
- `messages: Annotation<Array<Message>>({ reducer: (x, y) => x.concat(y), default: () => [] })` — Canal acumulador de mensagens.
- `currentAgent: Annotation<string>` — Agente com posse da execução atual.
- `nextStep: Annotation<string>` — Rota indicada pelo Supervisor.
- `turnCount: Annotation<number>({ reducer: (x, y) => x + y, default: () => 0 })` — Total de iterações do loop.
- `maxTurns: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 5 })` — Limite anti-loop.
- `isConverged: Annotation<boolean>` — Indicador de consenso técnico.
- `status: Annotation<'idle' | 'running' | 'paused' | 'waiting_human' | 'completed' | 'error'>`
- `pendingDecision: Annotation<InterruptPayload | undefined>`

---

## 2. Graph Nodes & Conditional Routing

### Nodes:
1. **`supervisorNode`**: Invoca o modelo Gemini 1.5 com prompt estruturado para avaliar a mensagem mais recente, verificar convergência, avaliar se o limite de turnos foi atingido e escolher o próximo nó especialista (`frontend`, `backend`, `qa`, `security`, `infra`, `human_gate`, `end`).
2. **`workerNode(role)`**: Dispara a geração de resposta do agente especialista (via AI Manager ou Bridge Daemon) e anexa a nova mensagem ao canal `messages`.
3. **`humanGateNode`**: Dispara a função `interrupt()` do LangGraph para persistir o checkpoint e suspender a execução até a autorização do usuário no Cockpit.
4. **`convergenceNode`**: Marca `status = 'completed'`, atualiza o `shared_context` do projeto e notifica a conclusão da tarefa.

---

## 3. Business Rules (BR)

- **BR-01 (Anti-Loop Guard)**: Se `turnCount >= maxTurns` e `isConverged == false`, o Supervisor DEVE redirecionar obrigatoriamente para `human_gate` com a pergunta de desempate.
- **BR-02 (Convergência com task_done)**: Se a mensagem do agente QA ou trabalhador contiver a declaração de conclusão satisfatória dos testes e aceites, o Supervisor finaliza o ciclo com `isConverged = true`.
- **BR-03 (Resumability)**: A retomada via `/resume` carrega o estado a partir do `checkpoint_id` exato, injeta a decisão humana como mensagem de sistema/usuário e prossegue no grafo sem perder o histórico anterior.
