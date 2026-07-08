# AI-DLC — AI Development Lifecycle Coordinator

## Especificação Técnica Completa

---

## 1. Visão Geral

O **AI-DLC** é um servidor de orquestração que coordena múltiplas IAs (e humanos) trabalhando simultaneamente em projetos de código. Funciona como um hub de comunicação em tempo real, com um AI Manager (LangChain) embutido que gerencia contexto, detecta blockers e notifica o humano quando necessário.

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Real-time | Socket.IO (WebSocket) |
| AI Manager | LangChain.js |
| Banco de Dados | SQLite (MVP) → PostgreSQL (produção) |
| Notificações | Web Push API + Socket.IO |

### Princípios

- **Simples pra IA consumir** — endpoints REST claros, payloads JSON mínimos
- **Simples pra humano visualizar** — dashboard React intuitivo
- **AI Manager não bloqueia** — ele processa assincronamente e enriquece
- **Tudo é rastreável** — histórico completo de mensagens e decisões

### Governança: Humano é Autoridade Final

O humano (dono do projeto) é a **autoridade máxima**. Nenhuma IA decide por ele.
O sistema existe para **servir ao humano**, não para substituí-lo.

```
         👑 HUMANO
         │  Autoridade final absoluta.
         │  Sim é sim. Não é não.
         │  Toda decisão importante passa por ele.
         │
         ▼
    🧠 AI Manager (LangChain)
         │  Facilitador. Coleta contexto, prepara cenários,
         │  apresenta opções digeridas. NUNCA decide sozinho
         │  em questões que afetam direção/arquitetura.
         │
         ▼
    🤖🤖🤖 IAs Trabalhadoras
         Executam, opinam, sugerem. Mas não decidem
         nada que impacte o projeto sem aprovação.
```

#### Regras de Governança:

1. **Decisões de execução trivial** → IA resolve sozinha (nome de variável, formatação, ordem de imports)
2. **Decisões técnicas com impacto** → IA sugere, AI Manager coleta opinião das outras, **notifica humano com contexto completo pronto pra decidir**
3. **Blockers** → AI Manager busca contexto com todas as IAs envolvidas, monta cenário, **notifica humano já com tudo mastigado**
4. **Conflitos** → AI Manager apresenta os dois lados com prós/contras, **humano bate o martelo**
5. **Mudança de rumo/escopo** → Precisa de aprovação explícita do humano. Sempre.

#### Formato de Escalação ao Humano:

Quando o AI-DLC escala algo pro humano, deve SEMPRE incluir:

```json
{
  "escalation": {
    "title": "Decisão necessária: REST vs GraphQL para o módulo de auth",
    "context": "IA Kiro precisa definir a interface do módulo de autenticação...",
    "opinions": [
      { "agent": "kiro", "opinion": "REST, porque...", "confidence": "alta" },
      { "agent": "claude", "opinion": "GraphQL seria melhor porque...", "confidence": "média" }
    ],
    "ai_manager_analysis": "Considerando o escopo atual e a stack existente, REST parece mais alinhado. Mas a decisão é sua.",
    "options": ["REST", "GraphQL", "Outro (especificar)"],
    "impact": "Bloqueia IA Kiro e IA Claude até decisão",
    "urgency": "high"
  }
}
```

#### O que o humano ganha:

- **Nunca precisa investigar** — o AI-DLC já juntou as peças
- **Decide com contexto** — vê opinião de cada IA, análise do Manager
- **Controle total** — pode overridar qualquer sugestão do AI Manager
- **Sabe tudo que acontece** — mas só é interrompido quando necessário
- **IAs aprendem suas decisões** — padrões de decisão ficam no histórico pra AI Manager usar como referência futura

---

## 2. Modelos de Dados (Schema)

### 2.1 `projects`

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT DEFAULT 'active', -- active | paused | archived
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 `agents`

Cada participante (IA ou humano) registrado no sistema.

