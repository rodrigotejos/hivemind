# Application Design

# Components

## 1. AIManager Component (`server/src/services/ai-manager.ts`)
- **Purpose**: Classe central de orquestração de LLM (LangChain/Gemini).
- **Responsibilities**: Inicializar o LLM com as flags corretas (Structured Output), processar mensagens com sliding window de tokens, e invocar o provedor com retry em caso de timeout.
- **Interfaces**: Expõe métodos para conversação padrão, extração estruturada de JSON, e streaming iterável.

## 2. SocketGateway (`server/src/services/socket.ts` / UI Cockpit)
- **Purpose**: Canal de comunicação bidirecional em tempo real entre Engine e Cockpit.
- **Responsibilities**: Emitir chunks de texto (deltas) para o frontend concatenar, notificar status do agente (thinking, typing, erro, retrying).
- **Interfaces**: WebSockets Event Emitters.

## 3. PromptRegistry (`server/src/prompts/`)
- **Purpose**: Camada de armazenamento e recuperação de system prompts.
- **Responsibilities**: Ler arquivos Markdown do disco dinamicamente a cada nova requisição para suportar Hot-Reload.
- **Interfaces**: FileSystem I/O e métodos de cache local para evitar leituras excessivas em disco.

## 4. GitSupervisor (`server/src/services/git.ts`)
- **Purpose**: Sub-agente ou serviço que interage nativamente com o CLI do Git.
- **Responsibilities**: Criar novas branches, aplicar as modificações propostas pelo LLM no File System, gerar o Diff nativo, e efetuar o Merge/Commit se aprovado pela UI.
- **Interfaces**: ChildProcess (execução shell), retornos formatados do Git Status/Diff.

## 5. RecoveryCache (`server/src/services/cache.ts`)
- **Purpose**: Armazenamento de estado das retentativas do LLM.
- **Responsibilities**: Gravar o status "retrying" de um nó específico, para que possa ser consultado independentemente se o node process reiniciar (in-memory/Redis wrapper).
- **Interfaces**: Get/Set/TTL.


# Component Methods

## AIManager
- `public async streamChat(messages: BaseMessage[], schema?: z.ZodSchema): AsyncGenerator<Chunk>`
  - *Purpose*: Substitui o `invoke` padrão para suportar streaming de deltas ou Structured Output.
- `public calculateTokenWindow(messages: BaseMessage[], maxTokens: number): BaseMessage[]`
  - *Purpose*: Analisa o histórico e fatia dinamicamente as mensagens mantendo a integridade sem estourar o contexto.
- `private async executeWithRetry<T>(operation: () => Promise<T>, agentId: string): Promise<T>`
  - *Purpose*: Encapsula a chamada à API com backoff exponencial e notifica o `RecoveryCache` a cada tentativa.

## SocketGateway
- `public emitAgentTyping(projectId: string, agentId: string, chunkDelta: string)`
  - *Purpose*: Envia apenas o caractere/palavra nova para a UI anexar no balão de mensagem ativo.
- `public emitAgentStatus(projectId: string, agentId: string, status: 'thinking' | 'retrying' | 'error' | 'idle')`
  - *Purpose*: Controla a UI do Cockpit (toast notifications e skeletons).
- `public emitGitDiff(projectId: string, branchName: string, diffText: string)`
  - *Purpose*: Solicita a aprovação humana de um refactor de código no repositório.

## PromptRegistry
- `public async getPrompt(role: string): Promise<string>`
  - *Purpose*: Lê o arquivo Markdown respectivo (`.md`) e retorna o conteúdo atualizado.

## GitSupervisor
- `public async checkoutNewBranch(branchName: string): Promise<void>`
  - *Purpose*: Cria uma branch isolada para as edições do LangGraph.
- `public async generateDiff(targetBranch: string): Promise<string>`
  - *Purpose*: Executa `git diff main...branchName` e retorna o resultado.
- `public async mergeAndCommit(branchName: string, message: string): Promise<void>`
  - *Purpose*: Efetiva as alterações na base de código após aprovação da UI.

## RecoveryCache
- `public async setRetryState(agentId: string, attempt: number): Promise<void>`
- `public async getRetryState(agentId: string): Promise<number | null>`


# Services

## 1. LangGraphOrchestratorService
**Responsibilities**:
- Substituir a função monolítica em `nodes.ts` por um serviço mais robusto.
- Orquestrar a sequência: `PromptRegistry.getPrompt` -> `AIManager.calculateTokenWindow` -> `AIManager.streamChat` / `AIManager.executeWithRetry`.
- Atuar como o "Controller" emitindo side-effects pelo `SocketGateway`.

## 2. CommitApprovalService
**Responsibilities**:
- Escutar os eventos de resposta do Cockpit (quando o usuário clica em "Aprovar Commit" ou "Rejeitar").
- Invocar o `GitSupervisor` para aplicar o Merge ou deletar a branch dependendo da decisão do Human Supervisor.

## 3. TelemetryTokenService
**Responsibilities**:
- Manter controle rígido dos gastos da API e repassar ao `AIManager` o tamanho dos arrays de mensagens para auxiliar na técnica de Sliding Window.


# Component Dependencies

## Dependency Matrix

| Component | Depends On | Reason |
| :--- | :--- | :--- |
| **AIManager** | `PromptRegistry` | Buscar as regras do sistema (hot-reload) |
| **AIManager** | `RecoveryCache` | Salvar tentativas no Redis/MemCache |
| **LangGraphOrchestrator** | `AIManager` | Executar o modelo e receber o AsyncGenerator streamado |
| **LangGraphOrchestrator** | `SocketGateway` | Emitir deltas (`typing`) e `status` para a UI |
| **LangGraphOrchestrator** | `GitSupervisor` | Se ao finalizar houver File Edits, invoca o CLI do git |
| **SocketGateway** | `Cockpit UI` (Client) | Contrato de rede via WebSockets (emissão/escuta) |
| **CommitApprovalService** | `SocketGateway` | Aguardar o callback (Aprovação) via Socket |
| **CommitApprovalService** | `GitSupervisor` | Rodar `mergeAndCommit` na aprovação |

## Data Flow: Real-time Streaming
1. `LangGraph` inicia o Node do Agente.
2. Invoca `SocketGateway.emitAgentStatus('thinking')`.
3. Pede ao `PromptRegistry` o system prompt em MD.
4. Pede ao `AIManager` o `streamChat`.
5. Para cada chunk recebido via yield, emite `SocketGateway.emitAgentTyping(delta)`.
6. Terminado, emite `SocketGateway.emitAgentStatus('idle')`.

## Data Flow: Git Auto-Commit
1. Agentes aplicam alterações em arquivos numa branch local (via LangChain tools).
2. `LangGraph` finaliza rodada.
3. Invoca `GitSupervisor.generateDiff()`.
4. `SocketGateway.emitGitDiff(diffText)` para a UI do Cockpit.
5. Cockpit renderiza Modal de aprovação.
6. Humano clica em "Approve". UI emite Socket Event `git_commit_approved`.
7. `CommitApprovalService` captura o evento e chama `GitSupervisor.mergeAndCommit()`.

