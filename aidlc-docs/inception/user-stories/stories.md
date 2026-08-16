# User Stories & Acceptance Criteria: Hivemind Autonomous Ecosystem

## Overview
As histórias de usuário abaixo seguem os critérios **INVEST** (Independent, Negotiable, Valuable, Estimable, Small, Testable) e utilizam o formato **Gherkin** (`Given/When/Then`) com detalhamento de casos de teste, regras de negócio e propriedades invariantes (PBT).

---

## Epic 1: Auto-Setup & Onboarding de Projetos

### US-01: Auto-Configuração de AI-DLC e MCP Codebase Memory
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** que o Hivemind ofereça um comando/botão de setup automático para qualquer projeto (novo ou existente),  
**Para que** todas as regras do AI-DLC, arquivos de steering, skills e o MCP codebase-memory sejam configurados de forma padronizada e replicável com um único clique.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Inicialização do AI-DLC em um projeto brownfield existente
  Given que Rodrigo abre o painel do Hivemind ou executa o CLI de setup em um repositório existente
  When o assistente de onboarding detecta a ausência da pasta .aidlc/ ou .agent/rules/
  Then o Hivemind gera a estrutura .aidlc/aidlc-rules/, .agent/rules/ai-dlc.md, AGENTS.md e .kiro/steering/ai-dlc.md
  And adiciona .aidlc/ ao .gitignore automaticamente
  And aciona o MCP codebase-memory para criar o índice inicial do grafo de conhecimento

Scenario: Validação de projeto já configurado
  Given que o projeto já possui todas as configurações do AI-DLC e MCP presentes
  When o assistente de onboarding executa a verificação
  Then exibe status "Conforme e Pronto" sem duplicar nem corromper arquivos existentes
```

#### Testable Properties & Invariants (PBT):
- **Invariante de Idempotência**: Executar o setup `N` vezes consecutivas deve produzir exatamente o mesmo estado de arquivos e configurações que executar 1 vez (`setup(setup(project)) == setup(project)`).

---

### US-02: Catálogo de Skills Especializadas e Auto-Atribuição
**Como** Sistema Hivemind / Rodrigo,  
**Quero** carregar um catálogo pré-definido de skills especializadas (`frontend-engineer`, `backend-engineer`, `qa-engineer`, `security-adversarial`, `infra-devops`, `ui-figma-reader`, `doc-researcher`),  
**Para que** cada agente instanciado receba imediatamente as diretrizes, ferramentas e papéis corretos para atuar de forma autônoma.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Atribuição automática de skill por papel de agente
  Given que um agente com role "frontend" e model "gemini-1.5-pro" é registrado no projeto
  When o agente é inicializado pelo orquestrador
  Then a skill `.agent/skills/frontend-engineer/SKILL.md` é injetada em seu escopo de execução
  And o agente adquire as diretrizes de código React 19, Vite e TailwindCSS
```

---

## Epic 2: Bridge Daemon & Execução Autônoma de Agentes (Antigravity CLI)

### US-03: Despacho Orientado a Eventos para o Antigravity CLI
**Como** Agente Supervisor AI (AI Manager),  
**Quero** que o Bridge Daemon detecte mensagens direcionadas e acione autonomamente a CLI do Antigravity (`agy`),  
**Para que** os agentes especialistas processem tarefas e respondam em tempo real sem requerer intervenção manual de copiar e colar.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Disparo automático de resposta do Agente Backend
  Given que o Agente Frontend posta uma mensagem do tipo "question" com toAgentId="beta-backend"
  When o Bridge Daemon recebe o evento WebSocket "new_message"
  Then invoca o comando `agy -p "<prompt com contexto>" --continue --dangerously-skip-permissions`
  And captura a saída gerada pelo CLI
  And posta uma mensagem do tipo "answer" no endpoint `/api/projects/:id/messages` com a mesma threadId
```

#### Testable Properties & Invariants (PBT):
- **Invariante de Threading**: Toda resposta autônoma gerada para uma mensagem que possui `threadId` deve preservar o mesmo `threadId` de origem.

---

### US-04: Isolamento e Concorrência Segura de Subprocessos
**Como** Engenheiro de Infraestrutura (Epsilon),  
**Quero** que o Bridge Daemon gerencie filas de execução e limites de processos paralelos,  
**Para que** dois agentes não executem escritas conflitantes simultâneas nem sobrecarreguem o sistema operacional.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Controle de concorrência com fila assíncrona
  Given que 3 agentes recebem mensagens para processar ao mesmo tempo
  When a capacidade máxima configurada de processos simultâneos for 2
  Then o daemon executa os 2 primeiros e enfileira o terceiro com timeout seguro
  And se um processo falhar ou der timeout, aciona o circuit-breaker e notifica com prioridade "critical"
```

---

## Epic 3: Orquestração LangGraph & Anti-Loop Supervisor Gate

