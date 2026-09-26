# Application Design Plan

## Methodology and Approach
Este design foca em estender as fronteiras do `ai-manager` e `bridge-daemon` para suportar WebSockets em Streaming, Prompts dinâmicos, Retry Patterns e integração com CLI Git. Identificaremos as assinaturas de métodos necessárias para viabilizar as 8 histórias de usuário aprovadas, sem ainda detalhar o código interno (o que será feito na fase Construction).

## Execution Checklist

- [ ] 1. Read the approved answers from the embedded questions in this plan.
- [ ] 2. Generate `components.md` identifying the main architectural blocks afetados (ex: AIManager, SocketGateway, PromptRegistry, GitSupervisor).
- [ ] 3. Generate `component-methods.md` definindo as novas assinaturas (ex: `streamAgentResponse`, `commitDiff`).
- [ ] 4. Generate `services.md` detalhando a camada de orquestração (ex: `LangGraphService` orquestrando o Retry Backoff).
- [ ] 5. Generate `component-dependency.md` mostrando a matriz de comunicação e o novo fluxo de dados (Server-Streaming -> UI).
- [ ] 6. Consolidate into `application-design.md`.

---

## Clarification Questions

Para gerar um design arquitetural preciso, por favor, responda:

### Question 1: Socket.IO Streaming Protocol
Como os chunks de texto devem ser trafegados via WebSocket para a UI?

A) Emitir um evento `agent_typing` passando apenas o delta (chunk mais recente) para economizar banda, e a UI concatena.

B) Emitir um evento `agent_typing` passando o texto completo gerado até o momento, facilitando a vida do frontend sem depender de estado interno complexo.

C) Usar Server-Sent Events (SSE) em vez de Socket.IO apenas para a rota de resposta.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: Prompt Registry
Onde o sistema deve carregar os prompts desacoplados (hot-reload)?

A) Arquivos Markdown (`.md`) no File System, lidos dinamicamente a cada chamada ou cacheados com um watcher.

B) Tabela no banco de dados SQLite, com uma UI simples futuramente para editar os prompts.

C) Um único arquivo JSON grande de configuração lido no boot da aplicação.

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: Git Auto-Commit Integration
Como o backend Node.js (`server`) deve aplicar as mudanças no repositório antes de solicitar a aprovação do usuário?

A) Os agentes geram um arquivo JSON com "patches" (diff struct), que é enviado para a UI. Se a UI aprovar, o `server` aplica o patch e executa os comandos `git`.

B) Os agentes escrevem as mudanças no File System criando uma nova branch git, a UI exibe o diff nativo do git, e se aprovado, o `server` faz o merge e commit.

C) Os agentes sobrescrevem os arquivos diretamente na branch atual, o `server` tira o diff das alterações unstaged para a UI aprovar, e se sim, faz `git add/commit`. (Mais fácil, mas com risco de código quebrado no diretório de trabalho caso rejeitado).

X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 4: Auto-Recovery Storage
O estado temporário das "retentativas de LLM" precisa ser persistido caso a API demore muitos minutos para voltar?

A) Não, manter na memória (MemCache/Variables) do processo do `server` é suficiente. Se reiniciar o node, perde o progresso daquele nó.

B) Sim, gravar o status "retrying" no banco SQLite para que o Cockpit possa consultar mesmo se reconectar.

C) Usar um Redis/In-memory Cache externo.

X) Other (please describe after [Answer]: tag below)

[Answer]: 
