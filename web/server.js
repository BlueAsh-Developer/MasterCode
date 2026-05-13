import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import os from 'os';
import multer from 'multer';

import { db, Users, Sessions, Projects, Builds, Credits } from './db.js';
import { hashPassword, verifyPassword, createSession, authMiddleware, deductCredits, addCredits, CREDIT_COSTS, PLAN_CREDITS, PLAN_PRICES } from './auth.js';
import { runWebAgent, MODELS } from './agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PROJECTS_DIR = path.join(os.homedir(), '.mastercode', 'projects');
fs.ensureDirSync(PROJECTS_DIR);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: path.join(os.homedir(), '.mastercode', 'uploads') });

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'All fields required' });
  if (Users.findByEmail.get(email)) return res.status(409).json({ error: 'Email already registered' });

  const id = uuid();
  const hashed = await hashPassword(password);
  Users.create.run(id, email, hashed, name);
  Credits.log.run(uuid(), id, 100, 'welcome', 'Welcome bonus credits');

  const token = createSession(id);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ success: true, user: { id, email, name, credits: 100, plan: 'free' } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = Users.findByEmail.get(email);
  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  Users.updateLogin.run(user.id);
  const token = createSession(user.id);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, credits: user.credits, plan: user.plan } });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.cookies?.token;
  if (token) Sessions.delete.run(token);
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ─── Credits ──────────────────────────────────────────────────────────────────
app.get('/api/credits', authMiddleware, (req, res) => {
  const user = Users.findById.get(req.user.id);
  const history = Credits.history.get ? Credits.history.all(req.user.id) : [];
  res.json({ credits: user.credits, history, plan: user.plan, costs: CREDIT_COSTS, plans: PLAN_PRICES });
});

app.post('/api/credits/topup', authMiddleware, (req, res) => {
  const { amount = 100 } = req.body;
  const capped = Math.min(Math.max(amount, 10), 500);
  addCredits(req.user.id, capped, 'Manual top-up');
  const user = Users.findById.get(req.user.id);
  res.json({ success: true, credits: user.credits });
});

app.post('/api/credits/set-api-key', authMiddleware, (req, res) => {
  const { apiKey, geminiApiKey } = req.body;
  if (apiKey && !apiKey.startsWith('sk-ant-')) return res.status(400).json({ error: 'Invalid Anthropic API key' });
  if (apiKey) Users.updateApiKey.run(apiKey, req.user.id);
  if (geminiApiKey) {
    // Store Gemini key in a separate column if it exists, else use a JSON field
    try {
      db.prepare('ALTER TABLE users ADD COLUMN gemini_api_key TEXT').run();
    } catch {}
    db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?').run(geminiApiKey, req.user.id);
  }
  res.json({ success: true });
});

// ─── Models ───────────────────────────────────────────────────────────────────
app.get('/api/models', authMiddleware, (req, res) => {
  res.json({ models: MODELS });
});

// ─── Projects ─────────────────────────────────────────────────────────────────
app.get('/api/projects', authMiddleware, (req, res) => {
  const projects = Projects.list.all(req.user.id);
  res.json({ projects });
});

app.post('/api/projects', authMiddleware, (req, res) => {
  const { name, description, stack } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuid();
  const projectPath = path.join(PROJECTS_DIR, req.user.id, id);
  fs.ensureDirSync(projectPath);
  Projects.create.run(id, req.user.id, name, description || '', projectPath, stack || '');
  res.json({ project: { id, name, description, path: projectPath, stack } });
});

app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const project = Projects.findById.get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (fs.existsSync(project.path)) fs.removeSync(project.path);
  Projects.delete.run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ─── File Manager ─────────────────────────────────────────────────────────────
function getProjectDir(userId, projectId) {
  const project = Projects.findById.get(projectId, userId);
  if (!project) return null;
  return project.path;
}

app.get('/api/files/:projectId', authMiddleware, async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Project not found' });
  const { path: subPath = '' } = req.query;
  const target = path.join(dir, subPath);
  if (!target.startsWith(dir)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const files = entries
      .filter(e => !['node_modules', '.git'].includes(e.name))
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        path: path.join(subPath, e.name),
        size: e.isFile() ? fs.statSync(path.join(target, e.name)).size : 0,
      }));
    res.json({ files });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/files/:projectId/read', authMiddleware, async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Not found' });
  const target = path.join(dir, req.query.path || '');
  if (!target.startsWith(dir)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const content = await fs.readFile(target, 'utf-8');
    res.json({ content });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:projectId/write', authMiddleware, async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Not found' });
  const { path: filePath, content } = req.body;
  const target = path.join(dir, filePath);
  if (!target.startsWith(dir)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await fs.ensureDir(path.dirname(target));
    await fs.writeFile(target, content, 'utf-8');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/files/:projectId/delete', authMiddleware, async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Not found' });
  const target = path.join(dir, req.query.path || '');
  if (!target.startsWith(dir)) return res.status(403).json({ error: 'Forbidden' });
  try {
    await fs.remove(target);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:projectId/rename', authMiddleware, async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Not found' });
  const { from, to } = req.body;
  const src = path.join(dir, from), dst = path.join(dir, to);
  if (!src.startsWith(dir) || !dst.startsWith(dir)) return res.status(403).json({ error: 'Forbidden' });
  try { await fs.move(src, dst); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/:projectId/upload', authMiddleware, upload.array('files'), async (req, res) => {
  const dir = getProjectDir(req.user.id, req.params.projectId);
  if (!dir) return res.status(404).json({ error: 'Not found' });
  const subPath = req.body.path || '';
  const uploaded = [];
  for (const file of req.files || []) {
    const dest = path.join(dir, subPath, file.originalname);
    await fs.move(file.path, dest, { overwrite: true });
    uploaded.push(file.originalname);
  }
  res.json({ success: true, uploaded });
});

