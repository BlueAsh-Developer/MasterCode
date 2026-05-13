#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

import { printBanner, printHelp } from './cli/display.js';
import { buildCommand, addFeatureCommand, fixCommand } from './cli/build.js';
import { chatCommand } from './cli/chat.js';
import { previewCommand } from './cli/preview.js';
import { deployCommand } from './cli/deploy.js';
import { configCommand } from './cli/config-cmd.js';
import { config } from './config/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

program
  .name('mastercode')
  .description('⚡ Cloud CLI AI Agent — Build premium full-stack websites with AI')
  .version(pkg.version, '-v, --version')
  .addHelpText('beforeAll', () => { printBanner(); return ''; });

// ─── build ────────────────────────────────────────────────────────────────────
program
  .command('build <description>')
  .description('Build a full-stack website or web app with AI')
  .option('-o, --output <dir>', 'Output directory')
  .option('-n, --name <name>', 'Project name')
  .option('-s, --stack <stack>', 'Tech stack (next, react, vue, express, fastapi...)')
  .option('--style <style>', 'Styling (tailwind, chakra, mui, styled-components)')
  .option('--db <database>', 'Database (postgres, mongodb, sqlite, mysql)')
  .option('--auth <auth>', 'Auth provider (nextauth, clerk, jwt, supabase)')
  .option('--features <features>', 'Additional features to include')
  .option('-p, --preview', 'Auto-preview after build')
  .action(buildCommand);

// ─── chat ─────────────────────────────────────────────────────────────────────
program
  .command('chat')
  .description('Start an interactive AI chat session')
  .option('-d, --dir <dir>', 'Working directory')
  .action(chatCommand);

// ─── add ──────────────────────────────────────────────────────────────────────
program
  .command('add <feature>')
  .description('Add a feature to an existing project')
  .option('-d, --dir <dir>', 'Project directory')
  .action(addFeatureCommand);

// ─── fix ──────────────────────────────────────────────────────────────────────
program
  .command('fix [description]')
  .description('AI-powered bug fixing')
  .option('-d, --dir <dir>', 'Project directory')
  .action(fixCommand);

// ─── preview ──────────────────────────────────────────────────────────────────
program
  .command('preview [dir]')
  .description('Preview a project locally')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-o, --open', 'Open in browser')
  .action(previewCommand);

// ─── deploy ───────────────────────────────────────────────────────────────────
program
  .command('deploy [dir]')
  .description('Deploy project to Vercel, Netlify, or Railway')
  .option('--platform <platform>', 'Platform (vercel, netlify, railway)', 'vercel')
  .option('--prod', 'Deploy to production')
  .action(deployCommand);

// ─── new ──────────────────────────────────────────────────────────────────────
program
  .command('new <template> <name>')
  .description('Scaffold a new project from template')
  .option('-d, --dir <dir>', 'Output directory')
  .action(async (template, name, options) => {
    config.requireApiKey();
    const { Agent } = await import('./agent/agent.js');
    const outDir = options.dir ? path.resolve(options.dir) : process.cwd();
    const agent = new Agent(outDir);
    await agent.run(
      `Scaffold a new ${template} project named "${name}" in ${outDir}. ` +
      `Set it up with best practices, TypeScript, proper folder structure, and a beautiful starter UI.`
    );
  });

// ─── config ───────────────────────────────────────────────────────────────────
configCommand(program);

// ─── Default: show banner + help ──────────────────────────────────────────────
program
  .command('help', { isDefault: false })
  .description('Show help')
  .action(() => { printBanner(); printHelp(); });

// Show banner on bare invocation
if (process.argv.length === 2) {
  printBanner();
  printHelp();
  process.exit(0);
}

program.parse(process.argv);
