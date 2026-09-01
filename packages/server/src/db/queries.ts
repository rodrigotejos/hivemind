import db from './connection';

export function getProjects() {
  return db.prepare('SELECT * FROM projects').all();
}

export function getProject(id: string) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

export function updateProject(id: string, updates: Partial<{name: string, description: string, status: string, shared_context: string}>) {
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE projects SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
  return getProject(id);
}

export function createProject(name: string, description?: string, sharedContext?: string, projectPath?: string) {
  const stmt = db.prepare('INSERT INTO projects (name, description, shared_context, path) VALUES (?, ?, ?, ?) RETURNING *');
  return stmt.get(name, description || null, sharedContext || null, projectPath || null);
}

export function updateProjectContext(id: string, context: string) {
  return updateProject(id, { shared_context: context });
}

export function getAgents() {
  return db.prepare('SELECT * FROM agents').all();
}

export function getProjectAgents(projectId: string) {
  return db.prepare(`
    SELECT a.*, pa.role, pa.joined_at 
    FROM agents a 
    JOIN project_agents pa ON a.id = pa.agent_id 
    WHERE pa.project_id = ?
  `).all(projectId);
}

export function createAgent(name: string, type: 'ai' | 'human', model?: string, description?: string, id?: string) {
  if (id) {
    const stmt = db.prepare('INSERT INTO agents (id, name, type, model, description) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name RETURNING *');
    return stmt.get(id, name, type, model || null, description || null);
  } else {
    const stmt = db.prepare('INSERT INTO agents (name, type, model, description) VALUES (?, ?, ?, ?) RETURNING *');
    return stmt.get(name, type, model || null, description || null);
  }
}

export function addAgentToProject(projectId: string, agentId: string, role: string = 'worker') {
  const stmt = db.prepare('INSERT OR IGNORE INTO project_agents (project_id, agent_id, role) VALUES (?, ?, ?)');
  stmt.run(projectId, agentId, role);
  return { projectId, agentId, role };
}

export function getProjectMessages(projectId: string, threadId?: string) {
  if (threadId && threadId !== 'all') {
    if (threadId === 'general') {
      return db.prepare("SELECT * FROM messages WHERE project_id = ? AND (thread_id IS NULL OR thread_id = '' OR thread_id = 'general') ORDER BY created_at ASC").all(projectId);
    }
    return db.prepare('SELECT * FROM messages WHERE project_id = ? AND thread_id = ? ORDER BY created_at ASC').all(projectId, threadId);
  }
  return db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC').all(projectId);
}

