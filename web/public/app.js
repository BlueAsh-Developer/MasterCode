// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  user: null,
  projects: [],
  currentProject: null,
  chatHistory: [],
  selectedModel: 'claude-opus-4-5',
  selectedProvider: 'claude',
  models: { claude: [], gemini: [] },
  envVars: [],
  currentFile: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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

// ─── Homepage ─────────────────────────────────────────────────────────────────
function showAuth(tab) {
  document.getElementById('auth-modal').classList.remove('hidden');
  showTab(tab);
}
function hideAuth() {
  document.getElementById('auth-modal').classList.add('hidden');
}
function closeAuthModal(e) {
  if (e.target.id === 'auth-modal') hideAuth();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
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
    hideAuth();
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
    hideAuth();
    showApp();
  } catch (ex) { err.textContent = ex.message; }
}

async function logout() {
  await api('POST', '/api/auth/logout').catch(() => {});
  state.user = null;
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('home-screen').classList.remove('hidden');
}

async function checkAuth() {
  try {
    const data = await api('GET', '/api/auth/me');
    state.user = data.user;
    showApp();
  } catch { /* not logged in, show homepage */ }
}

function showApp() {
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  updateSidebarCredits();
  loadModels();
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

// ─── Models ───────────────────────────────────────────────────────────────────
async function loadModels() {
  try {
    const data = await api('GET', '/api/models');
    state.models = data.models;
    renderModelDropdown('model-dropdown', 'model-selector-label', 'model-dot', selectModel);
    renderModelDropdown('chat-model-dropdown', 'chat-model-label', 'chat-model-dot', selectChatModel);
  } catch {}
}

function renderModelDropdown(dropdownId, labelId, dotId, onSelect) {
  const el = document.getElementById(dropdownId);
  if (!el) return;
  const { claude = [], gemini = [] } = state.models;
  el.innerHTML = `
    <div class="model-group">
      <div class="model-group-label"><span class="provider-dot claude-dot"></span>Anthropic Claude</div>
      ${claude.map(m => `<div class="model-option ${state.selectedModel === m.id ? 'active' : ''}" onclick="${onSelect.name}('${m.id}','claude','${dropdownId}','${labelId}','${dotId}')">
        <div class="model-opt-name">${m.name}</div>
        <div class="model-opt-desc">${m.desc}</div>
        <span class="model-tag ${m.badge.toLowerCase()}">${m.badge}</span>
      </div>`).join('')}
    </div>
    <div class="model-group">
      <div class="model-group-label"><span class="provider-dot gemini-dot"></span>Google Gemini</div>
      ${gemini.map(m => `<div class="model-option ${state.selectedModel === m.id ? 'active' : ''}" onclick="${onSelect.name}('${m.id}','gemini','${dropdownId}','${labelId}','${dotId}')">
        <div class="model-opt-name">${m.name}</div>
        <div class="model-opt-desc">${m.desc}</div>
        <span class="model-tag ${m.badge.toLowerCase()}">${m.badge}</span>
      </div>`).join('')}
    </div>`;
  // Set initial label
  const all = [...claude, ...gemini];
  const cur = all.find(m => m.id === state.selectedModel);
  if (cur) {
    document.getElementById(labelId).textContent = cur.name;
    const dot = document.getElementById(dotId);
    if (dot) dot.className = `model-provider-dot ${state.selectedProvider}-dot`;
  }
}

function selectModel(id, provider, dropdownId, labelId, dotId) {
  state.selectedModel = id;
  state.selectedProvider = provider;
  const all = [...(state.models.claude || []), ...(state.models.gemini || [])];
  const m = all.find(x => x.id === id);
  if (m) {
    document.getElementById(labelId).textContent = m.name;
    const dot = document.getElementById(dotId);
    if (dot) dot.className = `model-provider-dot ${provider}-dot`;
  }
  document.getElementById(dropdownId).classList.remove('open');
}

function selectChatModel(id, provider, dropdownId, labelId, dotId) {
  selectModel(id, provider, dropdownId, labelId, dotId);
}

function toggleModelDropdown() {
  const dd = document.getElementById('model-dropdown');
  dd.classList.toggle('open');
  renderModelDropdown('model-dropdown', 'model-selector-label', 'model-dot', selectModel);
}

function toggleChatModelDropdown() {
  const dd = document.getElementById('chat-model-dropdown');
  dd.classList.toggle('open');
  renderModelDropdown('chat-model-dropdown', 'chat-model-label', 'chat-model-dot', selectChatModel);
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#model-dropdown-wrap')) document.getElementById('model-dropdown')?.classList.remove('open');
  if (!e.target.closest('#chat-model-dropdown-wrap')) document.getElementById('chat-model-dropdown')?.classList.remove('open');
});

