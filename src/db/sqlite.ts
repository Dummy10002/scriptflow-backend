import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const DB_PATH = path.join(process.cwd(), 'scriptflow.db');

const db = new Database(DB_PATH);

export function initDB() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scripts (
        request_hash TEXT PRIMARY KEY,
        manychat_user_id TEXT NOT NULL,
        reel_url TEXT NOT NULL,
        user_idea TEXT NOT NULL,
        script_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Database initialized');
  } catch (error) {
    logger.error('Failed to initialize database', error);
    process.exit(1);
  }
}

export function getScriptByHash(hash: string) {
  const stmt = db.prepare('SELECT script_text FROM scripts WHERE request_hash = ?');
  return stmt.get(hash) as { script_text: string } | undefined;
}

export function saveScript(hash: string, userId: string, reelUrl: string, idea: string, script: string) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO scripts (request_hash, manychat_user_id, reel_url, user_idea, script_text)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(hash, userId, reelUrl, idea, script);
}

export default db;