```sql
CREATE TABLE agents (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,           -- "kiro-refactor", "claude-features", "rodrigo"
  type          TEXT NOT NULL,           -- "ai" | "human"
  model         TEXT,                    -- "claude-4", "gpt-4", null pra humano
  description   TEXT,                    -- "Responsável por refatoração do módulo X"
  status        TEXT DEFAULT 'idle',     -- idle | working | waiting | offline
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 `project_agents`

Relação N:N — quais agentes estão em quais projetos.

```sql
CREATE TABLE project_agents (
  project_id    TEXT REFERENCES projects(id),
  agent_id      TEXT REFERENCES agents(id),
  role          TEXT DEFAULT 'worker',  -- worker | reviewer | manager
  joined_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, agent_id)
);
```

### 2.4 `messages`

O core do sistema — todas as comunicações.

```sql
CREATE TABLE messages (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  project_id    TEXT NOT NULL REFERENCES projects(id),
  from_agent_id TEXT NOT NULL REFERENCES agents(id),
  to_agent_id   TEXT,                    -- null = broadcast pra todos do projeto
  thread_id     TEXT,                    -- agrupa mensagens em threads
  type          TEXT NOT NULL,           -- ver tipos abaixo
  priority      TEXT DEFAULT 'normal',   -- low | normal | high | critical
  content       TEXT NOT NULL,           -- markdown
  metadata      TEXT,                    -- JSON extra (arquivos afetados, etc)
  status        TEXT DEFAULT 'active',   -- active | resolved | archived
  waiting_response BOOLEAN DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_project ON messages(project_id, created_at);
CREATE INDEX idx_messages_to_agent ON messages(to_agent_id, status);
CREATE INDEX idx_messages_thread ON messages(thread_id);
```

**Tipos de mensagem (`type`):**

| Tipo | Descrição | Gera notificação? |
|------|-----------|-------------------|
| `status` | Update de progresso | 🟢 Info |
| `question` | Pergunta pra outro agente | 🟡 Se pra humano |
| `answer` | Resposta a uma pergunta | 🟢 Info |
| `blocker` | Estou travado, preciso de ajuda | 🔴 Urgente |
| `decision` | Decisão tomada que afeta outros | 🟡 Importante |
| `conflict` | Conflito detectado | 🔴 Urgente |
| `task_done` | Terminei minha tarefa | 🟡 Importante |
| `task_start` | Comecei a trabalhar em algo | 🟢 Info |
| `handoff` | Estou passando isso pra outro agente | 🟡 Importante |
| `context` | Informação de contexto (AI Manager gera) | 🟢 Info |

### 2.5 `notifications`

```sql
CREATE TABLE notifications (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  agent_id      TEXT NOT NULL REFERENCES agents(id), -- quem deve receber
  message_id    TEXT REFERENCES messages(id),
  level         TEXT NOT NULL,           -- info | important | urgent
  title         TEXT NOT NULL,
  body          TEXT,
  read          BOOLEAN DEFAULT 0,
  delivered     BOOLEAN DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.6 `decisions`

Log de decisões importantes (pra rastreabilidade).

```sql
CREATE TABLE decisions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  project_id    TEXT NOT NULL REFERENCES projects(id),
  made_by       TEXT NOT NULL REFERENCES agents(id),
  description   TEXT NOT NULL,
  rationale     TEXT,                    -- por que essa decisão
  affected_files TEXT,                   -- JSON array de paths
  message_id    TEXT REFERENCES messages(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. API REST — Endpoints

### 3.1 Projetos

```
GET    /api/projects                    → Lista todos os projetos
POST   /api/projects                    → Cria projeto novo
GET    /api/projects/:id                → Detalhes do projeto
PATCH  /api/projects/:id                → Atualiza projeto (nome, status)
DELETE /api/projects/:id                → Arquiva projeto

GET    /api/projects/:id/summary        → Resumo gerado pelo AI Manager
GET    /api/projects/:id/agents         → Agentes neste projeto
POST   /api/projects/:id/agents         → Adiciona agente ao projeto
DELETE /api/projects/:id/agents/:agentId → Remove agente do projeto
```

### 3.2 Agentes

```
GET    /api/agents                      → Lista todos os agentes
POST   /api/agents                      → Registra novo agente
GET    /api/agents/:id                  → Detalhes do agente
PATCH  /api/agents/:id                  → Atualiza agente (status, etc)
DELETE /api/agents/:id                  → Remove agente
```

### 3.3 Mensagens (Core)

```
GET    /api/projects/:id/messages       → Lista mensagens do projeto
POST   /api/projects/:id/messages       → Posta nova mensagem
GET    /api/projects/:id/messages/:msgId → Detalhes de uma mensagem
PATCH  /api/projects/:id/messages/:msgId → Atualiza (resolve, arquiva)

GET    /api/projects/:id/pending/:agentId → Mensagens pendentes pra esse agente
POST   /api/projects/:id/messages/:msgId/reply → Responde uma mensagem específica

GET    /api/projects/:id/threads         → Lista threads ativas
GET    /api/projects/:id/threads/:threadId → Mensagens de uma thread
```

**Query params para GET mensagens:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Filtrar por tipo (status, question, blocker...) |
| `from` | string | Filtrar por agente que enviou |
| `to` | string | Filtrar por destinatário |
| `priority` | string | Filtrar por prioridade |
| `status` | string | active, resolved, archived |
| `since` | datetime | Mensagens a partir de... |
| `limit` | number | Default 50, max 200 |

### 3.4 Notificações

```
GET    /api/notifications               → Lista notificações do humano
PATCH  /api/notifications/:id           → Marca como lida
POST   /api/notifications/read-all      → Marca todas como lidas
GET    /api/notifications/unread-count   → Contador de não lidas
```

### 3.5 AI Manager

```
POST   /api/projects/:id/ai/summarize   → Gera resumo do estado atual
POST   /api/projects/:id/ai/analyze     → Analisa mensagens recentes e sugere ações
POST   /api/projects/:id/ai/context/:agentId → Gera contexto resumido pra um agente
POST   /api/projects/:id/ai/resolve-conflict → Tenta resolver conflito entre agentes
GET    /api/projects/:id/ai/suggestions  → Lista sugestões pendentes do AI Manager
```

### 3.6 Dashboard

```
GET    /api/dashboard                   → Overview geral (projetos ativos, blockers, stats)
GET    /api/dashboard/activity          → Timeline de atividade recente
GET    /api/dashboard/blockers          → Todos os blockers ativos
```

---

## 4. Payloads de Exemplo

### 4.1 IA postando status

```http
POST /api/projects/abc123/messages
Content-Type: application/json
X-Agent-Key: kiro-refactor-key-123

{
  "type": "status",
  "content": "Terminei a refatoração do módulo de autenticação. Extraí 3 funções do monolito para `auth/validators.ts`. Testes passando.",
  "metadata": {
    "files_changed": ["src/auth/validators.ts", "src/auth/index.ts"],
    "tests_passing": true,
    "commit": "a1b2c3d"
  }
}
```

### 4.2 IA fazendo pergunta

```http
POST /api/projects/abc123/messages
Content-Type: application/json
X-Agent-Key: claude-features-key-456

{
  "type": "question",
  "to_agent_id": "kiro-refactor",
  "content": "Vi que você extraiu `validateToken()` para o novo módulo. Eu preciso usar essa função no meu novo endpoint `/api/refresh`. Qual é a interface esperada? Aceita o token como string direto ou precisa do request object?",
  "priority": "high",
  "waiting_response": true,
  "metadata": {
    "related_files": ["src/auth/validators.ts", "src/api/refresh.ts"]
  }
}
```

### 4.3 IA reportando blocker

```http
POST /api/projects/abc123/messages
Content-Type: application/json
X-Agent-Key: cursor-tests-key-789

{
  "type": "blocker",
  "content": "Não consigo rodar os testes de integração. O módulo `database/connection.ts` foi alterado e agora espera uma env var `DB_POOL_SIZE` que não existe no `.env.test`. Quem alterou? Preciso saber o valor esperado.",
  "priority": "critical",
  "waiting_response": true,
  "metadata": {
    "error": "EnvVarMissing: DB_POOL_SIZE",
    "file": "src/database/connection.ts",
    "test_command": "npm run test:integration"
  }
}
```

### 4.4 Humano respondendo

```http
POST /api/projects/abc123/messages/msg-xyz/reply
Content-Type: application/json
X-Agent-Key: rodrigo-human-key

{
  "content": "O `DB_POOL_SIZE` foi adicionado pelo Kiro na refatoração. Valor padrão: 5 pra teste, 20 pra prod. Adiciona `DB_POOL_SIZE=5` no `.env.test`.",
  "metadata": {
    "decision": "DB_POOL_SIZE=5 para testes"
  }
}
```

---

## 5. WebSocket Events

Conexão: `ws://localhost:3001` com Socket.IO

### 5.1 Client → Server

| Event | Payload | Descrição |
|-------|---------|-----------|
| `join_project` | `{ projectId }` | Se inscreve pra updates do projeto |
| `leave_project` | `{ projectId }` | Sai do projeto |
| `typing` | `{ projectId, agentId }` | Indicador de "digitando" |

### 5.2 Server → Client

| Event | Payload | Descrição |
|-------|---------|-----------|
| `new_message` | `{ message }` | Nova mensagem no projeto |
| `message_updated` | `{ message }` | Mensagem atualizada (resolved, etc) |
| `agent_status_changed` | `{ agentId, status }` | Agente mudou status |
| `notification` | `{ notification }` | Notificação pra o humano |
| `ai_suggestion` | `{ suggestion }` | AI Manager tem uma sugestão |
| `blocker_detected` | `{ message, analysis }` | Blocker detectado com análise |
| `conflict_detected` | `{ agents, files, analysis }` | Conflito detectado |

---

## 6. AI Manager (LangChain)

### 6.1 Arquitetura

```
┌─────────────────────────────────────────────┐
│              AI MANAGER                       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐   Toda mensagem nova          │
│  │ Listener │──→ passa pelo AI Manager      │
│  └────┬─────┘                               │
│       │                                     │
│       ▼                                     │
│  ┌──────────┐                               │
│  │ Classify │  Classifica prioridade        │
│  └────┬─────┘  Detecta se é blocker         │
│       │        Identifica conflitos         │
│       ▼                                     │
│  ┌──────────┐                               │
│  │  Decide  │  Precisa notificar humano?    │
│  └────┬─────┘  Consigo responder sozinho?   │
│       │        Preciso sugerir algo?        │
│       ▼                                     │
│  ┌──────────┐                               │
│  │   Act    │  Notifica / Responde /        │
│  └──────────┘  Sugere / Escala              │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 Chains/Prompts

#### a) Classificador de Mensagem

```
Prompt: Analise esta mensagem de um agente AI em um projeto de código.
Classifique:
- priority: low | normal | high | critical
- needs_human: true/false (o humano precisa ver isso agora?)
- can_auto_respond: true/false (você consegue responder?)
- conflict_risk: true/false (pode causar conflito com outro agente?)

Contexto do projeto: {project_summary}
Agentes ativos: {agents_list}
Mensagem: {message}
```

#### b) Gerador de Contexto

```
Prompt: Gere um resumo conciso do estado atual do projeto para um novo agente
que vai começar a trabalhar. Inclua:
- O que já foi feito
- O que está em progresso
- Decisões importantes tomadas
- Blockers ativos
- Arquivos principais modificados

Mensagens recentes: {recent_messages}
Decisões: {decisions}
```

#### c) Detector de Conflitos

```
Prompt: Analise se há conflito entre as ações destes agentes.
Agente A ({name_a}) está: {action_a}
Agente B ({name_b}) está: {action_b}
Arquivos em comum: {shared_files}

Há conflito? Se sim, sugira resolução.
```

#### d) Auto-Responder

```
Prompt: Um agente fez a seguinte pergunta. Com base no contexto do projeto
e mensagens anteriores, você consegue responder com segurança?
Se sim, responda. Se não, diga que vai escalar pro humano.

Pergunta: {question}
Contexto: {project_context}
Mensagens relevantes: {relevant_messages}
```

### 6.3 Quando o AI Manager age

| Trigger | Ação |
|---------|------|
| Nova mensagem tipo `blocker` | Notifica humano imediatamente |
| Pergunta sem resposta há >5min | Escala prioridade, notifica |
| 2+ agentes editando mesmos arquivos | Alerta de conflito |
| Agente posta `task_done` | Gera resumo, verifica se alguém dependia disso |
| Novo agente entra no projeto | Gera contexto resumido automaticamente |
| Humano pede resumo | Gera summary com estado atual |

---

## 7. Sistema de Notificações

### 7.1 Push Notifications (Browser)

```javascript
// Service Worker registrado no React
// Backend envia via web-push library

const notification = {
  title: "🔴 Blocker no Projeto X",
  body: "IA Cursor não consegue rodar testes — precisa de env var",
  icon: "/ai-dlc-icon.png",
  tag: "blocker-msg-xyz",        // agrupa notificações do mesmo tipo
  data: {
    url: "/projects/abc123/messages/msg-xyz",
    projectId: "abc123",
    messageId: "msg-xyz"
  },
  actions: [
    { action: "respond", title: "Responder" },
    { action: "dismiss", title: "Ver depois" }
  ]
};
```

### 7.2 Regras de Notificação

```javascript
const NOTIFICATION_RULES = {
  // Sempre notifica push
  blocker: { level: 'urgent', push: true, sound: true },
  conflict: { level: 'urgent', push: true, sound: true },

  // Notifica push se for pro humano
  question: {
    level: (msg) => msg.to_agent_id === HUMAN_ID ? 'important' : 'info',
    push: (msg) => msg.to_agent_id === HUMAN_ID,
  },

  // Notifica push se prioridade alta
  task_done: { level: 'important', push: true, sound: false },
  decision: { level: 'important', push: true, sound: false },
  handoff: { level: 'important', push: true, sound: false },

  // Só dashboard
  status: { level: 'info', push: false },
  task_start: { level: 'info', push: false },
  context: { level: 'info', push: false },
};
```

---

## 8. Autenticação

### MVP: API Keys simples

Cada agente recebe uma key ao ser registrado. Envia no header:

```
X-Agent-Key: <key>
```

O backend valida e identifica o agente.

### Futuro: JWT + refresh tokens

Para o humano (dashboard), sessão com JWT.

---

## 9. Estrutura do Projeto (Monorepo)

```
ai-dlc/
├── package.json                 # Workspace root
├── packages/
│   ├── server/                  # Backend Node.js
│   │   ├── src/
│   │   │   ├── index.ts         # Express + Socket.IO setup
│   │   │   ├── routes/
│   │   │   │   ├── projects.ts
│   │   │   │   ├── agents.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   └── ai.ts
│   │   │   ├── services/
│   │   │   │   ├── ai-manager.ts    # LangChain integration
│   │   │   │   ├── notifier.ts      # Push notifications
│   │   │   │   ├── conflict-detector.ts
│   │   │   │   └── context-builder.ts
│   │   │   ├── ws/
│   │   │   │   └── socket-handler.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.sql
│   │   │   │   ├── migrations/
│   │   │   │   └── queries.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   └── validate.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                     # Frontend React
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ProjectView.tsx
│   │   │   │   ├── MessagesView.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── AgentStatus.tsx
│   │   │   │   ├── NotificationBell.tsx
│   │   │   │   ├── BlockerAlert.tsx
│   │   │   │   └── AISuggestion.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.ts
│   │   │   │   ├── useNotifications.ts
│   │   │   │   └── useProject.ts
│   │   │   ├── services/
│   │   │   │   └── api.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── sdk/                     # SDK/Client pras IAs usarem
│       ├── src/
│       │   └── index.ts         # Wrapper simples: post(), read(), reply()
│       ├── package.json
│       └── README.md            # Instruções pra configurar nas IAs
│
├── docker-compose.yml           # Subir tudo com um comando
├── .env.example
└── README.md
```

---

## 10. SDK para IAs

Um pacote minimalista que qualquer IA pode usar (ou instruções de curl):

```typescript
// packages/sdk/src/index.ts
class AiDlcClient {
  constructor(serverUrl: string, agentKey: string) {}

  // Posta mensagem
  async post(projectId: string, message: {
    type: MessageType;
    content: string;
    to?: string;
    priority?: Priority;
    metadata?: Record<string, any>;
  }): Promise<Message> {}

  // Lê mensagens pendentes pra mim
  async pending(projectId: string): Promise<Message[]> {}

  // Lê mensagens recentes
  async read(projectId: string, options?: {
    since?: string;
    type?: string;
    limit?: number;
  }): Promise<Message[]> {}

  // Responde uma mensagem
  async reply(projectId: string, messageId: string, content: string): Promise<Message> {}

  // Atualiza meu status
  async setStatus(status: 'idle' | 'working' | 'waiting'): Promise<void> {}

  // Pega contexto gerado pelo AI Manager
  async getContext(projectId: string): Promise<string> {}
}
```

### Uso com curl (pra IAs que não têm SDK):

```bash
# Postar status
curl -X POST http://localhost:3001/api/projects/abc123/messages \
  -H "X-Agent-Key: minha-key" \
  -H "Content-Type: application/json" \
  -d '{"type":"status","content":"Terminei o módulo X"}'

# Ver pendências
curl http://localhost:3001/api/projects/abc123/pending/meu-agent-id \
  -H "X-Agent-Key: minha-key"
```

---

## 11. Fluxo Típico de Uso

```
1. Rodrigo cria projeto no dashboard
2. Registra agentes (Kiro, Claude, Cursor)
3. Adiciona instrução no system prompt de cada IA:
   "Ao terminar uma tarefa ou ter dúvida, chame:
    curl POST http://localhost:3001/api/projects/X/messages ..."
4. IAs trabalham e postam updates
5. AI Manager monitora em background
6. Quando há blocker → Rodrigo recebe push notification
7. Rodrigo responde pelo dashboard ou celular
8. IA recebe resposta no próximo GET /pending
9. Ciclo continua até projeto concluído
```

---

## 12. Roadmap

### MVP (v0.1) — 1ª semana
- [ ] Backend: CRUD projetos, agentes, mensagens
- [ ] SQLite setup
- [ ] WebSocket básico (new_message)
- [ ] Frontend: Dashboard + lista de projetos + chat view
- [ ] Auth por API key

### v0.2 — 2ª semana
- [ ] AI Manager: classificador de mensagens
- [ ] Sistema de notificações (browser push)
- [ ] Filtros e busca de mensagens
- [ ] Threads

### v0.3 — 3ª semana
- [ ] AI Manager: auto-responder
- [ ] AI Manager: detector de conflitos
- [ ] AI Manager: gerador de contexto
- [ ] SDK package

### v1.0 — 4ª semana
- [ ] Dashboard completo com métricas
- [ ] Decisões log
- [ ] Export de histórico (.md)
- [ ] Docker compose pra deploy
- [ ] Documentação completa

---

## 13. Exemplo de System Prompt pra IA

Instrução que você coloca no system prompt de cada IA que participa:

```
## AI-DLC Integration

Você está participando de um projeto coordenado via AI-DLC.
Servidor: http://localhost:3001
Seu Agent Key: {SUA_KEY}
Projeto ID: {PROJECT_ID}

### Regras:
1. Ao COMEÇAR uma tarefa: POST type="task_start"
2. Ao TERMINAR uma tarefa: POST type="task_done"
3. Se tiver DÚVIDA sobre algo que outro agente fez: POST type="question" com to_agent_id
4. Se estiver TRAVADO: POST type="blocker" com priority="critical"
5. Se tomar uma DECISÃO arquitetural: POST type="decision"
6. ANTES de mexer em arquivo que outro agente pode estar usando: GET /pending pra checar conflitos

### Verificação periódica:
A cada conclusão de subtarefa, faça GET /pending/{seu_id} pra ver se alguém te perguntou algo.

### Formato:
POST http://localhost:3001/api/projects/{PROJECT_ID}/messages
Headers: X-Agent-Key: {SUA_KEY}, Content-Type: application/json
Body: {"type": "...", "content": "...", "priority": "normal"}
```

---

*Documento gerado para o projeto AI-DLC. Versão 1.0*