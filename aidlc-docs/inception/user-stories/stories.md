# User Stories

## Feature: Real-time Streaming & UX no Cockpit
### US-1: Feedback de Raciocínio (Agent Thinking & Typing)
**Como** Human Supervisor,
**Eu quero** ver o texto sendo gerado em tempo real e visualizar estados como "Agent Thinking" e "Typing...",
**Para que** eu saiba que os agentes estão trabalhando e compreenda progressivamente o raciocínio deles, evitando a sensação de travamento da UI.

**Acceptance Criteria:**
- [ ] Quando um nó do LangGraph iniciar a chamada ao LLM, a UI deve exibir o status de "Thinking...".
- [ ] Assim que os tokens começarem a retornar, a UI deve transicionar para "Typing..." e exibir o texto progressivamente.
- [ ] A conexão Socket.IO não deve sofrer timeouts durante gerações longas.
- [ ] Ao término, uma transição visual (fade ou ícone) deve indicar a conclusão da mensagem.

---

## Feature: Auto-Recovery & Resiliência
### US-2: Notificação Não-Intrusiva de Retentativa
**Como** Human Supervisor,
**Eu quero** visualizar um toast/alerta não intrusivo caso um agente sofra falha na API (ex: timeout, 429),
**Para que** eu seja informado sobre a instabilidade sem ter minha experiência atual interrompida.

**Acceptance Criteria:**
- [ ] Se a chamada de IA falhar, o sistema enfileira uma retentativa (com exponential backoff).
- [ ] Um toast surge na tela: "Agent [Name] sofreu timeout, retentando 1/3...".
- [ ] Se a retentativa for bem sucedida, o toast atualiza para sucesso e some.
- [ ] A UI principal do chat não é bloqueada (skeleton loading) pelas retentativas temporárias.

### US-3: Falha Crítica Pós-Retentativas
**Como** Human Supervisor,
**Eu quero** ser notificado permanentemente se todas as retentativas falharem,
**Para que** eu saiba que a rodada não continuará e possa investigar a instabilidade do provedor de LLM.

**Acceptance Criteria:**
- [ ] Após o limite de retentativas (ex: 3) esgotar, a mensagem do agente indica falha crítica de conexão.
- [ ] A execução do grafo é pausada (interrupt) para aguardar a decisão humana.

---

## Feature: Git Diff & Auto-Commit Supervisor
### US-4: Aprovação Interativa de Commit
**Como** Human Supervisor,
**Eu quero** revisar um Diff visual das alterações geradas pelos agentes antes delas entrarem no repositório final,
**Para que** eu mantenha o controle e a qualidade da base de código sobre as refatorações sugeridas pela equipe autônoma.

**Acceptance Criteria:**
- [ ] Ao final da convergência do LangGraph (se o Shared Context envolver alteração de código real), um Modal de "Commit Review" surge no Cockpit.
- [ ] O modal apresenta o *git diff* (mudanças geradas vs código fonte atual).
- [ ] Botões para "Aprovar e Comitar" e "Rejeitar Modificações".
- [ ] O commit aprovado é feito e assinado no repositório.

---

## Feature: Segurança, Performance e LLM Backend
### US-5: Structured Output e Prevenção de Injeção
**Como** System Administrator,
**Eu quero** que a extração de JSON da IA (ex: prioridade de mensagem) use obrigatoriamente a feature de "Structured Output" (JSON Schema nativo do Gemini),
**Para que** não ocorram travamentos no pipeline causados por JSON malformado e para prevenir injeção de prompt por usuários/agentes.

**Acceptance Criteria:**
- [ ] Remover parseamentos regex (`replace(/```json/g, '')`) do `analyzeMessagePriority`.
- [ ] Implementar as chamadas passando o schema JSON explícito exigindo que a API do Google responda com formato determinístico.

### US-6: Sliding Window de Tokens
**Como** System Administrator,
**Eu quero** que a sumarização de histórico utilize uma técnica de Sliding Window com contagem exata de tokens,
**Para que** o máximo de contexto relevante seja enviado sem estourar o limite da janela do modelo e desperdiçar orçamento com logs desnecessários.

**Acceptance Criteria:**
- [ ] `summarizeProject` deve calcular o tamanho de tokens do histórico antes do slice.
- [ ] Em vez de um estático `.slice(-20)`, incluir as últimas N mensagens até preencher um threshold (ex: 80% do budget de contexto configurado).

### US-7: Desacoplamento de Prompts
**Como** System Administrator,
**Eu quero** que os prompts do sistema estejam desacoplados do código TypeScript,
**Para que** eu possa atualizar as regras e diretrizes dos agentes (hot-reload) sem a necessidade de re-compilar o servidor.

**Acceptance Criteria:**
- [ ] Prompts do `ai-manager.ts` e `nodes.ts` devem ser lidos a partir de um JSON ou pasta de Markdown.
- [ ] As atualizações nesses arquivos são refletidas na próxima chamada sem reiniciar o node.

### US-8: Resiliência Assíncrona do Daemon
**Como** System Administrator,
**Eu quero** um processamento de daemon totalmente assíncrono e sem timeouts globais agressivos,
**Para que** os agentes Red/Blue Team possam executar rotinas de auditoria demoradas sem que a UI registre um "falso timeout" no bridge.

**Acceptance Criteria:**
- [ ] O backend `bridge-daemon.ts` lida com sub-processos de longa duração sem abortar em `300000ms`.
- [ ] Utilizar eventos persistentes de heartbeat para sinalizar à UI que a auditoria pesada ainda está rodando.
