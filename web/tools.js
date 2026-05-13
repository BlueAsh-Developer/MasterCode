import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { glob } from 'glob';
import fetch from 'node-fetch';

export class WebToolExecutor {
  constructor(projectDir, sendEvent) {
    this.projectDir = projectDir;
    this.send = sendEvent || (() => {});
  }

  resolvePath(p) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(this.projectDir, p);
    // Security: keep within project dir
    if (!resolved.startsWith(this.projectDir) && !resolved.startsWith('/tmp')) {
      return this.projectDir;
    }
    return resolved;
  }

  async execute(name, input) {
    this.send({ type: 'tool', name, input });
    let result;
    switch (name) {
      case 'read_file':       result = await this.readFile(input); break;
      case 'write_file':      result = await this.writeFile(input); break;
      case 'list_files':      result = await this.listFiles(input); break;
      case 'run_command':     result = await this.runCommand(input); break;
      case 'install_packages':result = await this.installPackages(input); break;
      case 'create_directory':result = await this.createDirectory(input); break;
      case 'delete_file':     result = await this.deleteFile(input); break;
      case 'search_files':    result = await this.searchFiles(input); break;
      case 'scaffold_project':result = await this.scaffoldProject(input); break;
      case 'fetch_url':       result = await this.fetchUrl(input); break;
      case 'git_command':     result = await this.gitCommand(input); break;
      case 'get_file_tree':   result = await this.getFileTree(input); break;
      case 'rename_file':     result = await this.renameFile(input); break;
      case 'copy_file':       result = await this.copyFile(input); break;
      case 'task_complete':   result = { done: true, ...input }; break;
      default:                result = { error: `Unknown tool: ${name}` };
    }
    this.send({ type: 'tool_result', name, result });
    return result;
  }

  async readFile({ path: p }) {
    try {
      const content = await fs.readFile(this.resolvePath(p), 'utf-8');
      return { content, size: content.length };
    } catch (e) { return { error: e.message }; }
  }

  async writeFile({ path: p, content }) {
    try {
      const resolved = this.resolvePath(p);
      await fs.ensureDir(path.dirname(resolved));
      await fs.writeFile(resolved, content, 'utf-8');
      this.send({ type: 'file_created', path: p });
      return { success: true, path: p, bytes: content.length };
    } catch (e) { return { error: e.message }; }
  }

  async listFiles({ path: p, recursive = false }) {
    try {
      const resolved = this.resolvePath(p);
      if (recursive) {
        const files = await glob('**/*', { cwd: resolved, dot: false, ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'] });
        return { files };
      }
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return { files: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
    } catch (e) { return { error: e.message }; }
  }

  async getFileTree({ path: p }) {
    try {
      const resolved = this.resolvePath(p || '.');
      const build = async (dir, depth = 0) => {
        if (depth > 4) return [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const result = [];
        for (const e of entries) {
          if (['node_modules', '.git', 'dist', '.next', 'build', '.cache'].includes(e.name)) continue;
          const item = { name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: path.relative(resolved, path.join(dir, e.name)) };
          if (e.isDirectory()) item.children = await build(path.join(dir, e.name), depth + 1);
          result.push(item);
        }
        return result;
      };
      return { tree: await build(resolved) };
    } catch (e) { return { error: e.message }; }
  }

  async runCommand({ command, cwd }) {
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.projectDir;
      this.send({ type: 'log', text: `$ ${command}` });
      const result = await execa('bash', ['-c', command], { cwd: workDir, timeout: 120000, all: true });
      if (result.stdout) this.send({ type: 'log', text: result.stdout.slice(0, 500) });
      return { stdout: result.stdout?.slice(0, 2000), stderr: result.stderr?.slice(0, 500), exitCode: result.exitCode };
    } catch (e) {
      return { error: e.message, stdout: e.stdout?.slice(0, 1000), stderr: e.stderr?.slice(0, 500), exitCode: e.exitCode };
    }
  }

  async installPackages({ packages, manager = 'npm', dev = false, cwd }) {
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.projectDir;
      const flag = dev ? (manager === 'npm' ? '--save-dev' : manager === 'yarn' ? '--dev' : '-D') : '';
      const cmds = { npm: `npm install ${flag} ${packages.join(' ')}`, yarn: `yarn add ${flag} ${packages.join(' ')}`, pnpm: `pnpm add ${flag} ${packages.join(' ')}`, pip: `pip install ${packages.join(' ')}`, pip3: `pip3 install ${packages.join(' ')}` };
      this.send({ type: 'log', text: `Installing: ${packages.join(', ')}` });
      const result = await execa('bash', ['-c', cmds[manager] || cmds.npm], { cwd: workDir, timeout: 180000, all: true });
      return { success: true, installed: packages };
    } catch (e) { return { error: e.message }; }
  }

  async createDirectory({ path: p }) {
    try { await fs.ensureDir(this.resolvePath(p)); return { success: true }; }
    catch (e) { return { error: e.message }; }
  }

  async deleteFile({ path: p, recursive = false }) {
    try {
      const resolved = this.resolvePath(p);
      if (recursive) await fs.remove(resolved); else await fs.unlink(resolved);
      return { success: true };
    } catch (e) { return { error: e.message }; }
  }

  async renameFile({ from, to }) {
    try {
      await fs.move(this.resolvePath(from), this.resolvePath(to));
      return { success: true };
    } catch (e) { return { error: e.message }; }
  }

  async copyFile({ from, to }) {
    try {
      await fs.copy(this.resolvePath(from), this.resolvePath(to));
      return { success: true };
    } catch (e) { return { error: e.message }; }
  }

  async searchFiles({ pattern, path: p, filePattern = '**/*' }) {
    try {
      const resolved = this.resolvePath(p);
      const files = await glob(filePattern, { cwd: resolved, ignore: ['node_modules/**', '.git/**'] });
      const regex = new RegExp(pattern, 'gi');
      const results = [];
      for (const file of files.slice(0, 50)) {
        try {
          const content = await fs.readFile(path.join(resolved, file), 'utf-8');
          content.split('\n').forEach((line, i) => {
            if (regex.test(line)) results.push({ file, line: i + 1, content: line.trim() });
          });
        } catch {}
      }
      return { results: results.slice(0, 100) };
    } catch (e) { return { error: e.message }; }
  }

  async scaffoldProject({ template, name, path: outPath }) {
    try {
      const resolved = this.resolvePath(outPath);
      await fs.ensureDir(resolved);
      const cmds = {
        next: `npx create-next-app@latest ${name} --typescript --tailwind --eslint --app --src-dir --yes`,
        react: `npx create-react-app ${name} --template typescript`,
        vue: `npx create-vue@latest ${name} --typescript --router --pinia --yes`,
        vite: `npx create-vite@latest ${name} --template react-ts`,
        astro: `npx create-astro@latest ${name} --template minimal --yes`,
      };
      const cmd = cmds[template.toLowerCase()];
      if (cmd) {
        this.send({ type: 'log', text: `Scaffolding ${template}...` });
        await execa('bash', ['-c', cmd], { cwd: resolved, timeout: 300000 });
      }
      return { success: true, path: path.join(resolved, name) };
    } catch (e) { return { error: e.message }; }
  }

  async fetchUrl({ url }) {
    try {
      const res = await fetch(url, { timeout: 10000 });
      const text = await res.text();
      return { content: text.slice(0, 5000), status: res.status };
    } catch (e) { return { error: e.message }; }
  }

  async gitCommand({ command, cwd }) {
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.projectDir;
      const result = await execa('bash', ['-c', `git ${command}`], { cwd: workDir, timeout: 30000, all: true });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (e) { return { error: e.message, stderr: e.stderr }; }
  }
}

// All tools for Claude
export const WEB_TOOLS = [
  { name: 'read_file', description: 'Read file contents', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'write_file', description: 'Write content to a file', input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'list_files', description: 'List files in directory', input_schema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, required: ['path'] } },
  { name: 'get_file_tree', description: 'Get full file tree of project', input_schema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'run_command', description: 'Run a shell command', input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
  { name: 'install_packages', description: 'Install packages', input_schema: { type: 'object', properties: { packages: { type: 'array', items: { type: 'string' } }, manager: { type: 'string', enum: ['npm', 'yarn', 'pnpm', 'pip', 'pip3'] }, dev: { type: 'boolean' }, cwd: { type: 'string' } }, required: ['packages'] } },
  { name: 'create_directory', description: 'Create directory', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'delete_file', description: 'Delete file or directory', input_schema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, required: ['path'] } },
  { name: 'rename_file', description: 'Rename or move a file', input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] } },
  { name: 'copy_file', description: 'Copy a file', input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] } },
  { name: 'search_files', description: 'Search text in files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, filePattern: { type: 'string' } }, required: ['pattern', 'path'] } },
  { name: 'scaffold_project', description: 'Scaffold a new project', input_schema: { type: 'object', properties: { template: { type: 'string' }, name: { type: 'string' }, path: { type: 'string' } }, required: ['template', 'name', 'path'] } },
  { name: 'fetch_url', description: 'Fetch URL content', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'git_command', description: 'Run a git command (init, status, add, commit, log, diff, etc.)', input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
  { name: 'task_complete', description: 'Signal task is complete', input_schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, nextSteps: { type: 'array', items: { type: 'string' } } }, required: ['summary'] } },
];
