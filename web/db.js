import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

const dbDir = path.join(os.homedir(), '.mastercode');
fs.ensureDirSync(dbDir);
const db = new Database(path.join(dbDir, 'app.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    credits INTEGER DEFAULT 100,
    api_key TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    path TEXT NOT NULL,
    stack TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT,
    prompt TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    credits_used INTEGER DEFAULT 0,
    output TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export { db };

export const Users = {
  create: db.prepare(`INSERT INTO users (id,email,password,name) VALUES (?,?,?,?)`),
  findByEmail: db.prepare(`SELECT * FROM users WHERE email=?`),
  findById: db.prepare(`SELECT * FROM users WHERE id=?`),
  updateCredits: db.prepare(`UPDATE users SET credits=credits+? WHERE id=?`),
  setCredits: db.prepare(`UPDATE users SET credits=? WHERE id=?`),
  updateLogin: db.prepare(`UPDATE users SET last_login=datetime('now') WHERE id=?`),
  updateApiKey: db.prepare(`UPDATE users SET api_key=? WHERE id=?`),
  updatePlan: db.prepare(`UPDATE users SET plan=? WHERE id=?`),
  count: db.prepare(`SELECT COUNT(*) as n FROM users`),
};

export const Credits = {
  log: db.prepare(`INSERT INTO credit_transactions (id,user_id,amount,type,description) VALUES (?,?,?,?,?)`),
  history: db.prepare(`SELECT * FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50`),
  totalSpent: db.prepare(`SELECT COALESCE(SUM(ABS(amount)),0) as total FROM credit_transactions WHERE user_id=? AND amount<0`),
};

export const Projects = {
  create: db.prepare(`INSERT INTO projects (id,user_id,name,description,path,stack) VALUES (?,?,?,?,?,?)`),
  list: db.prepare(`SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC`),
  findById: db.prepare(`SELECT * FROM projects WHERE id=? AND user_id=?`),
  update: db.prepare(`UPDATE projects SET name=?,description=?,stack=?,updated_at=datetime('now') WHERE id=? AND user_id=?`),
  delete: db.prepare(`DELETE FROM projects WHERE id=? AND user_id=?`),
  count: db.prepare(`SELECT COUNT(*) as n FROM projects WHERE user_id=?`),
};

export const Builds = {
  create: db.prepare(`INSERT INTO builds (id,user_id,project_id,prompt,status) VALUES (?,?,?,?,'running')`),
  update: db.prepare(`UPDATE builds SET status=?,credits_used=?,output=? WHERE id=?`),
  list: db.prepare(`SELECT * FROM builds WHERE user_id=? ORDER BY created_at DESC LIMIT 20`),
  findById: db.prepare(`SELECT * FROM builds WHERE id=?`),
};

export const Sessions = {
  create: db.prepare(`INSERT INTO sessions (id,user_id,token,expires_at) VALUES (?,?,?,?)`),
  findByToken: db.prepare(`SELECT s.*,u.id as uid,u.email,u.name,u.plan,u.credits,u.api_key FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires_at>datetime('now')`),
  delete: db.prepare(`DELETE FROM sessions WHERE token=?`),
  cleanup: db.prepare(`DELETE FROM sessions WHERE expires_at<datetime('now')`),
};