// ─── Projects ─────────────────────────────────────────────────────────────────
async function loadProjects() {
  const data = await api('GET', '/api/projects');
  state.projects = data.projects;
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its files?')) return;
  await api('DELETE', `/api/projects/${id}`);
  state.projects = state.projects.filter(p => p.id !== id);
  renderDashboard();
}

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
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Dashboard</div><div class="page-sub">Welcome back, ${esc(state.user?.name)}</div></div>
      <button class="btn-primary" onclick="navigate('build')">+ New Build</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Credits</div><div class="stat-value cyan" id="stat-credits">${state.user?.credits}</div></div>
      <div class="stat-card"><div class="stat-label">Projects</div><div class="stat-value purple">${state.projects.length}</div></div>
      <div class="stat-card"><div class="stat-label">Plan</div><div class="stat-value yellow" style="font-size:1.1rem;text-transform:capitalize">${state.user?.plan}</div></div>
      <div class="stat-card"><div class="stat-label">Builds</div><div class="stat-value green" id="stat-builds">—</div></div>
    </div>
    <div class="section-title">Your Projects</div>
    <div class="card-grid" id="projects-grid"></div>`;

  try {
    const stats = await api('GET', '/api/stats');
    document.getElementById('stat-credits').textContent = stats.credits;
    document.getElementById('stat-builds').textContent = stats.buildCount;
    state.user.credits = stats.credits;
    updateSidebarCredits();
  } catch {}

  const grid = document.getElementById('projects-grid');
  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">📁</div>
      <div>No projects yet</div>
      <button class="btn-primary btn-sm" style="margin-top:.75rem" onclick="navigate('build')">Start Building</button>
    </div>`;
    return;
  }
  grid.innerHTML = state.projects.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <div class="project-card-top">
        <div class="project-name">${esc(p.name)}</div>
        <button class="btn-icon" onclick="event.stopPropagation();deleteProject('${p.id}')" title="Delete">✕</button>
      </div>
      <div class="project-desc">${esc(p.description || 'No description')}</div>
      <div class="project-meta">
        <span class="project-stack">${esc(p.stack || 'custom')}</span>
        <span class="project-date">${new Date(p.created_at).toLocaleDateString()}</span>
      </div>
    </div>`).join('');
}

// ─── Build Page ───────────────────────────────────────────────────────────────
function renderBuild() {
  const el = document.getElementById('page-build');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Build</div><div class="page-sub">Describe your app and let AI build it</div></div>
    </div>
    <div class="build-form">
      <textarea id="build-prompt" placeholder="Describe your app... e.g. 'SaaS dashboard with auth, charts, dark mode and Stripe payments'" rows="4"></textarea>
      <div class="build-options">
        <select id="build-stack">
          <option value="">Auto-detect stack</option>
          <option value="next">Next.js</option>
          <option value="react">React + Vite</option>
          <option value="vue">Vue 3</option>
          <option value="svelte">SvelteKit</option>
          <option value="astro">Astro</option>
          <option value="express">Express API</option>
          <option value="fastapi">FastAPI</option>
        </select>
        <select id="build-style">
          <option value="tailwind">Tailwind CSS</option>
          <option value="shadcn">shadcn/ui</option>
          <option value="chakra">Chakra UI</option>
          <option value="mui">Material UI</option>
          <option value="css">Plain CSS</option>
        </select>
        <select id="build-db">
          <option value="">No database</option>
          <option value="postgres">PostgreSQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="sqlite">SQLite</option>
          <option value="supabase">Supabase</option>
        </select>
        <select id="build-auth">
          <option value="">No auth</option>
          <option value="nextauth">NextAuth</option>
          <option value="clerk">Clerk</option>
          <option value="jwt">JWT</option>
          <option value="supabase">Supabase Auth</option>
        </select>
      </div>
      <div class="build-actions">
        <div class="model-dropdown-wrap" id="build-model-wrap">
          <button class="model-selector-btn" id="build-model-btn" onclick="toggleBuildModelDropdown()">
            <span class="model-provider-dot" id="build-model-dot"></span>
            <span id="build-model-label">Select Model</span>
            <svg class="chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
          <div class="model-dropdown" id="build-model-dropdown"></div>
        </div>
        <button class="btn-primary" id="build-btn" onclick="startBuild()">⚡ Build App</button>
        <span class="cost-badge">Cost: <span>10 credits</span></span>
      </div>
    </div>
    <div id="build-output" class="hidden">
      <div class="terminal">
        <div class="terminal-bar"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span><span class="demo-title">Agent Output</span></div>
        <div class="terminal-body" id="build-terminal"></div>
      </div>
    </div>`;

  // Init build model dropdown
  setTimeout(() => {
    renderModelDropdown('build-model-dropdown', 'build-model-label', 'build-model-dot', selectBuildModel);
    document.addEventListener('click', e => {
      if (!e.target.closest('#build-model-wrap')) document.getElementById('build-model-dropdown')?.classList.remove('open');
    });
  }, 0);
}

