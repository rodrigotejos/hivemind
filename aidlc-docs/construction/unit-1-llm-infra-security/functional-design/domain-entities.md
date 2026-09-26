# Domain Entities & Schemas - Unit 1: Infraestrutura de LLM & Segurança

## 1. Zod Schemas para Structured Output

### 1.1 Message Priority Triage Schema
Substitui o parser manual no `analyzeMessagePriority`:
```typescript
import { z } from 'zod';

export const MessagePrioritySchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string().min(1).max(500),
  category: z.enum(['question', 'decision', 'blocker', 'info', 'security']),
  requiresAttention: z.boolean(),
  tags: z.array(z.string()).default([])
});

export type MessagePriorityPayload = z.infer<typeof MessagePrioritySchema>;
```

### 1.2 Prompt Template Entity Schema
Estrutura canônica de cada arquivo `packages/server/prompts/*.json`:
```typescript
export const PromptMessageTemplateSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  template: z.string()
});

export const PromptDefinitionSchema = z.object({
  id: z.string(),
  role: z.string(),
  version: z.string(),
  description: z.string(),
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  messages: z.array(PromptMessageTemplateSchema)
});

export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;
```

---

## 2. Token Budget & Summarization Entities

```typescript
export interface TokenBudgetConfig {
  maxContextTokens: number;
  safetyMarginPct: number; // ex: 0.80 para 80%
  recentMessagesReservedCount: number; // ex: 10
}

export interface SummarizationResult {
  condensedSummary: string;
  summaryTokenCount: number;
  retainedMessages: any[];
  totalContextTokens: number;
  summarizationTriggered: boolean;
}
```

---

## 3. Heartbeat Lease Entities (Daemon Resilience)

```typescript
export interface HeartbeatLease {
  taskId: string;
  pid: number;
  startedAt: number;
  lastHeartbeat: number;
  leaseDurationMs: number; // padrão 60_000ms
  status: 'active' | 'expired' | 'terminated';
}

export type LeaseEvent = 
  | { type: 'HEARTBEAT_RECEIVED'; taskId: string; timestamp: number }
  | { type: 'LEASE_EXPIRED'; taskId: string; lastSeenMsAgo: number }
  | { type: 'PROCESS_KILLED'; taskId: string; signal: 'SIGTERM' | 'SIGKILL' };
```

---

## 4. Structured Error Types

```typescript
export class StructuredSchemaError extends Error {
  constructor(
    public readonly zodIssues: z.ZodIssue[],
    public readonly rawModelResponse: string,
    public readonly attemptsCount: number
  ) {
    super(`Failed to produce valid structured output after ${attemptsCount} reflection attempts.`);
    this.name = 'StructuredSchemaError';
  }
}

export class HeartbeatTimeoutError extends Error {
  constructor(public readonly taskId: string, public readonly idleDurationMs: number) {
    super(`Subprocess task ${taskId} timed out: no heartbeat received in ${idleDurationMs}ms.`);
    this.name = 'HeartbeatTimeoutError';
  }
}
```
