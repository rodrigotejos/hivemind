import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '../../database.sqlite');
const db = new DatabaseSync(dbPath);

export function initDb() {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Auto-migration
  try {
    db.exec('ALTER TABLE projects ADD COLUMN shared_context TEXT');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE projects ADD COLUMN path TEXT');
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_sessions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        goal TEXT,
        model TEXT DEFAULT 'auto',
        reasoning_level TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_task_sessions_project ON task_sessions(project_id, created_at);
    `);
  } catch (e) {}

  try {
    db.exec("ALTER TABLE task_sessions ADD COLUMN model TEXT DEFAULT 'auto'");
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_spans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        agent_role TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_project ON telemetry_spans(project_id, timestamp);
    `);

    // Backfill retroativo para mensagens existentes de agentes
    const spanCount = (db.prepare('SELECT COUNT(*) as count FROM telemetry_spans').get() as any)?.count || 0;
    if (spanCount === 0) {
      const messages = db.prepare("SELECT * FROM messages WHERE from_agent_id != 'rodrigo'").all() as any[];
      for (const msg of messages) {
        const pTokens = 350;
        const cTokens = Math.max(50, Math.ceil((msg.content?.length || 100) / 4));
        db.prepare(`
          INSERT INTO telemetry_spans (id, project_id, agent_role, prompt_tokens, completion_tokens, duration_ms, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `span_backfill_${msg.id}`,
          msg.project_id,
          msg.from_agent_id || 'worker',
          pTokens,
          cTokens,
          2200,
          msg.created_at || new Date().toISOString()
        );
      }
    }
  } catch (e) {}

  // Seed baseline agents if empty
  try {
    const agents = [
      { id: 'rodrigo', name: 'Rodrigo (Engenheiro Humano)', type: 'human', description: 'Lead Developer & Tech Supervisor' },
      { id: 'alpha-frontend', name: 'Alpha (Frontend)', type: 'ai', model: 'gemini-1.5-flash', description: 'Especialista em React, Tailwind e Design Tokens' },
      { id: 'beta-backend', name: 'Beta (Backend)', type: 'ai', model: 'gemini-1.5-flash', description: 'Especialista em APIs REST, Express, SQLite e LangGraph' },
      { id: 'gamma-qa', name: 'Gamma (QA)', type: 'ai', model: 'gemini-1.5-flash', description: 'Especialista em Garantia de Qualidade e Testes PBT' },
      { id: 'delta-security', name: 'Delta (Security)', type: 'ai', model: 'gemini-1.5-flash', description: 'Auditor de Segurança e Red Team Adversarial' },
      { id: 'epsilon-infra', name: 'Epsilon (Infra)', type: 'ai', model: 'gemini-1.5-flash', description: 'Especialista em DevOps, Docker, S3 e Automação' },
    ];

    for (const ag of agents) {
      db.prepare(`
        INSERT OR IGNORE INTO agents (id, name, type, model, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(ag.id, ag.name, ag.type, ag.model || null, ag.description);
    }
  } catch (e) {}

  console.log('Database initialized');
}

export default db;
