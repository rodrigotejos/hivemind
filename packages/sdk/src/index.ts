type MessageType = 'status' | 'question' | 'answer' | 'blocker' | 'decision' | 'conflict' | 'task_done' | 'task_start' | 'handoff' | 'context';
type Priority = 'low' | 'normal' | 'high' | 'critical';

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

export class AiDlcClient {
  private serverUrl: string;
  private agentKey: string;

  constructor(serverUrl: string, agentKey: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.agentKey = agentKey;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
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
    metadata?: Record<string, any>;
    waitingResponse?: boolean;
  }): Promise<Message> {
    return this.request(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        ...message,
        fromAgentId: this.agentKey // simplistic for mvp
      })
    });
  }

  async pending(projectId: string, agentId: string): Promise<Message[]> {
    return this.request(`/api/projects/${projectId}/pending/${agentId}`);
  }

  async read(projectId: string): Promise<Message[]> {
    return this.request(`/api/projects/${projectId}/messages`);
  }
}