export function updateMessage(id: string, updates: Partial<{status: string, waiting_response: boolean}>) {
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
  db.prepare(`UPDATE messages SET ${setClauses} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function createMessage(data: {
  projectId: string,
  fromAgentId: string,
  toAgentId?: string,
  threadId?: string,
  type: string,
  priority?: string,
  content: string,
  metadata?: string,
  waitingResponse?: boolean
}) {
  const stmt = db.prepare(`
    INSERT INTO messages (project_id, from_agent_id, to_agent_id, thread_id, type, priority, content, metadata, waiting_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `);
  
  return stmt.get(
    data.projectId,
    data.fromAgentId,
    data.toAgentId || null,
    data.threadId || null,
    data.type,
    data.priority || 'normal',
    data.content,
    data.metadata || null,
    data.waitingResponse ? 1 : 0
  );
}

export function createNotification(data: {
  agentId: string,
  messageId?: string,
  level: string,
  title: string,
  body?: string
}) {
  const stmt = db.prepare(`
    INSERT INTO notifications (agent_id, message_id, level, title, body)
    VALUES (?, ?, ?, ?, ?) RETURNING *
  `);
  return stmt.get(data.agentId, data.messageId || null, data.level, data.title, data.body || null);
}

export function getAgentNotifications(agentId: string) {
  return db.prepare('SELECT * FROM notifications WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
}

export function markNotificationRead(id: string) {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead(agentId: string) {
  db.prepare('UPDATE notifications SET read = 1 WHERE agent_id = ?').run(agentId);
}

export function getProjectDecisions(projectId: string) {
  return db.prepare('SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at ASC').all(projectId);
}

export function getProjectNotifications(projectId: string) {
  return db.prepare(`
    SELECT n.* 
    FROM notifications n
    JOIN messages m ON n.message_id = m.id
    WHERE m.project_id = ?
    ORDER BY n.created_at DESC
  `).all(projectId);
}

export function createTaskSession(
  projectId: string, 
  title: string, 
  goal?: string, 
  model: string = 'auto',
  reasoningLevel: string = 'medium'
) {
  const stmt = db.prepare('INSERT INTO task_sessions (project_id, title, goal, model, reasoning_level, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING *');
  return stmt.get(projectId, title, goal || null, model || 'auto', reasoningLevel || 'medium', 'active');
}

export function getProjectTaskSessions(projectId: string) {
  return db.prepare('SELECT * FROM task_sessions WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
}

export function getTaskSession(id: string) {
  return db.prepare('SELECT * FROM task_sessions WHERE id = ?').get(id);
}

export function updateTaskSession(id: string, updates: Partial<{ title: string; goal: string; model: string; reasoning_level: string; status: string }>) {
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE task_sessions SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
  return getTaskSession(id);
}

export interface SecurityFinding {
  id: string;
  project_id: string;
  session_id?: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  red_team_details?: string;
  blue_team_mitigation?: string;
  status: 'open' | 'mitigating' | 'mitigated' | 'verified';
  affected_file?: string;
  created_at: string;
  updated_at: string;
}

export function getProjectSecurityFindings(projectId: string, status?: string): SecurityFinding[] {
  if (status && status !== 'all') {
    return db.prepare('SELECT * FROM security_findings WHERE project_id = ? AND status = ? ORDER BY created_at DESC').all(projectId, status) as any[];
  }
  return db.prepare('SELECT * FROM security_findings WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[];
}

export function getProjectSecuritySummary(projectId: string) {
  const findings = getProjectSecurityFindings(projectId);

  let deductions = 0;
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const statusCounts = { open: 0, mitigating: 0, mitigated: 0, verified: 0 };

  for (const f of findings) {
    if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++;
    if (statusCounts[f.status] !== undefined) statusCounts[f.status]++;

    if (f.status === 'open') {
      if (f.severity === 'critical') deductions += 25;
      else if (f.severity === 'high') deductions += 15;
      else if (f.severity === 'medium') deductions += 8;
      else if (f.severity === 'low') deductions += 3;
    } else if (f.status === 'mitigating') {
      if (f.severity === 'critical') deductions += 12;
      else if (f.severity === 'high') deductions += 7;
      else if (f.severity === 'medium') deductions += 4;
      else if (f.severity === 'low') deductions += 1;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  const rating = 
    score >= 95 ? 'A+' :
    score >= 85 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' : 'F';

  return {
    score,
    rating,
    totalFindings: findings.length,
    severityCounts,
    statusCounts,
    findings,
  };
}

export function createSecurityFinding(data: {
  projectId: string;
  sessionId?: string;
  title: string;
  category: string;
  severity: string;
  redTeamDetails?: string;
  blueTeamMitigation?: string;
  status?: string;
  affectedFile?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO security_findings (project_id, session_id, title, category, severity, red_team_details, blue_team_mitigation, status, affected_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    data.projectId,
    data.sessionId || null,
    data.title,
    data.category,
    data.severity,
    data.redTeamDetails || null,
    data.blueTeamMitigation || null,
    data.status || 'open',
    data.affectedFile || null
  );
}

export function updateSecurityFinding(id: string, updates: Partial<{
  title: string;
  category: string;
  severity: string;
  red_team_details: string;
  blue_team_mitigation: string;
  status: string;
  affected_file: string;
}>) {
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE security_findings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM security_findings WHERE id = ?').get(id);
}

export function deleteSecurityFinding(id: string) {
  return db.prepare('DELETE FROM security_findings WHERE id = ?').run(id);
}




