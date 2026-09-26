# Build Instructions - Unit 1: Infraestrutura de LLM & Segurança

## Prerequisites
- **Node.js**: v20+ ou v22+
- **TypeScript**: v5.1.6
- **Workspace**: `@ai-dlc/server`

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Server Package
```bash
npm run build -w @ai-dlc/server
```

### 3. Expected Output
- Saída limpa de compilação TypeScript via `tsc`.
- Artefatos gerados em `packages/server/dist/`.
