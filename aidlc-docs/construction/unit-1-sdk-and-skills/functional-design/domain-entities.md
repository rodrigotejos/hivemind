# Unit 1 Functional Design: Domain Entities & Business Rules

## 1. Domain Entities

```typescript
export type AgentRole = 
  | 'supervisor'
  | 'frontend'
  | 'backend'
  | 'qa'
  | 'security'
  | 'infra'
  | 'docs';

export interface InterruptPayload {
  projectId: string;
  checkpointId: string;
  question: string;
  options: string[];
  proposedBy: string;
  category: 'architecture' | 'schema' | 'blocker';
}

export interface CLISpanPayload {
  agentRole: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  exitCode: number;
  timestamp: string;
}

export interface SnapshotMetadata {
  snapshotId: string;
  projectId: string;
  sha256: string;
  byteSize: number;
  createdAt: string;
  s3Uri?: string;
}
```

## 2. Business Rules & Validation

- **BR-01**: Toda mensagem emitida por um agente especialista deve conter `agentId`, `role` e `content` não vazio.
- **BR-02**: O `turnCount` no `AgentGraphState` inicia em 0 e nunca pode decrementar.
- **BR-03**: Quando `status == 'waiting_human'`, o `pendingDecision` não pode ser nulo.
- **BR-04**: As skills em `.agent/skills/` devem possuir frontmatter YAML válido com `name` e `description`.