function selectBuildModel(id, provider) {
  state.selectedModel = id;
  state.selectedProvider = provider;
  const all = [...(state.models.claude || []), ...(state.models.gemini || [])];
  const m = all.find(x => x.id === id);
  if (m) {
    document.getElementById('build-model-label').textContent = m.name;
    const dot = document.getElementById('build-model-dot');
    if (dot) dot.className = `model-provider-dot ${provider}-dot`;
  }
  document.getElementById('build-model-dropdown').classList.remove('open');
}

function toggleBuildModelDropdown() {
  const dd = document.getElementById('build-model-dropdown');
  dd.classList.toggle('open');
  renderModelDropdown('build-model-dropdown', 'build-model-label', 'build-model-dot', selectBuildModel);
}

async function startBuild() {
  const prompt = document.getElementById('build-prompt').value.trim();
  if (!prompt) return;
  const stack = document.getElementById('build-stack').value;
  const style = document.getElementById('build-style').value;
  const db = document.getElementById('build-db').value;
  const auth = document.getElementById('build-auth').value;

  const fullPrompt = [prompt, stack && `Stack: ${stack}`, style && `Styling: ${style}`, db && `Database: ${db}`, auth && `Auth: ${auth}`].filter(Boolean).join('\n');

  const btn = document.getElementById('build-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Building...';

  const output = document.getElementById('build-output');
  const terminal = document.getElementById('build-terminal');
  output.classList.remove('hidden');
  terminal.innerHTML = '';

  const appendLine = (cls, text) => {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
  };

  try {
    const res = await fetch('/api/agent/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prompt: fullPrompt, model: state.selectedModel, provider: state.selectedProvider }),
    });

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
          if (ev.type === 'text') appendLine('t-text', ev.content);
          else if (ev.type === 'tool') appendLine('t-tool', `▶ ${ev.name}: ${JSON.stringify(ev.input).slice(0, 80)}`);
          else if (ev.type === 'file_created') appendLine('t-file', `✓ ${ev.path}`);
          else if (ev.type === 'log') appendLine('t-log', ev.text);
          else if (ev.type === 'complete') { appendLine('t-success', '✦ Build complete!'); refreshCredits(); }
          else if (ev.type === 'error') appendLine('t-error', `✗ ${ev.message}`);
          else if (ev.type === 'project_created') {
            state.projects.unshift({ id: ev.projectId, name: ev.name, description: fullPrompt, created_at: new Date().toISOString() });
          }
        } catch {}
      }
    }
  } catch (e) {
    appendLine('t-error', `Error: ${e.message}`);
  }

  btn.disabled = false;
  btn.textContent = '⚡ Build App';
}

// ─── Chat Page ────────────────────────────────────────────────────────────────
function renderChat() {
  const el = document.getElementById('page-chat');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">AI Chat</div><div class="page-sub">Chat with AI about your projects</div></div>
    </div>
    <div class="chat-wrap">
      <div class="chat-messages" id="chat-messages">
        <div class="msg ai"><div class="msg-avatar">AI</div><div class="msg-bubble">Hi! I'm MasterCode. Ask me to build something, fix a bug, or explain code.</div></div>
      </div>
      <div class="chat-input-area">
        <div class="chat-toolbar">
          <select id="chat-project-select" class="chat-select">
            <option value="">No project context</option>
            ${state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
          <div class="model-dropdown-wrap" id="page-chat-model-wrap">
            <button class="model-selector-btn sm" id="page-chat-model-btn" onclick="togglePageChatModelDropdown()">
              <span class="model-provider-dot" id="page-chat-dot"></span>
              <span id="page-chat-model-label">Select Model</span>
              <svg class="chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
            <div class="model-dropdown" id="page-chat-model-dropdown"></div>
          </div>
        </div>
        <div class="chat-input-row">
          <textarea id="chat-input" class="chat-input" placeholder="Ask anything..." rows="2" onkeydown="pageChatKeydown(event)"></textarea>
          <button class="btn-primary" id="chat-send-btn" onclick="sendPageChat()">Send</button>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    renderModelDropdown('page-chat-model-dropdown', 'page-chat-model-label', 'page-chat-dot', selectPageChatModel);
    document.addEventListener('click', e => {
      if (!e.target.closest('#page-chat-model-wrap')) document.getElementById('page-chat-model-dropdown')?.classList.remove('open');
    });
  }, 0);
}

