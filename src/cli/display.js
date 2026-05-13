import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import figlet from 'figlet';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));

export function printBanner() {
  const title = figlet.textSync('MasterCode', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });

  console.log('\n' + gradient(['#00d2ff', '#7b2ff7', '#ff6b6b'])(title));
  console.log(
    boxen(
      chalk.white.bold('⚡ Cloud CLI AI Agent') + '\n' +
      chalk.dim('Build premium full-stack websites with AI') + '\n' +
      chalk.dim(`v${pkg.version} • Powered by Claude`),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        textAlignment: 'center',
      }
    )
  );
  console.log();
}

export function printHelp() {
  console.log(chalk.bold.cyan('\n📚 Commands:\n'));
  const commands = [
    ['build <description>', 'Build a full-stack website or web app'],
    ['chat', 'Start interactive AI chat session'],
    ['config set-key <key>', 'Set your Anthropic API key'],
    ['config show', 'Show current configuration'],
    ['config set <key> <value>', 'Set a config value'],
    ['new <template> <name>', 'Scaffold a new project'],
    ['preview [dir]', 'Preview a project locally'],
    ['deploy [dir]', 'Deploy project (Vercel/Netlify)'],
    ['add <feature>', 'Add a feature to existing project'],
    ['fix [description]', 'AI-powered bug fixing'],
  ];

  commands.forEach(([cmd, desc]) => {
    console.log(`  ${chalk.cyan('mc ' + cmd.padEnd(30))} ${chalk.dim(desc)}`);
  });

  console.log(chalk.bold.cyan('\n💡 Examples:\n'));
  const examples = [
    'mc build "SaaS dashboard with auth, dark mode, and Stripe payments"',
    'mc build "E-commerce store with Next.js, Prisma, and Stripe"',
    'mc build "Portfolio site with animations and blog"',
    'mc add "authentication with Google OAuth"',
    'mc chat',
  ];
  examples.forEach(e => console.log(`  ${chalk.dim('$')} ${chalk.white(e)}`));
  console.log();
}

export function printError(msg) {
  console.error(chalk.red(`\n✗ ${msg}\n`));
}

export function printSuccess(msg) {
  console.log(chalk.green(`\n✓ ${msg}\n`));
}

export function printInfo(msg) {
  console.log(chalk.cyan(`\nℹ ${msg}\n`));
}

export function printTable(data, headers) {
  const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => String(r[i] || '').length)) + 2);
  const row = (cells) => cells.map((c, i) => String(c || '').padEnd(colWidths[i])).join(chalk.dim('│'));
  const sep = colWidths.map(w => '─'.repeat(w)).join('┼');

  console.log(chalk.dim('┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐'));
  console.log(chalk.dim('│') + chalk.bold(row(headers)) + chalk.dim('│'));
  console.log(chalk.dim('├' + sep + '┤'));
  data.forEach(r => console.log(chalk.dim('│') + row(r) + chalk.dim('│')));
  console.log(chalk.dim('└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘'));
}
