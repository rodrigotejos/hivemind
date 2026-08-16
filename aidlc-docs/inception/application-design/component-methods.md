# Component Methods & Interface Contracts: Hivemind Autonomous Ecosystem

## 1. LangGraph Orchestration Engine (`COMP-01`)

```typescript
export interface AgentGraphState {
  projectId: string;
  taskId: string;
  goal: string;
  messages: Array<{ role: string; content: string; agentId?: string }>;
  currentAgent?: string;
  nextStep?: string;
  turnCount: number;
  maxTurns: number;
  isConverged: boolean;
  status: 'idle' | 'running' | 'paused' | 'waiting_human' | 'completed' | 'error';
  pendingDecision?: {
    type: 'architecture' | 'schema' | 'blocker';
    question: string;
    options: string[];
    proposedBy: string;
  };
}

export interface ILangGraphEngine {
  /** Inicializa ou carrega o StateGraph para um projeto específico */
  initializeGraph(projectId: string, state: Partial<AgentGraphState>): Promise<string>;
  
  /** Executa o próximo nó do grafo baseado no estado atual */
  step(projectId: string, inputMessage?: string): Promise<AgentGraphState>;
  
  /** Dispara a avaliação do supervisor para determinar próximo nó ou convergência */
  evaluateSupervisorNode(state: AgentGraphState): Promise<{ next: string; isConverged: boolean }>;
  
  /** Pausa a execução do grafo aguardando resposta humana (interrupt) */
  triggerInterrupt(projectId: string, decision: AgentGraphState['pendingDecision']): Promise<void>;
  
  /** Retoma o grafo a partir do checkpoint_id com a decisão do humano */
  resumeWithHumanInput(projectId: string, checkpointId: string, decision: string): Promise<AgentGraphState>;
  
  /** Salva e restaura o snapshot do estado do grafo no SQLite */
  saveCheckpoint(projectId: string, state: AgentGraphState): Promise<string>;
  getLatestCheckpoint(projectId: string): Promise<AgentGraphState | null>;
}
```

---

## 2. Antigravity Bridge Daemon (`COMP-02`)

```typescript
export interface CLIExecutionRequest {
  projectId: string;
  agentRole: string;
  agentId: string;
  prompt: string;
  conversationId?: string;
  timeoutMs?: number;
}

export interface CLIExecutionResult {
  success: boolean;
  output: string;
  tokensUsed?: { prompt: number; completion: number };
  durationMs: number;
  error?: string;
}

export interface IBridgeDaemon {
  /** Inicia o daemon escutando eventos de mensagens do Hivemind */
  start(): Promise<void>;
  
  /** Para o daemon de forma graciosa */
  stop(): Promise<void>;
  
  /** Enfileira e dispara uma execução local do Antigravity CLI */
  executeAgentCLI(request: CLIExecutionRequest): Promise<CLIExecutionResult>;
  
  /** Verifica o status do circuit breaker para chamadas do CLI */
  getCircuitBreakerStatus(agentRole: string): { isOpen: boolean; failures: number };
  
  /** Publica o output do CLI de volta no endpoint de mensagens do Hivemind */
  publishAgentResponse(projectId: string, agentId: string, result: CLIExecutionResult): Promise<void>;
}
```

---

## 3. LangSmith Observability & Telemetry Service (`COMP-03`)

```typescript
export interface ITelemetryService {
  /** Cria um novo Run/Trace no LangSmith para a execução de um projeto/tarefa */
  createTrace(name: string, inputs: Record<string, any>, tags?: string[]): Promise<string>;
  
  /** Registra um span filho correspondente à transição de nó do LangGraph ou chamada de LLM */
  recordNodeSpan(traceId: string, nodeName: string, inputs: any, outputs: any, durationMs: number): Promise<void>;
  
  /** Ingesta a telemetria de tokens de uma execução do Antigravity CLI */
  recordCLISpan(traceId: string, agentRole: string, promptTokens: number, completionTokens: number, durationMs: number): Promise<void>;
  
  /** Obtém o resumo agregado de consumo de tokens e custos de um projeto */
  getProjectTokenMetrics(projectId: string): Promise<{ totalTokens: number; estimatedCostUsd: number; runCount: number }>;
}
```

---

## 4. Project Auto-Setup & Onboarding Assistant (`COMP-04`)

```typescript
export interface ISetupAssistant {
  /** Valida se a base de código possui a estrutura de regras AI-DLC e MCP memory */
  inspectProjectStructure(projectPath: string): Promise<{ isCompliant: boolean; missingFiles: string[] }>;
  
  /** Executa o bootstrap automático criando .aidlc/, .agent/, AGENTS.md e .kiro/ */
  bootstrapProject(projectPath: string, options: { enableMemoryMCP: boolean; enableAIDLC: boolean }): Promise<{ success: boolean; generatedFiles: string[] }>;
  
  /** Dispara a indexação do repositório no MCP codebase-memory */
  triggerMCPIndex(projectPath: string): Promise<{ nodeCount: number; edgeCount: number }>;
}
```

---

## 5. Cloud Resilience & S3 Backup Service (`COMP-05`)

```typescript
export interface ISnapshotService {
  /** Gera um snapshot criptografado do banco SQLite, grafos MCP e arquivos de estado */
  createSnapshot(projectId: string): Promise<{ snapshotId: string; archivePath: string; sha256: string }>;
  
  /** Faz upload do snapshot para o bucket S3 configurado */
  exportToS3(snapshotId: string, s3Config: { bucket: string; region: string; prefix?: string }): Promise<{ s3Uri: string; uploadedAt: string }>;
  
  /** Baixa e restaura um snapshot do S3 para o banco local */
  restoreFromS3(s3Uri: string, targetProjectId: string): Promise<{ success: boolean; restoredRecords: number }>;
}
```
