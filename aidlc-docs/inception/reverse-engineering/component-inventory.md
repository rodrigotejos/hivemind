# Component Inventory

## Application Packages

- **`@ai-dlc/server`** (`packages/server`):
  - Purpose: Express HTTP & Socket.IO backend service handling state, database queries, notifications, and AI analysis.
- **`web`** (`packages/web`):
  - Purpose: React 19 + Vite frontend dashboard displaying real-time collaboration metrics, message feed, blocker resolution cockpit, and shared context viewer.

## Shared Packages

- **`@ai-dlc/sdk`** (`packages/sdk`):
  - Purpose: Client integration library (`AiDlcClient`) providing typed communication helpers for AI worker agents.

## Infrastructure & Scripts

- **`clean-bi.js`**:
  - Purpose: Reset database and initialize a clean workspace (`dashboard-bi`) with standard agent seeds.
- **`simulate.js` / `simulate-bi.js`**:
  - Purpose: Multi-agent asynchronous conversation and blocker traffic simulation test scripts.

## Total Count

- **Total Monorepo Packages**: 3
  - Application Backend: 1 (`@ai-dlc/server`)
  - Application Frontend: 1 (`web`)
  - Shared SDK: 1 (`@ai-dlc/sdk`)
- **Root Auxiliary Scripts**: 3
