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
  } catch (e) {
    // Column already exists
  }
  console.log('Database initialized');
}

export default db;
