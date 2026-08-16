export type MessageType = 
  | 'status' 
  | 'question' 
  | 'answer' 
  | 'blocker' 
  | 'decision' 
  | 'conflict' 
  | 'task_done' 
  | 'task_start' 
  | 'handoff' 
  | 'context';

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export type AgentRole = 
  | 'supervisor'
  | 'frontend'
  | 'backend'
  | 'qa'
  | 'security'
  | 'infra'
  | 'docs'
  | 'human';

export interface Message {
  id: string;
  project_id: string;
  from_agent_id: string;
  to_agent_id?: string;
  thread_id?: string;
  type: MessageType;
  priority: Priority;
  content: string;
  metadata?: string;
  status: 'active' | 'resolved' | 'archived';
  waiting_response: boolean;
  created_at: string;
}

export interface InterruptPayload {
  projectId: string;
  checkpointId: string;
  question: string;
  options: string[];
  proposedBy: string;
  category: 'architecture' | 'schema' | 'blocker';
}

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

export interface CLISpanPayload {
  agentRole: AgentRole;
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

export interface ProjectTelemetry {
  projectId: string;
  totalTokens: number;
  estimatedCostUsd: number;
  runsCount: number;
  activeAgents: string[];
}

export class AiDlcClient {
  private serverUrl: string;
  private agentKey: string;

  constructor(serverUrl: string, agentKey: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.agentKey = agentKey;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Agent-Key': this.agentKey,
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Request failed (${response.status}): ${errorText}`);
    }
    return response.json();
  }

  async post(projectId: string, message: {
    type: MessageType;
    content: string;
    toAgentId?: string;
    priority?: Priority;
    threadId?: string;
    metadata?: Record<string, any>;
    waitingResponse?: boolean;
  }): Promise<Message> {
    return this.request<Message>(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        ...message,
        fromAgentId: this.agentKey
      })
    });
  }

  async pending(projectId: string, agentId: string): Promise<Message[]> {
    return this.request<Message[]>(`/api/projects/${projectId}/pending/${agentId}`);
  }

  async read(projectId: string): Promise<Message[]> {
    return this.request<Message[]>(`/api/projects/${projectId}/messages`);
  }

  async resumeInterrupt(projectId: string, checkpointId: string, decision: string): Promise<{ success: boolean; state: AgentGraphState }> {
    return this.request(`/api/projects/${projectId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ checkpointId, decision })
    });
  }

  async getTelemetry(projectId: string): Promise<ProjectTelemetry> {
    return this.request<ProjectTelemetry>(`/api/projects/${projectId}/telemetry`);
  }

  async createSnapshot(projectId: string): Promise<SnapshotMetadata> {
    return this.request<SnapshotMetadata>(`/api/projects/${projectId}/snapshots`, {
      method: 'POST'
    });
  }
}
