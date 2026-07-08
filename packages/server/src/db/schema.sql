CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,
  description   TEXT,
  shared_context TEXT,
  status        TEXT DEFAULT 'active', -- active | paused | archived
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name          TEXT NOT NULL,           -- "kiro-refactor", "claude-features", "rodrigo"
  type          TEXT NOT NULL,           -- "ai" | "human"
  model         TEXT,                    -- "claude-4", "gpt-4", null pra humano
  description   TEXT,                    -- "Responsável por refatoração do módulo X"
  status        TEXT DEFAULT 'idle',     -- idle | working | waiting | offline
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_agents (
  project_id    TEXT REFERENCES projects(id),
  agent_id      TEXT REFERENCES agents(id),
  role          TEXT DEFAULT 'worker',  -- worker | reviewer | manager
  joined_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, agent_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  project_id    TEXT NOT NULL REFERENCES projects(id),
  from_agent_id TEXT NOT NULL REFERENCES agents(id),
  to_agent_id   TEXT,                    -- null = broadcast pra todos do projeto
  thread_id     TEXT,                    -- agrupa mensagens em threads
  type          TEXT NOT NULL,           -- ver tipos abaixo
  priority      TEXT DEFAULT 'normal',   -- low | normal | high | critical
  content       TEXT NOT NULL,           -- markdown
  metadata      TEXT,                    -- JSON extra (arquivos afetados, etc)
  status        TEXT DEFAULT 'active',   -- active | resolved | archived
  waiting_response BOOLEAN DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  agent_id      TEXT NOT NULL REFERENCES agents(id), -- quem deve receber
  message_id    TEXT REFERENCES messages(id),
  level         TEXT NOT NULL,           -- info | important | urgent
  title         TEXT NOT NULL,
  body          TEXT,
  read          BOOLEAN DEFAULT 0,
  delivered     BOOLEAN DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  project_id    TEXT NOT NULL REFERENCES projects(id),
  made_by       TEXT NOT NULL REFERENCES agents(id),
  description   TEXT NOT NULL,
  rationale     TEXT,                    -- por que essa decisão
  affected_files TEXT,                   -- JSON array de paths
  message_id    TEXT REFERENCES messages(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
