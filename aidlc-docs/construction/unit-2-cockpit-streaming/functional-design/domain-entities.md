# Domain Entities & Event Payloads - Unit 2: Cockpit Streaming & Auto-Recovery UI

## 1. Socket.IO Event Payloads

### 1.1 Unificação do Evento de Auto-Recovery (`agent_recovery`)
```typescript
export type RecoveryStatus = 'retrying' | 'recovered' | 'exhausted';

export interface AgentRecoveryEvent {
  projectId: string;
  sessionId?: string;
  agentId: string;
  agentRole: string;
  status: RecoveryStatus;
  attempt: number;
  maxAttempts: number; // padrão 5
  delayMs: number;
  errorMessage: string;
  timestamp: number;
}
```

### 1.2 Evento de Streaming Cumulativo & Delta (`agent_typing`)
```typescript
export interface AgentTypingEvent {
  messageId: string;
  projectId: string;
  threadId?: string;
  agentId: string;
  agentRole: string;
  delta: string;
  fullText: string;
  status: 'thinking' | 'typing' | 'completed';
  timestamp: number;
}
```

### 1.3 Evento de Ciclo de Passo (`agent_step_started` / `agent_step_finished`)
```typescript
export interface AgentStepEvent {
  projectId: string;
  sessionId?: string;
  agentId: string;
  agentRole: string;
  status: 'thinking' | 'running' | 'completed' | 'error';
  turnCount?: number;
  messageId?: string;
}
```

---

## 2. Tipos de Configuração do Backoff Adaptativo

```typescript
export interface AdaptiveBackoffConfig {
  initialDelay429Ms: number; // 10.000ms
  initialDelay503Ms: number; // 2.000ms
  maxDelayMs: number;        // 60.000ms
  maxAttempts: number;       // 5
  jitterRangePct: number;    // 0.15 (±15%)
}

export interface ErrorClassification {
  type: 'RATE_LIMIT_429' | 'TRANSIENT_503' | 'FATAL';
  retryAfterMs?: number;
  baseDelayMs: number;
}
```
