import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { glob } from 'glob';
import chalk from 'chalk';
import fetch from 'node-fetch';

export class ToolExecutor {
  constructor(projectDir, spinner) {
    this.projectDir = projectDir;
    this.spinner = spinner;
    this.devServer = null;
  }

  async execute(toolName, input) {
    switch (toolName) {
      case 'read_file': return this.readFile(input);
      case 'write_file': return this.writeFile(input);
      case 'list_files': return this.listFiles(input);
      case 'run_command': return this.runCommand(input);
      case 'install_packages': return this.installPackages(input);
      case 'create_directory': return this.createDirectory(input);
      case 'delete_file': return this.deleteFile(input);
      case 'search_files': return this.searchFiles(input);
      case 'scaffold_project': return this.scaffoldProject(input);
      case 'start_dev_server': return this.startDevServer(input);
      case 'fetch_url': return this.fetchUrl(input);
      case 'task_complete': return { done: true, ...input };
      default: return { error: `Unknown tool: ${toolName}` };
    }
  }

  resolvePath(p) {
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.projectDir, p);
  }

  async readFile({ path: filePath }) {
    try {
      const resolved = this.resolvePath(filePath);
      const content = await fs.readFile(resolved, 'utf-8');
      return { content, path: resolved };
    } catch (e) {
      return { error: e.message };
    }
  }

  async writeFile({ path: filePath, content }) {
    try {
      const resolved = this.resolvePath(filePath);
      await fs.ensureDir(path.dirname(resolved));
      await fs.writeFile(resolved, content, 'utf-8');
      return { success: true, path: resolved, bytes: content.length };
    } catch (e) {
      return { error: e.message };
    }
  }

  async listFiles({ path: dirPath, recursive = false }) {
    try {
      const resolved = this.resolvePath(dirPath);
      if (recursive) {
        const files = await glob('**/*', { cwd: resolved, dot: false, ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'] });
        return { files };
      }
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return {
        files: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })),
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  async runCommand({ command, cwd }) {
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.projectDir;
      if (this.spinner) this.spinner.text = chalk.cyan(`Running: ${command}`);
      const result = await execa('bash', ['-c', command], {
        cwd: workDir,
        timeout: 120000,
        all: true,
      });
      return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    } catch (e) {
      return { error: e.message, stdout: e.stdout, stderr: e.stderr, exitCode: e.exitCode };
    }
  }

  async installPackages({ packages, manager = 'npm', dev = false, cwd }) {
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.projectDir;
      const pkgList = packages.join(' ');
      let cmd;
      if (manager === 'npm') cmd = `npm install ${dev ? '--save-dev' : ''} ${pkgList}`;
      else if (manager === 'yarn') cmd = `yarn add ${dev ? '--dev' : ''} ${pkgList}`;
      else if (manager === 'pnpm') cmd = `pnpm add ${dev ? '-D' : ''} ${pkgList}`;
      else if (manager === 'pip' || manager === 'pip3') cmd = `${manager} install ${pkgList}`;

      if (this.spinner) this.spinner.text = chalk.cyan(`Installing: ${pkgList}`);
      const result = await execa('bash', ['-c', cmd], { cwd: workDir, timeout: 180000, all: true });
      return { success: true, installed: packages, stdout: result.stdout };
    } catch (e) {
      return { error: e.message, stderr: e.stderr };
    }
  }

  async createDirectory({ path: dirPath }) {
    try {
      const resolved = this.resolvePath(dirPath);
      await fs.ensureDir(resolved);
      return { success: true, path: resolved };
    } catch (e) {
      return { error: e.message };
    }
  }

  async deleteFile({ path: filePath, recursive = false }) {
    try {
      const resolved = this.resolvePath(filePath);
      if (recursive) await fs.remove(resolved);
      else await fs.unlink(resolved);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  async searchFiles({ pattern, path: searchPath, filePattern = '**/*' }) {
    try {
      const resolved = this.resolvePath(searchPath);
      const files = await glob(filePattern, { cwd: resolved, ignore: ['node_modules/**', '.git/**'] });
      const regex = new RegExp(pattern, 'gi');
      const results = [];
      for (const file of files.slice(0, 50)) {
        try {
          const content = await fs.readFile(path.join(resolved, file), 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (regex.test(line)) results.push({ file, line: i + 1, content: line.trim() });
          });
        } catch {}
      }
      return { results: results.slice(0, 100) };
    } catch (e) {
      return { error: e.message };
    }
  }

  async scaffoldProject({ template, name, path: outPath, options = {} }) {
    try {
      const resolved = this.resolvePath(outPath);
      await fs.ensureDir(resolved);
      if (this.spinner) this.spinner.text = chalk.cyan(`Scaffolding ${template} project: ${name}`);

      const scaffoldMap = {
        react: `npx create-react-app ${name} --template typescript`,
        next: `npx create-next-app@latest ${name} --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes`,
        vue: `npx create-vue@latest ${name} --typescript --router --pinia --eslint`,
        vite: `npx create-vite@latest ${name} --template react-ts`,
        express: null, // handled manually
        fastapi: null,
        nuxt: `npx nuxi@latest init ${name}`,
        svelte: `npx sv create ${name}`,
        astro: `npx create-astro@latest ${name} --template minimal --yes`,
      };

      const cmd = scaffoldMap[template.toLowerCase()];
      if (cmd) {
        const result = await execa('bash', ['-c', cmd], { cwd: resolved, timeout: 300000, all: true });
        return { success: true, path: path.join(resolved, name), stdout: result.stdout };
      }
      return { success: true, path: resolved, message: 'Manual scaffold - AI will create files' };
    } catch (e) {
      return { error: e.message, stderr: e.stderr };
    }
  }

  async startDevServer({ path: serverPath, port = 3000, command }) {
    try {
      const resolved = this.resolvePath(serverPath);
      const pkg = await fs.readJson(path.join(resolved, 'package.json')).catch(() => null);
      const startCmd = command || (pkg?.scripts?.dev ? 'npm run dev' : pkg?.scripts?.start ? 'npm start' : 'npx serve .');

      if (this.spinner) this.spinner.stop();
      console.log(chalk.green(`\n🚀 Starting dev server on port ${port}...`));
      console.log(chalk.cyan(`   Command: ${startCmd}`));
      console.log(chalk.yellow(`   Press Ctrl+C to stop\n`));

      const proc = execa('bash', ['-c', startCmd], { cwd: resolved, stdio: 'inherit' });
      this.devServer = proc;
      return { success: true, pid: proc.pid, port, command: startCmd };
    } catch (e) {
      return { error: e.message };
    }
  }

  async fetchUrl({ url }) {
    try {
      const res = await fetch(url, { timeout: 10000 });
      const text = await res.text();
      return { content: text.slice(0, 5000), status: res.status };
    } catch (e) {
      return { error: e.message };
    }
  }
}