function selectPageChatModel(id, provider) { selectModel(id, provider, 'page-chat-model-dropdown', 'page-chat-model-label', 'page-chat-dot'); }
function togglePageChatModelDropdown() {
  document.getElementById('page-chat-model-dropdown').classList.toggle('open');
  renderModelDropdown('page-chat-model-dropdown', 'page-chat-model-label', 'page-chat-dot', selectPageChatModel);
}
function pageChatKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPageChat(); } }

async function sendPageChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messages = document.getElementById('chat-messages');
  messages.innerHTML += `<div class="msg user"><div class="msg-avatar">You</div><div class="msg-bubble">${esc(msg)}</div></div>`;

  const aiDiv = document.createElement('div');
  aiDiv.className = 'msg ai';
  aiDiv.innerHTML = `<div class="msg-avatar">AI</div><div class="msg-bubble" id="ai-resp-${Date.now()}"><span class="typing-dots">···</span></div>`;
  messages.appendChild(aiDiv);
  messages.scrollTop = messages.scrollHeight;

  const bubble = aiDiv.querySelector('.msg-bubble');
  const projectId = document.getElementById('chat-project-select')?.value;

  state.chatHistory.push({ role: 'user', content: msg });

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ message: msg, projectId, history: state.chatHistory.slice(-10), model: state.selectedModel, provider: state.selectedProvider }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', fullText = '';
    bubble.innerHTML = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'text') { fullText += ev.content; bubble.textContent = fullText; messages.scrollTop = messages.scrollHeight; }
          else if (ev.type === 'complete') refreshCredits();
        } catch {}
      }
    }
    state.chatHistory.push({ role: 'assistant', content: fullText });
  } catch (e) { bubble.textContent = `Error: ${e.message}`; }
}

