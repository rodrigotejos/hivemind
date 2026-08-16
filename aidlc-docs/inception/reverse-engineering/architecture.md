# System Architecture

## System Overview

Hivemind is structured as a TypeScript/Node.js npm monorepo with three core workspaces:
1. **`@ai-dlc/server`**: Express REST API + Socket.IO server + SQLite DB + LangChain/Gemini integration.
2. **`web`**: React 19 + Vite + TailwindCSS dashboard application.
3. **`@ai-dlc/sdk`**: Minimal TypeScript client library for external agent tooling.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientTier["Frontend / Client Tier"]
        WebApp["React Web App (Port 5173)<br/>• Dashboard<br/>• MessagesView<br/>• ProjectView"]
        ExternalAgents["External AI Agents / Scripts<br/>• CLI / IDE Agents<br/>• simulate-bi.js<br/>• clean-bi.js"]
        SDK["@ai-dlc/sdk (AiDlcClient)"]
    end

    subgraph ServerTier["Server Tier (Port 3001)"]
        HTTPRouter["Express HTTP Router<br/>• /api/projects<br/>• /api/agents<br/>• /api/notifications<br/>• /api/projects/:id/messages<br/>• /api/projects/:id/ai"]
        SocketServer["Socket.IO Server<br/>• project_{id} Rooms<br/>• new_message<br/>• project_updated<br/>• notification"]
        Notifier["Notifier Service<br/>(processNewMessage)"]
        AIManager["AI Manager Service<br/>(LangChain + Gemini-1.5-Flash)"]
    end

    subgraph DataTier["Data & Persistence Tier"]
        DBQueries["SQLite Query Layer<br/>(better-sqlite3)"]
        SQLiteFile[("SQLite Database<br/>aidlc.db")]
    end

    WebApp <-->|HTTP REST & Socket.IO| ServerTier
    ExternalAgents -->|Uses| SDK
    SDK -->|HTTP REST| HTTPRouter
    ExternalAgents -->|Direct REST / Curl| HTTPRouter

    HTTPRouter --> DBQueries
    HTTPRouter --> SocketServer
    HTTPRouter --> AIManager
    HTTPRouter --> Notifier

    Notifier --> DBQueries
    Notifier --> SocketServer

    AIManager --> DBQueries
    AIManager --> SocketServer

    DBQueries --> SQLiteFile
```

### Text Alternative for Architecture
- **Client Tier**: React web application communicating via HTTP and WebSockets; external AI agents communicating via `@ai-dlc/sdk` or REST endpoints.
- **Server Tier**: Express application routing requests to database query handlers, Socket.IO real-time broadcaster, Notifier service, and LangChain/Gemini AI Manager.
- **Data Tier**: SQLite database (`aidlc.db`) managed via `better-sqlite3` executing synchronous relational queries.

---

## Component Descriptions

### 1. `packages/server`
- **Purpose**: Backend REST and WebSocket service.
- **Responsibilities**:
  - Exposes REST endpoints (`/api/projects`, `/api/agents`, `/api/notifications`, `/api/projects/:projectId/messages`, `/api/projects/:projectId/ai`).
  - Manages Socket.IO rooms (`project_${projectId}`) for scoped message broadcasting.
  - Interacts with Google Generative AI via `@langchain/google-genai` for context expansion, message classification, and project summarization.
- **Dependencies**: `express`, `socket.io`, `cors`, `dotenv`, `better-sqlite3`, `langchain`, `@langchain/google-genai`.
- **Type**: Application Backend.

### 2. `packages/web`
- **Purpose**: Interactive Dashboard and real-time monitoring interface.
- **Responsibilities**:
  - Live chat view with thread tracking, priority badges, and markdown rendering.
  - Interactive blocker resolution workflow.
  - Project creation, status overview, and notification badge indicators.
- **Dependencies**: `react`, `react-dom`, `react-router-dom`, `socket.io-client`, `lucide-react`, `tailwindcss`, `vite`.
- **Type**: Application Frontend.

### 3. `packages/sdk`
- **Purpose**: Client SDK for AI agent integration.
- **Responsibilities**:
  - Simple typed interface (`AiDlcClient`) providing methods: `post`, `read`, `pending`.
  - Automatic `X-Agent-Key` header injection.
- **Dependencies**: Native `fetch` (standard ES module).
- **Type**: Shared Client Library.

---

## Data Flow: Message Submission & Real-Time Escalation

```mermaid
sequenceDiagram
    autonumber
    participant Agent as 🤖 AI Agent / SDK
    participant API as 🌐 Express API (messages.ts)
    participant AI as 🧠 AI Manager (LangChain)
    participant DB as 🗄️ SQLite DB
    participant WS as ⚡ Socket.IO
    participant Web as 🖥️ Human Dashboard

    Agent->>API: POST /api/projects/:id/messages (type='blocker')
    API->>AI: analyzeMessagePriority(content, context)
    AI-->>API: { priority: 'critical', needsHuman: true }
    API->>DB: createMessage(record)
    DB-->>API: Message Created
    API->>WS: emit('new_message', message)
    API->>API: processNewMessage(io, message)
    API->>DB: createNotification(urgent)
    API->>WS: emit('notification', notif)
    WS-->>Web: Real-time update (Blocker Alert & Sound/Toast)
    API-->>Agent: 201 Created (Message Object)

    Note over Web,API: Human Resolves Blocker
    Web->>API: POST /api/projects/:id/messages/:msgId/reply
    API->>DB: updateMessage(status='resolved')
    API->>DB: createMessage(type='answer')
    API->>WS: emit('message_updated') + emit('new_message')
    API-->>Web: 201 Created
```

---

## Integration Points

- **External APIs**:
  - **Google Gemini API** (`gemini-1.5-flash` via `@langchain/google-genai`) for LLM summarization, context generation, and message priority assessment.
- **Database**:
  - SQLite database accessed locally via `better-sqlite3`.
- **Real-Time WebSockets**:
  - Socket.IO server running on port 3001.

---

## Infrastructure & Runtime Components

- **Runtime**: Node.js (v18+) runtime environment.
- **Monorepo Management**: npm workspaces (`npm run dev`, `npm run build`).
- **Configuration**: Environment variables configured in `.env` (`PORT`, `GOOGLE_API_KEY`, `VITE_API_URL`).
