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

// ─── Chat Page ────────────────────────────────────────────────────────────────
function renderChat() {
  const el = document.getElementById('page-chat');
  const projectOptions = state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  el.innerHTML = `
    <div class="page-header"><div><div class="page-title">AI Chat</div><div class="page-sub">Multi-turn conversation with your AI agent</div></div><button class="btn-secondary btn-sm" onclick="clearChat()">Clear</button></div>
    <select class="project-selector" id="chat-project"><option value="">No project context</option>${projectOptions}</select>
    <div class="chat-wrap" style="height:calc(100vh - 14rem)">
      <div class="chat-messages" id="chat-messages">
        <div class="msg" style="max-width:100%">
          <div class="msg-avatar">AI</div>
          <div class="msg-bubble">👋 Hi! I'm MasterCode, your AI developer. Tell me what you want to build, add, or fix. I can write code, create files, install packages, and build complete full-stack apps.</div>
        </div>
      </div>
      <div class="chat-input-wrap">
        <textarea id="chat-input" placeholder="Ask me to build something, add a feature, fix a bug..." rows="2" onkeydown="chatKeydown(event)"></textarea>
        <button class="btn-primary" id="chat-send" onclick="sendChat()">Send</button>
      </div>
    </div>`;
}

function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function clearChat() {
  state.chatHistory = [];
  renderChat();
}

