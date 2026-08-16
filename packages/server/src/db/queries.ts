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

export function createProject(name: string, description?: string, sharedContext?: string) {
  const stmt = db.prepare('INSERT INTO projects (name, description, shared_context) VALUES (?, ?, ?) RETURNING *');
  return stmt.get(name, description || null, sharedContext || null);
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

export function getProjectMessages(projectId: string) {
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
