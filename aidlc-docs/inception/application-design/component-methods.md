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
