#!/usr/bin/env node
import { app } from './server.js';
import chalk from 'chalk';
import open from 'open';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log('\n' + chalk.bold.cyan('━'.repeat(50)));
  console.log(chalk.bold.cyan('  🚀 MasterCode Web Interface'));
  console.log(chalk.bold.cyan('━'.repeat(50)));
  console.log(chalk.green(`  ✓ Server running at `) + chalk.white.bold(`http://localhost:${PORT}`));
  console.log(chalk.dim(`  ✓ Projects stored at ~/.mastercode/projects`));
  console.log(chalk.dim(`  Press Ctrl+C to stop`));
  console.log(chalk.bold.cyan('━'.repeat(50)) + '\n');

  if (process.argv.includes('--open')) open(`http://localhost:${PORT}`);
});
