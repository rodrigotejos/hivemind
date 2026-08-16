# Feature Functional Design: Task Sessions & Context Isolation

## 1. Context Isolation Architecture

### 1.1 Motivação & Regra de Negócio
Ao trabalhar em um projeto de grande porte, desenvolvedores executam múltiplas tarefas distintas em momentos diferentes:
- *Exemplo 1*: Sessão de implementação da Tela de Checkout (Figma -> Frontend -> Backend -> QA).
- *Exemplo 2*: Sessão de implementação de Autenticação OAuth.
- *Exemplo 3*: Sessão de Bugfix ou Refatoração da Tela de Checkout semanas depois.

**Requisito de Isolamento**:
- As mensagens, debates e turnos de agentes da Tarefa 1 não podem poluir ou vazar contexto para a Tarefa 2.
- Cada Sessão de Tarefa possui seu próprio fluxo de mensagens no chat, seu próprio `sessionId` / `threadId` e seu próprio estado do LangGraph.
- O `shared_context` (Live Wiki do Projeto) permanece compartilhado para que todos os agentes conheçam a verdade arquitetural comum do repositório, mas cada sessão opera de maneira isolada.

---

## 2. Modelagem de Dados & Backend

### 2.1 Tabela `task_sessions`
```sql
CREATE TABLE IF NOT EXISTS task_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'running', 'completed', 'archived'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 2.2 Associação de Mensagens e Grafo
- `messages.thread_id`: Armazena o `sessionId` correspondente.
- `LangGraphOrchestrator`: As chaves de estado de execução passam a ser `session_${sessionId}` em vez de apenas `projectId`, permitindo múltiplos grafos independentes simultâneos no mesmo projeto.

---

## 3. Interface de Usuário (MessagesView & Cockpit Integrado)

### 3.1 Layout de 3 Colunas na Live Terminal
1. **Painel Lateral Esquerdo (Sessões / Tópicos de Tarefa)**:
   - Botão `[+ Nova Sessão de Tarefa]`.
   - Lista de sessões com título, badge de status e contagem de mensagens.
   - Opção "Geral / Raiz".
2. **Coluna Central (Chat da Sessão & Cockpit Integrado)**:
   - No topo: O **Comando Central LangGraph (Cockpit)** contextualizado para a sessão ativa.
   - Centro: Feed de mensagens exclusivo da sessão selecionada.
   - Base: Input para envio de mensagens humanas direcionadas à sessão.
3. **Painel Lateral Direito (Contexto Compartilhado / Live Wiki)**:
   - Exibição em tempo real do `shared_context` consolidado do projeto.
