# Build Instructions - Iteration 2 (Units 1 & 2)

## Prerequisites
- **Node.js**: v20+ ou v22+
- **TypeScript**: v5.1.6
- **Vite**: v8.1.3
- **Workspaces**: `@ai-dlc/server`, `web`

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Server Package (Backend)
```bash
npm run build -w @ai-dlc/server
```
- **Tool**: TypeScript (`tsc`)
- **Output**: `packages/server/dist/` (0 compilation errors)

### 3. Build Web Package (Frontend)
```bash
npm run build -w web
```
- **Tool**: TypeScript & Vite (`tsc -b && vite build`)
- **Output**: `packages/web/dist/` (0 compilation errors, assets minified)

### 4. Verify Monorepo Build
```bash
npm run build -w @ai-dlc/server && npm run build -w web
```