// ─── Files Page ───────────────────────────────────────────────────────────────
function renderFiles() {
  const el = document.getElementById('page-files');
  if (!state.projects.length) {
    el.innerHTML = `<div class="page-header"><div class="page-title">File Manager</div></div><div class="empty-state"><div class="empty-icon">📁</div><div>No projects yet</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="page-header"><div class="page-title">File Manager</div></div>
    <div class="files-project-select">
      <select id="files-project" onchange="loadFileTree()" class="settings-input" style="max-width:300px">
        <option value="">Select a project</option>
        ${state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="files-layout">
      <div class="file-tree" id="page-file-tree"><div class="empty-state" style="padding:2rem">Select a project</div></div>
      <div class="code-editor-wrap">
        <div class="editor-toolbar">
          <span class="editor-filename" id="page-editor-filename">No file selected</span>
          <button class="btn-sm btn-secondary" onclick="savePageFile()">Save</button>
        </div>
        <textarea class="code-editor" id="page-code-editor" spellcheck="false" placeholder="Select a file to edit..."></textarea>
      </div>
    </div>`;
}

async function loadFileTree() {
  const projectId = document.getElementById('files-project')?.value;
  if (!projectId) return;
  const tree = document.getElementById('page-file-tree');
  tree.innerHTML = '<div style="padding:1rem;color:var(--muted)">Loading...</div>';
  try {
    const data = await api('GET', `/api/files/${projectId}`);
    tree.innerHTML = renderFileList(data.files, projectId, '');
  } catch (e) { tree.innerHTML = `<div style="color:var(--red);padding:1rem">${e.message}</div>`; }
}

function renderFileList(files, projectId, basePath) {
  return files.map(f => {
    if (f.type === 'dir') return `<div class="tree-dir" onclick="toggleDir(this,'${projectId}','${f.path}')"><span class="tree-icon">📁</span>${esc(f.name)}<div class="tree-children hidden"></div></div>`;
    return `<div class="tree-file" onclick="openPageFile('${projectId}','${f.path}')"><span class="tree-icon">📄</span>${esc(f.name)}</div>`;
  }).join('');
}

async function toggleDir(el, projectId, dirPath) {
  const children = el.querySelector('.tree-children');
  if (children.classList.toggle('hidden')) return;
  if (children.innerHTML) return;
  try {
    const data = await api('GET', `/api/files/${projectId}?path=${encodeURIComponent(dirPath)}`);
    children.innerHTML = renderFileList(data.files, projectId, dirPath);
  } catch {}
}

async function openPageFile(projectId, filePath) {
  try {
    const data = await api('GET', `/api/files/${projectId}/read?path=${encodeURIComponent(filePath)}`);
    document.getElementById('page-code-editor').value = data.content;
    document.getElementById('page-editor-filename').textContent = filePath;
    state.currentFile = { projectId, path: filePath };
  } catch (e) { alert(e.message); }
}

async function savePageFile() {
  if (!state.currentFile) return;
  const content = document.getElementById('page-code-editor').value;
  try {
    await api('POST', `/api/files/${state.currentFile.projectId}/write`, { path: state.currentFile.path, content });
  } catch (e) { alert(e.message); }
}

// ─── Credits Page ─────────────────────────────────────────────────────────────
async function renderCredits() {
  const el = document.getElementById('page-credits');
  el.innerHTML = `<div class="page-header"><div class="page-title">Credits</div></div><div style="color:var(--muted)">Loading...</div>`;
  try {
    const data = await api('GET', '/api/credits');
    el.innerHTML = `
      <div class="page-header"><div><div class="page-title">Credits</div><div class="page-sub">Manage your usage</div></div></div>
      <div class="stat-grid" style="margin-bottom:2rem">
        <div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value cyan">${data.credits}</div></div>
        <div class="stat-card"><div class="stat-label">Plan</div><div class="stat-value purple" style="font-size:1.1rem;text-transform:capitalize">${data.plan}</div></div>
      </div>
      <div class="card" style="margin-bottom:1.5rem">
        <div class="section-title" style="margin-bottom:1rem">Top Up Credits</div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          ${[50,100,200,500].map(n => `<button class="btn-secondary" onclick="topUp(${n})">${n} credits</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-bottom:1rem">Credit Costs</div>
        <div class="cost-table">
          <div class="cost-row"><span>Build</span><span class="cost-val">10 credits</span></div>
          <div class="cost-row"><span>Chat message</span><span class="cost-val">1 credit</span></div>
        </div>
      </div>`;
  } catch (e) { el.innerHTML = `<div style="color:var(--red)">${e.message}</div>`; }
}

async function topUp(amount) {
  try {
    const data = await api('POST', '/api/credits/topup', { amount });
    state.user.credits = data.credits;
    updateSidebarCredits();
    renderCredits();
  } catch (e) { alert(e.message); }
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('page-settings');
  el.innerHTML = `
    <div class="page-header"><div><div class="page-title">Settings</div><div class="page-sub">Configure your API keys and preferences</div></div></div>
    <div class="card" style="margin-bottom:1.5rem">
      <div class="section-title" style="margin-bottom:1rem">API Keys</div>
      <div class="settings-form">
        <label>Anthropic API Key
          <input type="password" id="anthropic-key" class="settings-input" placeholder="sk-ant-api03-...">
        </label>
        <label>Google Gemini API Key
          <input type="password" id="gemini-key" class="settings-input" placeholder="AIza...">
        </label>
        <button class="btn-primary" onclick="saveApiKeys()">Save Keys</button>
        <div id="keys-msg" class="form-error" style="color:var(--green)"></div>
      </div>
    </div>
    <div class="card">
      <div class="section-title" style="margin-bottom:1rem">Account</div>
      <div style="color:var(--muted);font-size:.9rem">
        <div>Email: ${esc(state.user?.email)}</div>
        <div style="margin-top:.5rem">Name: ${esc(state.user?.name)}</div>
        <div style="margin-top:.5rem">Plan: ${esc(state.user?.plan)}</div>
      </div>
    </div>`;
}

async function saveApiKeys() {
  const anthropicKey = document.getElementById('anthropic-key').value.trim();
  const geminiKey = document.getElementById('gemini-key').value.trim();
  const msg = document.getElementById('keys-msg');
  try {
    await api('POST', '/api/credits/set-api-key', { apiKey: anthropicKey || undefined, geminiApiKey: geminiKey || undefined });
    msg.textContent = '✓ Keys saved successfully';
    msg.style.color = 'var(--green)';
  } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--red)'; }
}