function appendChatMsg(role, content, isStreaming = false) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.id = isStreaming ? 'streaming-msg' : '';
  div.innerHTML = `<div class="msg-avatar">${role === 'user' ? state.user?.name?.[0] || 'U' : 'AI'}</div><div class="msg-bubble">${esc(content)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const projectId = document.getElementById('chat-project').value;
  input.value = '';
  appendChatMsg('user', message);

  const btn = document.getElementById('chat-send');
  btn.disabled = true; btn.textContent = '...';

  state.chatHistory.push({ role: 'user', content: message });

  // Streaming AI response
  const msgs = document.getElementById('chat-messages');
  const aiDiv = document.createElement('div');
  aiDiv.className = 'msg';
  aiDiv.innerHTML = `<div class="msg-avatar">AI</div><div class="msg-bubble" id="ai-streaming">⏳ Thinking...</div>`;
  msgs.appendChild(aiDiv);
  msgs.scrollTop = msgs.scrollHeight;

  let fullText = '';

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message, projectId: projectId || undefined, history: state.chatHistory.slice(-10) }),
    });

    if (!res.ok) {
      const err = await res.json();
      document.getElementById('ai-streaming').textContent = '✗ ' + err.error;
      btn.disabled = false; btn.textContent = 'Send';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const bubble = document.getElementById('ai-streaming');
    bubble.textContent = '';

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
          if (ev.type === 'text') { fullText += ev.content; bubble.textContent = fullText; }
          else if (ev.type === 'tool') { bubble.textContent = fullText + `\n⚙ ${ev.name}...`; }
          else if (ev.type === 'file_created') { bubble.textContent = fullText + `\n✍ Created: ${ev.path}`; }
          else if (ev.type === 'complete') { bubble.textContent = fullText || ev.result?.summary || 'Done!'; }
          else if (ev.type === 'error') { bubble.textContent = '✗ ' + ev.message; }
          msgs.scrollTop = msgs.scrollHeight;
        } catch {}
      }
    }
  } catch (e) {
    const b = document.getElementById('ai-streaming');
    if (b) b.textContent = '✗ ' + e.message;
  }

  state.chatHistory.push({ role: 'assistant', content: fullText || 'Done' });
  btn.disabled = false; btn.textContent = 'Send';
  await refreshCredits();
}

// ─── File Manager ─────────────────────────────────────────────────────────────
let fileState = { projectId: null, currentPath: '', openFile: null };

function renderFiles() {
  const el = document.getElementById('page-files');
  const projectOptions = state.projects.map(p => `<option value="${p.id}" ${state.currentProject?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">File Manager</div><div class="page-sub">Browse, edit, and manage project files</div></div>
      <div style="display:flex;gap:.75rem;align-items:center">
        <select class="project-selector" id="fm-project" onchange="loadFileTree()" style="margin:0">${projectOptions || '<option value="">No projects</option>'}</select>
        <button class="btn-secondary btn-sm" onclick="newFilePrompt()">+ File</button>
        <button class="btn-secondary btn-sm" onclick="newFolderPrompt()">+ Folder</button>
      </div>
    </div>
    <div class="file-manager">
      <div class="file-tree">
        <div class="tree-header"><span class="tree-title">Files</span></div>
        <div id="file-tree-content"><div style="color:var(--muted);font-size:.82rem;padding:.5rem">Select a project</div></div>
      </div>
      <div class="file-editor">
        <div class="editor-header">
          <span class="editor-filename" id="editor-filename">No file open</span>
          <div style="display:flex;gap:.5rem">
            <button class="btn-secondary btn-sm" id="save-btn" onclick="saveFile()" style="display:none">Save</button>
            <button class="btn-danger btn-sm" id="delete-file-btn" onclick="deleteOpenFile()" style="display:none">Delete</button>
          </div>
        </div>
        <textarea class="editor-textarea" id="editor-content" placeholder="Select a file to edit..." spellcheck="false"></textarea>
      </div>
    </div>`;

  if (state.currentProject) {
    document.getElementById('fm-project').value = state.currentProject.id;
    fileState.projectId = state.currentProject.id;
    loadFileTree();
  }
}

async function loadFileTree() {
  const sel = document.getElementById('fm-project');
  fileState.projectId = sel.value;
  if (!fileState.projectId) return;
  const tree = document.getElementById('file-tree-content');
  tree.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:.5rem">Loading...</div>';
  try {
    const data = await api('GET', `/api/files/${fileState.projectId}?path=`);
    renderFileList(data.files, tree, '');
  } catch (e) { tree.innerHTML = `<div style="color:var(--red);font-size:.82rem">${e.message}</div>`; }
}

function renderFileList(files, container, basePath) {
  container.innerHTML = '';
  const sorted = [...files].sort((a, b) => (a.type === 'dir' ? -1 : 1) - (b.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name));
  for (const f of sorted) {
    const item = document.createElement('div');
    const fullPath = basePath ? `${basePath}/${f.name}` : f.name;
    item.className = `file-item ${f.type}`;
    item.innerHTML = f.type === 'dir'
      ? `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>${esc(f.name)}`
      : `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${esc(f.name)}`;
    if (f.type === 'dir') {
      item.onclick = async () => {
        const sub = document.createElement('div');
        sub.style.paddingLeft = '1rem';
        item.after(sub);
        if (item.dataset.open === '1') { sub.remove(); item.dataset.open = '0'; return; }
        item.dataset.open = '1';
        try {
          const data = await api('GET', `/api/files/${fileState.projectId}?path=${encodeURIComponent(fullPath)}`);
          renderFileList(data.files, sub, fullPath);
        } catch {}
      };
    } else {
      item.onclick = () => openFile(fullPath, f.name);
    }
    container.appendChild(item);
  }
}

async function openFile(filePath, name) {
  try {
    const data = await api('GET', `/api/files/${fileState.projectId}/read?path=${encodeURIComponent(filePath)}`);
    fileState.openFile = filePath;
    document.getElementById('editor-filename').textContent = filePath;
    document.getElementById('editor-content').value = data.content;
    document.getElementById('save-btn').style.display = '';
    document.getElementById('delete-file-btn').style.display = '';
    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
  } catch (e) { alert(e.message); }
}

async function saveFile() {
  if (!fileState.openFile) return;
  const content = document.getElementById('editor-content').value;
  try {
    await api('POST', `/api/files/${fileState.projectId}/write`, { path: fileState.openFile, content });
    const btn = document.getElementById('save-btn');
    btn.textContent = 'Saved!'; setTimeout(() => btn.textContent = 'Save', 1500);
  } catch (e) { alert(e.message); }
}

async function deleteOpenFile() {
  if (!fileState.openFile || !confirm(`Delete ${fileState.openFile}?`)) return;
  try {
    await fetch(`/api/files/${fileState.projectId}/delete?path=${encodeURIComponent(fileState.openFile)}`, { method: 'DELETE', credentials: 'include' });
    fileState.openFile = null;
    document.getElementById('editor-filename').textContent = 'No file open';
    document.getElementById('editor-content').value = '';
    document.getElementById('save-btn').style.display = 'none';
    document.getElementById('delete-file-btn').style.display = 'none';
    loadFileTree();
  } catch (e) { alert(e.message); }
}

async function newFilePrompt() {
  const name = prompt('File name (e.g. src/components/Button.tsx):');
  if (!name || !fileState.projectId) return;
  await api('POST', `/api/files/${fileState.projectId}/write`, { path: name, content: '' });
  loadFileTree();
  openFile(name, name.split('/').pop());
}

async function newFolderPrompt() {
  const name = prompt('Folder name:');
  if (!name || !fileState.projectId) return;
  await api('POST', `/api/files/${fileState.projectId}/write`, { path: `${name}/.gitkeep`, content: '' });
  loadFileTree();
}

// ─── Credits Page ─────────────────────────────────────────────────────────────
async function renderCredits() {
  const el = document.getElementById('page-credits');
  el.innerHTML = `<div class="page-header"><div><div class="page-title">Credits & Billing</div><div class="page-sub">Manage your credits and plan</div></div></div><div id="credits-content"><div style="color:var(--muted)">Loading...</div></div>`;
  try {
    const data = await api('GET', '/api/credits');
    state.user.credits = data.credits;
    updateSidebarCredits();
    const plans = [
      { id: 'free', name: 'Free', price: 0, credits: 100 },
      { id: 'starter', name: 'Starter', price: 9, credits: 500 },
      { id: 'pro', name: 'Pro', price: 29, credits: 2000 },
      { id: 'enterprise', name: 'Enterprise', price: 99, credits: 10000 },
    ];
    const txHtml = (data.history || []).slice(0, 20).map(t => `
      <div class="tx-item">
        <span class="tx-desc">${esc(t.description || t.type)}</span>
        <span class="tx-amount ${t.amount > 0 ? 'pos' : 'neg'}">${t.amount > 0 ? '+' : ''}${t.amount}</span>
        <span class="tx-date">${new Date(t.created_at).toLocaleDateString()}</span>
      </div>`).join('') || '<div style="color:var(--muted);font-size:.85rem">No transactions yet</div>';

    document.getElementById('credits-content').innerHTML = `
      <div class="stat-grid" style="margin-bottom:2rem">
        <div class="stat-card"><div class="stat-label">Current Balance</div><div class="stat-value cyan">${data.credits}</div></div>
        <div class="stat-card"><div class="stat-label">Current Plan</div><div class="stat-value yellow" style="font-size:1.2rem;text-transform:capitalize">${state.user.plan}</div></div>
        <div class="stat-card"><div class="stat-label">Build Cost</div><div class="stat-value" style="font-size:1.2rem">${data.costs.build} cr</div></div>
        <div class="stat-card"><div class="stat-label">Chat Cost</div><div class="stat-value" style="font-size:1.2rem">${data.costs.chat_message} cr</div></div>
      </div>
      <div class="section-title">Plans</div>
      <div class="plans-grid">${plans.map(p => `<div class="plan-card ${state.user.plan === p.id ? 'current' : ''}"><div class="plan-name">${p.name}</div><div class="plan-price">$${p.price}<span>/mo</span></div><div class="plan-credits">${p.credits.toLocaleString()} credits</div>${state.user.plan === p.id ? '<div style="margin-top:.75rem"><span class="badge badge-cyan">Current</span></div>' : `<button class="btn-primary btn-sm" style="margin-top:.75rem;width:100%" onclick="alert('Stripe integration coming soon!')">Upgrade</button>`}</div>`).join('')}</div>
      <hr class="divider">
      <div class="flex-between" style="margin-bottom:1rem"><div class="section-title" style="margin:0">Add Credits (Demo)</div><button class="btn-primary btn-sm" onclick="topupCredits()">+ Add 100 Credits</button></div>
      <div class="section-title">Transaction History</div>
      <div class="tx-list">${txHtml}</div>`;
  } catch (e) { document.getElementById('credits-content').innerHTML = `<div style="color:var(--red)">${e.message}</div>`; }
}

async function topupCredits() {
  try {
    const data = await api('POST', '/api/credits/topup', { amount: 100 });
    state.user.credits = data.credits;
    updateSidebarCredits();
    renderCredits();
  } catch (e) { alert(e.message); }
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('page-settings');
  el.innerHTML = `
    <div class="page-header"><div><div class="page-title">Settings</div><div class="page-sub">Configure your account and API keys</div></div></div>
    <div class="card" style="max-width:600px">
      <div class="settings-section">
        <div class="settings-label">Anthropic API Key</div>
        <div class="settings-row">
          <input type="password" class="settings-input" id="api-key-input" placeholder="sk-ant-api03-..." value="">
          <button class="btn-primary" onclick="saveApiKey()">Save</button>
        </div>
        <div style="color:var(--muted);font-size:.78rem;margin-top:.5rem">Your key is stored securely and used for AI builds. Get one at <a href="https://console.anthropic.com" target="_blank" style="color:var(--cyan)">console.anthropic.com</a></div>
      </div>
      <hr class="divider">
      <div class="settings-section">
        <div class="settings-label">Account</div>
        <div style="display:grid;gap:.5rem;font-size:.88rem">
          <div class="flex-between"><span style="color:var(--muted)">Name</span><span>${esc(state.user?.name || '')}</span></div>
          <div class="flex-between"><span style="color:var(--muted)">Email</span><span>${esc(state.user?.email || '')}</span></div>
          <div class="flex-between"><span style="color:var(--muted)">Plan</span><span style="text-transform:capitalize">${state.user?.plan}</span></div>
          <div class="flex-between"><span style="color:var(--muted)">Credits</span><span style="color:var(--cyan)">${state.user?.credits}</span></div>
        </div>
      </div>
      <hr class="divider">
      <div class="settings-section">
        <div class="settings-label">CLI Usage</div>
        <div style="background:var(--surface);border-radius:8px;padding:1rem;font-family:monospace;font-size:.82rem;color:var(--dim)">
          <div style="color:var(--muted);margin-bottom:.5rem"># Install globally</div>
          <div>npm install -g mastercode</div>
          <div style="margin-top:.75rem;color:var(--muted)"># Set API key</div>
          <div>mc config set-key sk-ant-...</div>
          <div style="margin-top:.75rem;color:var(--muted)"># Build a project</div>
          <div>mc build "your app description"</div>
        </div>
      </div>
    </div>`;
}

async function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  try {
    await api('POST', '/api/credits/set-api-key', { apiKey: key });
    document.getElementById('api-key-input').value = '';
    alert('API key saved!');
  } catch (e) { alert(e.message); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
