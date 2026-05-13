// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  user: null,
  projects: [],
  currentProject: null,
  chatHistory: [],
  buildHistory: [],
};

// ─── API helpers ──────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
}

async function login(e) {
  e.preventDefault();
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const data = await api('POST', '/api/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    state.user = data.user;
    showApp();
  } catch (ex) { err.textContent = ex.message; }
}

async function register(e) {
  e.preventDefault();
  const err = document.getElementById('reg-error');
  err.textContent = '';
  try {
    const data = await api('POST', '/api/auth/register', {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    state.user = data.user;
    showApp();
  } catch (ex) { err.textContent = ex.message; }
}

async function logout() {
  await api('POST', '/api/auth/logout').catch(() => {});
  state.user = null;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

async function checkAuth() {
  try {
    const data = await api('GET', '/api/auth/me');
    state.user = data.user;
    showApp();
  } catch { /* not logged in */ }
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  updateSidebarCredits();
  loadProjects().then(() => navigate('dashboard'));
}

function updateSidebarCredits() {
  if (state.user) document.getElementById('sidebar-credits').textContent = state.user.credits;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.remove('hidden');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  const renders = { dashboard: renderDashboard, build: renderBuild, chat: renderChat, files: renderFiles, credits: renderCredits, settings: renderSettings };
  renders[page]?.();
}

// ─── Projects ─────────────────────────────────────────────────────────────────
async function loadProjects() {
  const data = await api('GET', '/api/projects');
  state.projects = data.projects;
}

async function createProject(name, description, stack) {
  const data = await api('POST', '/api/projects', { name, description, stack });
  state.projects.unshift(data.project);
  return data.project;
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its files?')) return;
  await api('DELETE', `/api/projects/${id}`);
  state.projects = state.projects.filter(p => p.id !== id);
  renderDashboard();
}

// ─── Refresh credits from server ──────────────────────────────────────────────
async function refreshCredits() {
  try {
    const data = await api('GET', '/api/stats');
    state.user.credits = data.credits;
    updateSidebarCredits();
  } catch {}
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = `<div class="page-header"><div><div class="page-title">Dashboard</div><div class="page-sub">Welcome back, ${state.user?.name}</div></div><button class="btn-primary" onclick="navigate('build')">+ New Build</button></div><div class="stat-grid" id="stats-grid"><div class="stat-card"><div class="stat-label">Credits</div><div class="stat-value cyan" id="stat-credits">${state.user?.credits}</div></div><div class="stat-card"><div class="stat-label">Projects</div><div class="stat-value purple" id="stat-projects">${state.projects.length}</div></div><div class="stat-card"><div class="stat-label">Plan</div><div class="stat-value yellow" style="font-size:1.2rem;text-transform:capitalize">${state.user?.plan}</div></div><div class="stat-card"><div class="stat-label">Builds</div><div class="stat-value green" id="stat-builds">—</div></div></div><div class="section-title">Your Projects</div><div class="card-grid" id="projects-grid"></div>`;

  try {
    const stats = await api('GET', '/api/stats');
    document.getElementById('stat-credits').textContent = stats.credits;
    document.getElementById('stat-builds').textContent = stats.buildCount;
    state.user.credits = stats.credits;
    updateSidebarCredits();
  } catch {}

  const grid = document.getElementById('projects-grid');
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg><div>No projects yet</div><div style="margin-top:.5rem"><button class="btn-primary btn-sm" onclick="navigate('build')">Start Building</button></div></div>`;
    return;
  }
  grid.innerHTML = state.projects.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <div class="project-name">${esc(p.name)}</div>
      <div class="project-desc">${esc(p.description || 'No description')}</div>
      <div class="project-meta">
        <span class="project-stack">${esc(p.stack || 'custom')}</span>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="project-date">${new Date(p.created_at).toLocaleDateString()}</span>
          <button class="btn-danger btn-sm" onclick="event.stopPropagation();deleteProject('${p.id}')">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function openProject(id) {
  state.currentProject = state.projects.find(p => p.id === id);
  navigate('files');
}

// ─── Build Page ───────────────────────────────────────────────────────────────
function renderBuild() {
  const el = document.getElementById('page-build');
  const projectOptions = state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  el.innerHTML = `
    <div class="page-header"><div><div class="page-title">AI Builder</div><div class="page-sub">Describe what you want to build</div></div></div>
    <div class="build-form">
      <textarea id="build-prompt" placeholder="e.g. Build a SaaS dashboard with authentication, dark mode, analytics charts, and Stripe payments using Next.js and Tailwind..." rows="4"></textarea>
      <div class="build-options">
        <select id="build-stack"><option value="">Auto-detect stack</option><option value="next">Next.js</option><option value="react">React</option><option value="vue">Vue</option><option value="vite">Vite + React</option><option value="express">Express API</option><option value="astro">Astro</option></select>
        <select id="build-db"><option value="">No database</option><option value="postgres">PostgreSQL</option><option value="mongodb">MongoDB</option><option value="sqlite">SQLite</option></select>
        <select id="build-auth"><option value="">No auth</option><option value="nextauth">NextAuth</option><option value="clerk">Clerk</option><option value="jwt">JWT</option></select>
        <select id="build-project"><option value="">Auto-create project</option>${projectOptions}</select>
      </div>
      <div class="build-actions">
        <button class="btn-primary" id="build-btn" onclick="startBuild()">⚡ Build with AI</button>
        <span class="cost-badge">Cost: <span>10 credits</span> • You have <span id="build-credits">${state.user?.credits}</span></span>
      </div>
    </div>
    <div id="build-output" class="hidden">
      <div class="terminal">
        <div class="terminal-bar"><div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div></div>
        <div id="terminal-content"></div>
      </div>
    </div>`;
}

async function startBuild() {
  const prompt = document.getElementById('build-prompt').value.trim();
  if (!prompt) return;

  const stack = document.getElementById('build-stack').value;
  const db = document.getElementById('build-db').value;
  const auth = document.getElementById('build-auth').value;
  const projectId = document.getElementById('build-project').value;

  let fullPrompt = prompt;
  if (stack) fullPrompt += `\n\nTech stack: ${stack}`;
  if (db) fullPrompt += `\nDatabase: ${db}`;
  if (auth) fullPrompt += `\nAuthentication: ${auth}`;
  fullPrompt += '\n\nBuild a COMPLETE, production-ready application with premium design.';

  const btn = document.getElementById('build-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Building...';

  document.getElementById('build-output').classList.remove('hidden');
  const term = document.getElementById('terminal-content');
  term.innerHTML = '';

  const appendLine = (text, cls = 't-text') => {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    term.appendChild(div);
    term.parentElement.scrollTop = term.parentElement.scrollHeight;
  };

  try {
    const res = await fetch('/api/agent/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prompt: fullPrompt, projectId: projectId || undefined }),
    });

    if (!res.ok) {
      const err = await res.json();
      appendLine('✗ ' + err.error, 't-error');
      btn.disabled = false; btn.textContent = '⚡ Build with AI';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'text') appendLine(ev.content, 't-text');
          else if (ev.type === 'tool') appendLine(`⚙ ${ev.name}: ${JSON.stringify(ev.input).slice(0, 80)}`, 't-tool');
          else if (ev.type === 'file_created') appendLine(`✍ ${ev.path}`, 't-file');
          else if (ev.type === 'log') appendLine(ev.text, 't-log');
          else if (ev.type === 'project_created') { state.projects.unshift({ id: ev.projectId, name: ev.name, description: prompt, stack, created_at: new Date().toISOString() }); }
          else if (ev.type === 'complete') { appendLine('✓ ' + (ev.result?.summary || 'Build complete!'), 't-success'); }
          else if (ev.type === 'error') appendLine('✗ ' + ev.message, 't-error');
        } catch {}
      }
    }
  } catch (e) { appendLine('✗ ' + e.message, 't-error'); }

  btn.disabled = false; btn.textContent = '⚡ Build with AI';
  await refreshCredits();
  document.getElementById('build-credits').textContent = state.user.credits;
}
