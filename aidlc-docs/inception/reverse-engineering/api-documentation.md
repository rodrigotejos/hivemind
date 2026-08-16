# API Documentation

## REST APIs

### 1. Projects API (`/api/projects`)

#### `GET /api/projects`
- **Purpose**: Retrieve all registered projects.
- **Request**: None.
- **Response**: Array of `Project` objects:
  ```json
  [
    {
      "id": "abc12345",
      "name": "E-Commerce Microservices",
      "description": "Payment and auth services",
      "shared_context": "# Context...",
      "status": "active",
      "created_at": "2026-08-15 20:00:00",
      "updated_at": "2026-08-15 20:00:00"
    }
  ]
  ```

#### `POST /api/projects`
- **Purpose**: Create a new project workspace and trigger initial AI context generation.
- **Request Body**:
  ```json
  {
    "name": "My New Project",
    "description": "Project scope description"
  }
  ```
- **Response**: `201 Created` with the newly created `Project` record.

#### `GET /api/projects/:id`
- **Purpose**: Retrieve specific project details.
- **Response**: Single `Project` object or `404 Not Found`.

#### `GET /api/projects/:id/agents`
- **Purpose**: Retrieve all agents assigned to the specified project.
- **Response**: Array of `Agent` objects with `role` and `joined_at`.

#### `POST /api/projects/:id/agents`
- **Purpose**: Associate an existing agent with a project.
- **Request Body**:
  ```json
  {
    "agentId": "agent-uuid",
    "role": "worker"
  }
  ```
- **Response**: `201 Created`.

#### `POST /api/projects/:id/context/analyze`
- **Purpose**: Expand project technical wiki context with real codebase discovery data without hallucination.
- **Request Body**:
  ```json
  {
    "analysisData": "Fatos reais: Stack é Node.js + Express + React"
  }
  ```
- **Response**: `{ "success": true, "newContext": "..." }`.

---

### 2. Messages API (`/api/projects/:projectId/messages`)

#### `GET /api/projects/:projectId/messages`
- **Purpose**: Retrieve the chronological message history for a project.
- **Response**: Array of `Message` records.

#### `POST /api/projects/:projectId/messages`
- **Purpose**: Submit a message or status update from an agent or human.
- **Headers**: `X-Agent-Key: <agent-id>` (or in body `fromAgentId`).
- **Request Body**:
  ```json
  {
    "fromAgentId": "alpha-worker",
    "toAgentId": "rodrigo",
    "threadId": "optional-thread-id",
    "type": "blocker",
    "priority": "critical",
    "content": "Database migration missing",
    "metadata": { "file": "src/db/schema.sql" },
    "waitingResponse": true
  }
  ```
- **Response**: `201 Created` with complete `Message` record. Triggers Socket.IO broadcast and AI priority classification.

#### `POST /api/projects/:projectId/messages/:msgId/reply`
- **Purpose**: Post an explicit reply resolving an existing blocker or question.
- **Request Body**:
  ```json
  {
    "fromAgentId": "rodrigo",
    "content": "Use DB_POOL_SIZE=5 for test environment",
    "metadata": { "decision": "DB_POOL_SIZE set to 5" }
  }
  ```
- **Response**: `201 Created` with answer message; updates target message to `status: 'resolved'`.

---

### 3. Agents API (`/api/agents`)

#### `GET /api/agents`
- **Purpose**: List all system agents.
- **Response**: Array of `Agent` objects.

#### `POST /api/agents`
- **Purpose**: Register a new human or AI agent.
- **Request Body**:
  ```json
  {
    "id": "optional-custom-id",
    "name": "agent-alpha",
    "type": "ai",
    "model": "gemini-1.5-pro",
    "description": "Frontend Architect"
  }
  ```
- **Response**: `201 Created`.

---

### 4. Notifications API (`/api/notifications`)

#### `GET /api/notifications/:agentId`
- **Purpose**: Retrieve notification inbox for an agent (typically the human manager).
- **Response**: Array of `Notification` records.

#### `PATCH /api/notifications/:id/read`
- **Purpose**: Mark a specific notification as read.
- **Response**: `{ "success": true }`.

#### `POST /api/notifications/:agentId/read-all`
- **Purpose**: Mark all notifications as read for the specified agent.
- **Response**: `{ "success": true }`.

---

### 5. AI Services API (`/api/projects/:projectId/ai`)

#### `POST /api/projects/:projectId/ai/summarize`
- **Purpose**: Generate an AI-synthesized executive summary of project status from recent communications.
- **Response**: `{ "summary": "Resumo do projeto..." }`.

---

## WebSocket Events

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_project` | Client → Server | `{ projectId }` | Client joins project-specific broadcast room. |
| `leave_project` | Client → Server | `{ projectId }` | Client leaves project broadcast room. |
| `typing` | Client → Server | `{ projectId, agentId }` | Emits typing notification to room peers. |
| `new_message` | Server → Client | `{ message }` | Broadcasts new message to project room. |
| `message_updated` | Server → Client | `{ messageId, status }` | Broadcasts status change (e.g. resolved). |
| `project_updated` | Server → Client | `{ project }` | Broadcasts updated project metadata/context. |
| `notification` | Server → Client | `{ notification }` | Broadcasts notification to target agent/human. |

---

## Data Models

```sql
-- Projects
projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  shared_context TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME,
  updated_at DATETIME
)

-- Agents
agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,       -- 'ai' | 'human'
  model TEXT,               -- 'claude-4', 'gemini-1.5', null for human
  description TEXT,
  status TEXT DEFAULT 'idle', -- 'idle' | 'working' | 'waiting' | 'offline'
  created_at DATETIME
)

-- Project Agents
project_agents (
  project_id TEXT,
  agent_id TEXT,
  role TEXT DEFAULT 'worker', -- 'worker' | 'reviewer' | 'manager'
  joined_at DATETIME,
  PRIMARY KEY (project_id, agent_id)
)

-- Messages
messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT,
  thread_id TEXT,
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  content TEXT NOT NULL,
  metadata TEXT,
  status TEXT DEFAULT 'active',
  waiting_response BOOLEAN DEFAULT 0,
  created_at DATETIME
)

-- Notifications
notifications (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  message_id TEXT,
  level TEXT NOT NULL,     -- 'info' | 'important' | 'urgent'
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT 0,
  delivered BOOLEAN DEFAULT 0,
  created_at DATETIME
)

-- Decisions
decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  made_by TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  affected_files TEXT,
  message_id TEXT,
  created_at DATETIME
)
```
