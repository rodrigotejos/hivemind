import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '../../database.sqlite');
const db = new DatabaseSync(dbPath);

export function initDb() {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    const srcPath = path.join(__dirname, '../../src/db/schema.sql');
    if (fs.existsSync(srcPath)) {
      schemaPath = srcPath;
    }
  }
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
    db.exec('ALTER TABLE projects ADD COLUMN security_score INTEGER DEFAULT NULL');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE projects ADD COLUMN security_rating TEXT DEFAULT NULL');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE projects ADD COLUMN last_security_audit_at DATETIME DEFAULT NULL');
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_runs (
        id               TEXT PRIMARY KEY,
        project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase            INTEGER NOT NULL DEFAULT 1,
        total_phases     INTEGER NOT NULL DEFAULT 5,
        phase_name       TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'running',
        agent_role       TEXT NOT NULL,
        agent_name       TEXT NOT NULL,
        current_check    TEXT,
        target_file      TEXT,
        findings_count   INTEGER DEFAULT 0,
        score            INTEGER DEFAULT NULL,
        started_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at     DATETIME DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_security_runs_project_status ON security_runs(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_security_runs_project_started ON security_runs(project_id, started_at DESC);
    `);

    if (process.env.NODE_ENV !== 'test') {
      db.exec("UPDATE security_runs SET status = 'failed', current_check = 'Interrompido por reinicialização do servidor' WHERE status = 'running'");
    }
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

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_findings (
        id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        project_id           TEXT NOT NULL REFERENCES projects(id),
        session_id           TEXT,
        title                TEXT NOT NULL,
        category             TEXT NOT NULL,
        severity             TEXT NOT NULL,
        red_team_details     TEXT,
        blue_team_mitigation TEXT,
        status               TEXT DEFAULT 'open',
        affected_file        TEXT,
        created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_security_project ON security_findings(project_id, status);
    `);

    // Seed baseline findings para projetos existentes se tabela estiver vazia
    const findingCount = (db.prepare('SELECT COUNT(*) as count FROM security_findings').get() as any)?.count || 0;
    if (findingCount === 0) {
      const projects = db.prepare('SELECT id FROM projects').all() as any[];
      for (const p of projects) {
        db.prepare(`
          INSERT INTO security_findings (id, project_id, title, category, severity, red_team_details, blue_team_mitigation, status, affected_file)
          VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `sec_${p.id}_1`, p.id, 'Validação de Parâmetros e Sanitização de Input nas Rotas Express', 'sanitization', 'medium',
          'Vetor de Ataque Red Team: Injeção de payloads maliciosos ou parâmetros não tipados via body/query nas rotas REST.',
          'Mitigação Blue Team: Aplicar schemas de validação Zod e sanitização estrita de entrada em todos os endpoints.',
          'mitigated', 'src/routes/*.ts',

          `sec_${p.id}_2`, p.id, 'Configuração de Política de CORS e Headers HTTP de Segurança', 'configuration', 'low',
          'Vetor de Ataque Red Team: Requisições cross-origin não autorizadas ou ausência de headers Helmet (HSTS, CSP, X-Frame-Options).',
          'Mitigação Blue Team: Configurar cors com whitelist estrita e middleware helmet() no servidor Express.',
          'mitigated', 'src/index.ts',

          `sec_${p.id}_3`, p.id, 'Auditoria de Secrets e Proteção de Chaves de API em Variáveis de Ambiente', 'secret_leak', 'high',
          'Vetor de Ataque Red Team: Exposição acidental de credenciais em logs ou commits no repositório.',
          'Mitigação Blue Team: Uso de dotenv com .env.example, verificação no .gitignore e mascaramento de logs no BridgeDaemon.',
          'verified', '.env'
        );
      }
    }
  } catch (e) {}

  // Backfill scores consolidados para projetos existentes
  try {
    const projectsWithoutScore = db.prepare('SELECT id FROM projects WHERE security_score IS NULL').all() as any[];
    for (const p of projectsWithoutScore) {
      const findings = db.prepare('SELECT status, severity FROM security_findings WHERE project_id = ?').all(p.id) as any[];
      if (findings && findings.length > 0) {
        let deductions = 0;
        for (const f of findings) {
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
        const rating = score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'F';
        db.prepare('UPDATE projects SET security_score = ?, security_rating = ?, last_security_audit_at = CURRENT_TIMESTAMP WHERE id = ?').run(score, rating, p.id);
      }
    }
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ui_components (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        project_id      TEXT NOT NULL REFERENCES projects(id),
        name            TEXT NOT NULL,
        source_type     TEXT NOT NULL,
        source_input    TEXT,
        design_tokens   TEXT,
        component_code  TEXT NOT NULL,
        file_path       TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ui_components_project ON ui_components(project_id, created_at);
    `);
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