### US-05: Máquina de Estados com Grafo Cíclico e Roteamento
**Como** AI Manager (LangGraph Supervisor),  
**Quero** orquestrar a interação entre agentes através de um grafo de estados (`StateGraph`) com canais tipados e checkpointer SQLite,  
**Para que** o estado de cada conversa multi-agente seja preservado e auditável a cada transição.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Roteamento dinâmico pelo Supervisor
  Given um estado com a tarefa "Adicionar validação no formulário"
  When o nó Supervisor analisa o estado atual e o histórico recente
  Then direciona o fluxo para o nó do Agente Frontend (Alpha)
  And persiste o snapshot do estado no checkpointer SQLite
```

---

### US-06: Gatekeeper Anti-Loop e Avaliação de Convergência
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** que o AI Manager avalie continuamente o progresso do diálogo e imponha um teto máximo de rodadas (default: 5),  
**Para que** agentes não fiquem em discussões circulares infinitas nem gastem tokens desnecessários.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Detecção de convergência com sucesso
  Given que o Agente QA valida que o teste passou e posta status "task_done"
  When o nó Supervisor avalia que o objetivo da tarefa foi cumprido
  Then encerra o ciclo no grafo, atualiza o `shared_context` oficial e notifica conclusão

Scenario: Bloqueio de loop infinito por limite de turnos
  Given que dois agentes trocaram 5 mensagens sem chegar a um consenso ou avanço de código
  When o contador de turnos atinge o limite máximo de 5
  Then o Supervisor interrompe o loop
  And cria uma notificação urgente para Rodrigo com o resumo dos dois pontos de vista
```

---

## Epic 4: Cockpit Humano-no-Controle (Human-in-the-Loop)

### US-07: Pausa, Intervenção e Retomada com `interrupt()` do LangGraph
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** visualizar o diálogo dos agentes no painel React e poder pausar o loop, assumir o chat ou aprovar passos críticos com 1 clique,  
**Para que** eu permaneça como autoridade absoluta sobre a direção do projeto.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Interrupção automática para aprovação de decisão técnica
  Given que um agente propõe uma mudança de schema no banco de dados (`type: 'decision'`)
  When o LangGraph executa o nó de validação e dispara `interrupt()`
  Then a execução pausa, o painel exibe um card de aprovação com opções "Aprovar", "Ajustar" ou "Rejeitar"
  And após a decisão de Rodrigo no painel, o grafo retoma a execução a partir do `checkpoint_id`
```

---

### US-08: Resolução de Blockers e Alertas em Tempo Real
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** receber alertas visuais e sonoros imediatos no Dashboard sempre que um agente reportar um `blocker`,  
**Para que** eu possa desimpedir a equipe rapidamente através do cockpit.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Resolução de Blocker via UI
  Given que um alerta vermelho de blocker aparece no topo do painel
  When Rodrigo clica em "Resolver", digita a instrução e envia
  Then o blocker é marcado como `resolved`, uma mensagem `answer` é criada e o agente bloqueado é notificado imediatamente
```

---

## Epic 5: Observabilidade e Telemetria com LangSmith

### US-09: Rastreamento End-to-End e Contabilidade de Tokens
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** visualizar no LangSmith as traces de cada agente, o consumo de tokens e a latência de cada nó do grafo,  
**Para que** eu tenha visibilidade total de custos, gargalos e assertividade dos modelos.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Registro de trace no LangSmith
  Given que o AI Manager ou Bridge Daemon executa uma chamada de LLM ou CLI
  When a execução é concluída
  Then um span é gerado no projeto LangSmith configurado com metadados (agentId, projectId, tokens, durationMs)
```

---

### US-10: Ingestão de Telemetria do Antigravity CLI e Grafo MCP
**Como** Sistema Hivemind,  
**Quero** registrar os metadados de execução do `agy` CLI e sincronizar com o MCP `codebase-memory`,  
**Para que** a memória arquitetural e o histórico de execuções permaneçam centralizados.

---

## Epic 6: Persistência Resiliente e Backup em Nuvem (S3 Snapshots)

### US-11: Exportação e Snapshot Automatizado de Projetos
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** que o Hivemind exporte snapshots completos (SQLite DB, decisões, histórico, MCP memory graph) para armazenamento em nuvem S3,  
**Para que** meu ambiente e contexto de trabalho estejam protegidos contra falhas locais.

#### Acceptance Criteria (Gherkin):
```gherkin
Scenario: Exportação de snapshot para S3
  Given um projeto ativo com 50 mensagens e histórico de decisões
  When a rotina de snapshot é acionada (manual ou periódica)
  Then o Hivemind empacota o estado, banco de dados e metadados em um arquivo criptografado
  And envia para o bucket S3 configurado via TLS (SECURITY-01)
  And registra o hash e timestamp do snapshot
```

#### Testable Properties & Invariants (PBT):
- **Invariante de Round-Trip de Snapshot**: Exportar o estado do projeto para snapshot e restaurá-lo em um banco limpo deve produzir um estado exatamente idêntico (`restore(export(state)) == state`).

---

### US-12: Restauração Determinística de Workspace
**Como** Engenheiro Chefe (Rodrigo),  
**Quero** restaurar um projeto a partir de um snapshot do S3 em outra máquina,  
**Para que** eu possa continuar o trabalho exatamente do ponto onde parei com todos os agentes e histórico alinhados.
