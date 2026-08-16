# Technology Stack

## Programming Languages

- **TypeScript** (`~5.4` / `^5.6`): Used across Server, Web, and SDK packages for static typing and contracts.
- **JavaScript (Node.js)**: Used for root simulation scripts (`simulate*.js`, `clean-bi.js`) and build configurations.
- **SQL (SQLite dialect)**: Relational table schemas and prepared queries.

## Frameworks & Libraries

### Backend (`packages/server`)
- **Node.js / Express** (`^4.19`): HTTP REST API server.
- **Socket.IO** (`^4.7`): Real-time bi-directional event distribution over WebSockets.
- **better-sqlite3** (`^11.1`): High-performance, synchronous SQLite bindings.
- **LangChain** (`^0.2`): Prompt templating and LLM pipeline orchestration.
- **@langchain/google-genai** (`^0.0.18`): Google Gemini SDK provider for LangChain (`gemini-1.5-flash`).
- **cors** & **dotenv**: Security middleware and environment variable management.

### Frontend (`packages/web`)
- **React 19** (`^19.0.0`): Declarative UI library.
- **React DOM** (`^19.0.0`): DOM rendering engine.
- **React Router DOM** (`^7.0`): Client-side single-page application routing.
- **Socket.IO Client** (`^4.7`): Real-time client WebSocket subscriber.
- **Lucide React** (`^0.460`): Modern UI icon system.
- **TailwindCSS** (`^3.4`) & **PostCSS**: Utility-first responsive CSS styling.

### Client SDK (`packages/sdk`)
- **ES2022 Fetch API**: Standard promise-based HTTP client without heavy external dependencies.

## Build & Tooling

- **Vite** (`^6.0`): High-speed frontend development server and bundler.
- **tsx** / **ts-node**: Direct TypeScript script execution in development.
- **concurrently**: Multi-process monorepo development runner.
- **npm workspaces**: Monorepo dependency resolution and package linking.
