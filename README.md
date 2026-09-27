# Hivemind — AI-DLC (AI Development Lifecycle Coordinator)

O **Hivemind** é um orquestrador avançado projetado para gerenciar a comunicação, colaboração e governança de múltiplos agentes de Inteligência Artificial e humanos trabalhando em projetos de código conforme o ciclo **AI-DLC** (AI-Driven Development Life Cycle).

O sistema expõe uma API REST/WebSockets para os agentes trocarem logs, decisões e impedimentos, enquanto o coordenador humano acompanha o progresso em tempo real pelo **Cockpit Dashboard**.

---

## 🏛️ Arquitetura e Inovações (Iteração 2: Units 1, 2 & 3)

### 1. 🛡️ Structured Output com Reflection Loop (US-5, Security Baseline)
- **Validação Estrita via Zod**: Classificação e triagem de mensagens (`MessagePrioritySchema`) sem uso de expressões regulares frágeis.
- **Autocorreção da LLM (Reflection Loop)**: Se a resposta da LLM violar o schema JSON, o erro detalhado do Zod é reenviado automaticamente para a LLM se autocorrigir (até 2 tentativas) antes de lançar erro controlado.

### 2. 🪟 Sliding Window & Sumarização Recursiva (US-6, Performance)
- **Token Budgeting Inteligente**: O método `calculateTokenWindow` analisa o consumo real de tokens. Quando o histórico excede o orçamento de segurança, mensagens antigas são condensadas recursivamente em uma âncora `[RESUMO DO HISTÓRICO ANTERIOR]`, mantendo as mensagens recentes intactas.

### 3. 📑 Prompt Registry Desacoplado com Hot-Reload (US-7)
- **Zero Strings Hardcoded**: Prompts de agentes residem em `packages/server/prompts/*.json` (`triage.json`, `beta_backend.json`, `gamma_qa.json`, `delta_security.json`, etc.).
- **Hot-Reload em Tempo Real**: Carregamento dinâmico com checagem de `mtime`, permitindo alterar diretivas sem reiniciar o servidor.
- **Proteção Anti-Injection**: Sanitização automática de delimitadores de sistema (`<system>`, `<instructions>`).

### 4. 💓 Heartbeat Lease Manager (US-8, Resiliency Baseline)
- **Eliminação de Timeouts Rígidos**: Substituição do timeout estático de 300000ms por leases renováveis de 60 segundos com base na emissão de chunks pelo subprocesso.
- **Encerramento Gracioso em Duas Fases**: `SIGTERM` imediato com janela de carência (grace period de 5s) antes de aplicar `SIGKILL`.

### 5. ⚡ Real-Time Token Streaming & Thinking Feedback (US-1, UX)
- **Streaming Token a Token**: Função assíncrona `streamChat` transmitindo deltas de texto da API Google Gemini diretamente para os clientes via Socket.IO (`agent_typing`).
- **Cockpit Visual Feedback**: Cursor monoespaciado pulsante `▋` (`animate-pulse text-indigo-400 font-mono`), badge "Digitando..." e indicador "Thinking..." em tempo real.

### 6. 🔄 Adaptive Backoff com Jitter & Auto-Recovery (US-2, Resiliency Baseline)
- **Detecção Granular de Erros**: Identificação automática de Rate Limits (429 / Resource Exhausted com base de 10s), falhas transitórias de infraestrutura (503 com base de 2s) e headers explícitos `retry-after`.
- **Prevenção de Efeito Manada (Jitter ±15%)**: Ruído pseudo-aleatório em cada intervalo de retentativa, teto de 60s e até 5 tentativas com auto-recuperação.
- **Toasts Flutuantes Não-Intrusivos (`RecoveryToast.tsx`)**: Notificação Dark Glassmorphism flutuante no Cockpit com barra de progresso regressiva em segundos e auto-dismiss com verde esmeralda no sucesso (`recovered`).

### 7. 🛑 Human-in-the-Loop Fallback & Pausa no Grafo (US-3)
- **Suspensão Graciosa do Grafo LangGraph**: Se todas as 5 retentativas falharem, o nó do agente transiciona para `status: 'waiting_human'`, preserva o checkpoint da tarefa e emite um evento de bloqueio `human_gate` com contexto de erro para intervenção do operador.

### 8. 🔀 Git Supervisor & ExecFile Safety (US-4, Security Baseline)
- **Execução Atômica Segura**: Invocação do Git CLI via `execFile` com arrays de argumentos atômicos, eliminando riscos de shell command injection.
- **Bloqueio Rígido de Arquivos Sensíveis**: Detecção preventiva de arquivos como `.env*`, `*.pem`, `*.key`, `id_rsa*` e `credentials.json`, bloqueando o commit com `SENSITIVE_FILE_VIOLATION`.

