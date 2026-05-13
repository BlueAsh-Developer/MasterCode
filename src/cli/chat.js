import chalk from 'chalk';
import { createInterface } from 'readline';
import { Agent } from '../agent/agent.js';
import { config } from '../config/manager.js';
import boxen from 'boxen';

export async function chatCommand(options) {
  config.requireApiKey();

  const projectDir = options.dir || process.cwd();
  const agent = new Agent(projectDir);

  console.log(
    boxen(
      chalk.cyan.bold('💬 MasterCode Chat') + '\n' +
      chalk.dim('Type your message and press Enter\n') +
      chalk.dim('Commands: /clear /exit /dir <path> /help'),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
    )
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = () => {
    rl.question(chalk.cyan('\n> '), async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();

      // Handle slash commands
      if (trimmed === '/exit' || trimmed === '/quit') {
        console.log(chalk.dim('\nGoodbye! 👋\n'));
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/clear') {
        agent.clearHistory();
        console.clear();
        console.log(chalk.green('✓ Conversation cleared'));
        return prompt();
      }

      if (trimmed === '/help') {
        console.log(chalk.cyan('\nCommands:'));
        console.log(chalk.dim('  /clear     - Clear conversation history'));
        console.log(chalk.dim('  /exit      - Exit chat'));
        console.log(chalk.dim('  /dir <p>   - Change working directory'));
        console.log(chalk.dim('  /model <m> - Switch AI model'));
        return prompt();
      }

      if (trimmed.startsWith('/dir ')) {
        const newDir = trimmed.slice(5).trim();
        agent.projectDir = newDir;
        agent.executor.projectDir = newDir;
        console.log(chalk.green(`✓ Working directory: ${newDir}`));
        return prompt();
      }

      if (trimmed.startsWith('/model ')) {
        const model = trimmed.slice(7).trim();
        config.set('model', model);
        console.log(chalk.green(`✓ Model set to: ${model}`));
        return prompt();
      }

      try {
        await agent.chat(trimmed);
      } catch (e) {
        console.error(chalk.red(`\n✗ ${e.message}\n`));
      }

      prompt();
    });
  };

  prompt();
}