// ─── AI Agent (SSE streaming) ─────────────────────────────────────────────────
function getUserKeys(user) {
  let geminiKey = null;
  try {
    const row = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(user.id);
    geminiKey = row?.gemini_api_key || process.env.GEMINI_API_KEY || null;
  } catch {}
  return {
    anthropicKey: user.api_key || process.env.ANTHROPIC_API_KEY,
    geminiKey,
  };
}

app.post('/api/agent/build', authMiddleware, async (req, res) => {
  const { prompt, projectId, history, model, provider } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const user = Users.findById.get(req.user.id);
  const { anthropicKey, geminiKey } = getUserKeys(user);

  const resolvedProvider = provider || (model?.startsWith('gemini') ? 'gemini' : 'claude');
  const apiKey = resolvedProvider === 'gemini' ? geminiKey : anthropicKey;
  if (!apiKey) return res.status(400).json({ error: `No ${resolvedProvider === 'gemini' ? 'Gemini' : 'Anthropic'} API key configured. Add it in Settings.` });

  const cost = CREDIT_COSTS.build;
  if (user.credits < cost) return res.status(402).json({ error: `Not enough credits. Need ${cost}, have ${user.credits}.` });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let projectDir = PROJECTS_DIR;
  let buildId = uuid();

  if (projectId) {
    const project = Projects.findById.get(projectId, req.user.id);
    if (project) {
      projectDir = project.path;
      Projects.update.run(project.name, project.description, project.stack, projectId, req.user.id);
    }
  } else {
    const id = uuid();
    projectDir = path.join(PROJECTS_DIR, req.user.id, id);
    fs.ensureDirSync(projectDir);
    const name = prompt.slice(0, 40).replace(/[^a-z0-9\s]/gi, '').trim() || 'New Project';
    Projects.create.run(id, req.user.id, name, prompt, projectDir, '');
    send({ type: 'project_created', projectId: id, name });
  }

  Builds.create.run(buildId, req.user.id, projectId || null, prompt);
  deductCredits(req.user.id, cost, `Build: ${prompt.slice(0, 50)}`);

  try {
    await runWebAgent({
      prompt,
      projectDir,
      apiKey: resolvedProvider === 'claude' ? apiKey : null,
      geminiApiKey: resolvedProvider === 'gemini' ? apiKey : null,
      model,
      provider: resolvedProvider,
      history: history || [],
      onEvent: send,
    });
    Builds.update.run('complete', cost, null, buildId);
  } catch (e) {
    send({ type: 'error', message: e.message });
    Builds.update.run('failed', 0, e.message, buildId);
    if (e.status === 400 || e.status === 401) {
      addCredits(req.user.id, cost, 'Refund: API error');
    }
  }

  res.end();
});

app.post('/api/agent/chat', authMiddleware, async (req, res) => {
  const { message, projectId, history, model, provider } = req.body;
  const user = Users.findById.get(req.user.id);
  const { anthropicKey, geminiKey } = getUserKeys(user);

  const resolvedProvider = provider || (model?.startsWith('gemini') ? 'gemini' : 'claude');
  const apiKey = resolvedProvider === 'gemini' ? geminiKey : anthropicKey;
  if (!apiKey) return res.status(400).json({ error: 'No API key configured' });

  const cost = CREDIT_COSTS.chat_message;
  if (user.credits < cost) return res.status(402).json({ error: 'Not enough credits' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let projectDir = path.join(PROJECTS_DIR, req.user.id);
  fs.ensureDirSync(projectDir);

  if (projectId) {
    const project = Projects.findById.get(projectId, req.user.id);
    if (project) projectDir = project.path;
  }

  deductCredits(req.user.id, cost, `Chat: ${message.slice(0, 50)}`);

  try {
    await runWebAgent({
      prompt: message,
      projectDir,
      apiKey: resolvedProvider === 'claude' ? apiKey : null,
      geminiApiKey: resolvedProvider === 'gemini' ? apiKey : null,
      model,
      provider: resolvedProvider,
      history: history || [],
      onEvent: send,
    });
  } catch (e) {
    send({ type: 'error', message: e.message });
  }

  res.end();
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', authMiddleware, (req, res) => {
  const user = Users.findById.get(req.user.id);
  const projectCount = Projects.count.get(req.user.id).n;
  const builds = Builds.list.all(req.user.id);
  const totalSpent = Credits.totalSpent.get(req.user.id).total;
  res.json({ credits: user.credits, plan: user.plan, projectCount, buildCount: builds.length, totalCreditsSpent: totalSpent, recentBuilds: builds.slice(0, 5) });
});

// ─── Catch-all → SPA ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app };
