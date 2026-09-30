# Build Instructions: Hivemind AI-DLC (Iteration 3)

## Prerequisites
- **Node.js**: v20+ ou v24+
- **NPM**: v10+ (Workspaces habilitados)
- **TypeScript**: v5.1.6+
- **Vite**: v8.1.3+
- **SQLite**: Node.js built-in `node:sqlite` ou driver compatível

---

## Build Steps

### 1. Instalação de Dependências
Na raiz do monorepo:
```bash
npm install
```

### 2. Configuração de Variáveis de Ambiente
Certifique-se de que os arquivos de configuração local existam:
- `packages/server/.env`:
  ```bash
  PORT=3001
  NODE_ENV=development
  CORS_ORIGIN=http://localhost:5173
  ```
- `packages/web/.env`:
  ```bash
  VITE_API_URL=http://localhost:3001
  ```

### 3. Build do Servidor Backend (`@ai-dlc/server`)
```bash
npm run build -w @ai-dlc/server
```
Compila o TypeScript de `packages/server/src` para `packages/server/dist`.
- **Artefato gerado**: `packages/server/dist/index.js`, `packages/server/dist/services/security-pipeline.js`, etc.

### 4. Build da Aplicação Frontend Web (`web`)
```bash
npm run build -w web
```
Executa `tsc -b && vite build`.
- **Artefato gerado**: `packages/web/dist/` (`index.html`, `assets/index-*.js`, `assets/index-*.css`).

### 5. Verificação de Sucesso
- Saída esperada: Ambos os comandos retornam exit code 0 sem avisos críticos.
- Teste de integridade de tipos: Verificado com 0 erros TS.
