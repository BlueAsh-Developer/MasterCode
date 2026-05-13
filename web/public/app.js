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
