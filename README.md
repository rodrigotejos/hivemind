# Hivemind — AI-DLC (AI Development Lifecycle Coordinator)

O **Hivemind** é um orquestrador avançado projetado para gerenciar a comunicação, colaboração e governança de múltiplos agentes de Inteligência Artificial e humanos trabalhando em projetos de código conforme o ciclo **AI-DLC** (AI-Driven Development Life Cycle).

O sistema expõe uma API REST/WebSockets para os agentes trocarem logs, decisões e impedimentos, enquanto o coordenador humano acompanha o progresso em tempo real pelo **Cockpit Dashboard**.

---

## 🏛️ Arquitetura e Inovações (Iteração 2 - Unit 1)

### 1. 🛡️ Structured Output com Reflection Loop (US-5, Security Baseline)
- **Validação Estrita via Zod**: Classificação e triagem de mensagens (`MessagePrioritySchema`) sem uso de expressões regulares frágeis.
- **Autocorreção da LLM (Reflection Loop)**: Se a resposta da LLM violar o schema JSON, o erro detalhado do Zod é reenviado automaticamente para a LLM se autocorrigir (até 2 tentativas) antes de lançar erro controlado.

### 2. 🪟 Sliding Window & Sumarização Recursiva (US-6, Performance)
- **Token Budgeting Inteligente**: O método `calculateTokenWindow` analisa o consumo real de tokens. Quando o histórico excede o orçamento de segurança, mensagens antigas são condensadas recursivamente em uma âncora `[RESUMO DO HISTÓRICO ANTERIOR]`, mantendo as mensagens recentes intactas.

### 3. 📄 Prompt Registry Desacoplado com Hot-Reload (US-7)
- **Zero Strings Hardcoded**: Prompts de agentes residem em `packages/server/prompts/*.json` (`triage.json`, `beta_backend.json`, `gamma_qa.json`, `delta_security.json`, etc.).
- **Hot-Reload em Tempo Real**: Carregamento dinâmico com checagem de `mtime`, permitindo alterar diretivas sem reiniciar o servidor.
- **Proteção Anti-Injection**: Sanitização automática de delimitadores de sistema (`<system>`, `<instructions>`).

### 4. 💓 Heartbeat Lease Manager (US-8, Resiliency Baseline)
- **Eliminação de Timeouts Rígidos**: Substituição do timeout estático de 300000ms por leases renováveis de 60 segundos com base na emissão de chunks pelo subprocesso.
- **Encerramento Gracioso em Duas Fases**: `SIGTERM` imediato com janela de carência (grace period de 5s) antes de aplicar `SIGKILL`.

### 5. 🧪 Property-Based Testing com `fast-check` (PBT Baseline)
- Testes procedurais com centenas de execuções aleatórias garantindo:
  - `PBT-U1-01`: Invariante de orçamento de tokens nunca violada.
  - `PBT-U1-02`: Conformidade estrita com schemas Zod.
  - `PBT-U1-03`: Integridade de sanitização contra injeções.
  - `PBT-U1-04`: Monotonicidade determinística da expiração de leases.

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
Compila o código TypeScript em todos os pacotes:
```bash
npm run build
```

### 4. Rodar a Suíte de Testes (Unit & PBT)
Para rodar os testes unitários e de propriedades da Unit 1:
```bash
cd packages/server
npx ts-node -T tests/unit/prompt-registry.test.ts
npx ts-node -T tests/unit/sliding-window.test.ts
npx ts-node -T tests/unit/structured-output.test.ts
npx ts-node -T tests/unit/heartbeat-lease-manager.test.ts
npx ts-node -T tests/pbt/unit-1-invariants.test.ts
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

## 📁 Registro do AI-DLC e Documentação
Toda a documentação gerada pelo fluxo AI-DLC encontra-se estruturada em `aidlc-docs/`:
- `aidlc-docs/inception/`: Requirements analysis, user stories, application design e unit of work.
- `aidlc-docs/construction/`: Functional designs, code generation summaries e relatórios de build & test.
- `aidlc-docs/audit.md`: Log de auditoria formal de cada decisão e aprovação humana.