### 9. 🛡️ Rejeição Resiliente com Backup Automático (US-4, Resiliency Baseline)
- **Zero Data Loss**: Ao rejeitar modificações no Cockpit, o sistema cria automaticamente uma branch de backup temporária (`backup/rejected-<timestamp>`) contendo as alterações antes de reverter a working tree com `git reset --hard HEAD` e `git clean -fd`.

### 10. 📝 Sugestão Semântica Conventional Commits (US-4)
- **Inferência Inteligente**: Sugestão automática de mensagens no padrão semântico (`feat(...)`, `fix(...)`, `docs(...)`, etc.) baseada no contexto da tarefa e nos arquivos modificados, totalmente editável pelo operador humano.

### 11. 🧪 Property-Based Testing com `fast-check` (PBT Baseline)
- Testes procedurais com centenas de execuções aleatórias garantindo 12 invariantes:
  - `PBT-U1-01`: Invariante de orçamento de tokens nunca violada.
  - `PBT-U1-02`: Conformidade estrita com schemas Zod.
  - `PBT-U1-03`: Integridade de sanitização contra injeções.
  - `PBT-U1-04`: Monotonicidade determinística da expiração de leases.
  - `PBT-U2-01`: Monotonicidade do backoff exponencial e teto máximo de 60s.
  - `PBT-U2-02`: Limites rígidos do ruído randômico de jitter [0.85 * nominal, 1.15 * nominal].
  - `PBT-U2-03`: Integridade absoluta de concatenação do stream de deltas.
  - `PBT-U2-04`: Limite estrito de tentativas antes de declarar falha crítica e pausa.
  - `PBT-U3-01`: Detecção 100% de arquivos sensíveis sob variações de caminho.
  - `PBT-U3-02`: Não-bloqueio de arquivos de código seguros legítimos.
  - `PBT-U3-03`: Conformidade sintática da mensagem no padrão Conventional Commits.
  - `PBT-U3-04`: Unicidade e conformidade de refnames de branch de backup do Git.

---

## 🚀 Como Iniciar e Usar

Siga os comandos abaixo a partir da raiz do repositório:

### 1. Instalar as Dependências
Instala todos os pacotes dos workspaces do monorepo (SDK, Server e Web):
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Certifique-se de que os arquivos `.env` na raiz e em `packages/server/` possuam a chave de API do Google configurada:
```env
PORT=3001
NODE_ENV=development
GOOGLE_API_KEY=sua_chave_aqui
```

### 3. Compilar os Workspaces
Compila o código TypeScript em todos os pacotes (Backend e Frontend):
```bash
npm run build -w @ai-dlc/server
npm run build -w web
```

### 4. Rodar a Suíte Completa de Testes (Unit & PBT)
Para rodar todos os testes unitários e de propriedades das Units 1, 2 e 3:
```powershell
cd packages/server
$env:NODE_ENV="test"

# Testes Unitários (25 testes)
npx ts-node -T tests/unit/git-supervisor.test.ts
npx ts-node -T tests/unit/adaptive-backoff.test.ts
npx ts-node -T tests/unit/prompt-registry.test.ts
npx ts-node -T tests/unit/sliding-window.test.ts
npx ts-node -T tests/unit/structured-output.test.ts
npx ts-node -T tests/unit/heartbeat-lease-manager.test.ts

# Testes de Propriedades PBT (12 invariantes / 1.050 iterações aleatórias)
npx ts-node -T tests/pbt/unit-1-invariants.test.ts
npx ts-node -T tests/pbt/unit-2-invariants.test.ts
npx ts-node -T tests/pbt/unit-3-invariants.test.ts
```

### 5. Rodar o Servidor de Desenvolvimento
Inicia concorrentemente o SDK, o servidor backend (na porta `3001`) e o painel frontend web (na porta `5173`):
```bash
npm run dev
```

---

## 🛠️ Scripts Úteis (Comandos Adicionais)

* **Iniciar Projeto Limpo (`dashboard-bi`)**:
  Limpa todas as simulações e registros do banco de dados SQLite e inicializa um workspace vazio do `dashboard-bi` com apenas você (`rodrigo`) vinculado:
  ```bash
  node clean-bi.js
  ```
  *(Recomendado para quando for conectar os seus agentes de chat reais)*

* **Executar Simulação de Teste**:
  Limpa o banco e roda um fluxo realista de mensagens simuladas entre 3 IAs (`Alpha`, `Beta`, `Gama`) e o humano:
  ```bash
  node simulate-bi.js
  ```

---

## 📑 Registro do AI-DLC e Documentação
Toda a documentação gerada pelo fluxo AI-DLC encontra-se estruturada em `aidlc-docs/`:
- `aidlc-docs/inception/`: Requirements analysis, user stories, application design e unit of work.
- `aidlc-docs/construction/`: Functional designs, code generation summaries e relatórios de build & test de cada unidade.
- `aidlc-docs/audit.md`: Log de auditoria formal de cada decisão e aprovação humana.
