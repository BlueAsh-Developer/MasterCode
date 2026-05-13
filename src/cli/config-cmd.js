import chalk from 'chalk';
import { config } from '../config/manager.js';
import { printTable } from './display.js';
import boxen from 'boxen';

export function configCommand(program) {
  const cfg = program.command('config').description('Manage MasterCode configuration');

  cfg
    .command('set-key <apiKey>')
    .description('Set your Anthropic API key')
    .action((apiKey) => {
      if (!apiKey.startsWith('sk-ant-')) {
        console.error(chalk.red('\n✗ Invalid API key format. Should start with sk-ant-\n'));
        process.exit(1);
      }
      config.setApiKey(apiKey);
      console.log(chalk.green('\n✓ API key saved successfully!\n'));
      console.log(chalk.dim(`  Stored at: ${config.path}\n`));
    });

  cfg
    .command('show')
    .description('Show current configuration')
    .action(() => {
      const all = config.getAll();
      const apiKey = config.getApiKey();

      console.log(
        boxen(chalk.bold.cyan('⚙️  MasterCode Configuration'), {
          padding: 1, borderStyle: 'round', borderColor: 'cyan',
        })
      );

      const rows = [
        ['API Key', apiKey ? chalk.green('✓ Set (' + apiKey.slice(0, 12) + '...)') : chalk.red('✗ Not set')],
        ['Model', all.model],
        ['Default Stack', all.defaultStack],
        ['Auto Install', all.autoInstall ? chalk.green('yes') : chalk.red('no')],
        ['Max Tokens', String(all.maxTokens)],
        ['Config Path', config.path],
      ];

      printTable(rows, ['Setting', 'Value']);
      console.log();
    });

  cfg
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
      const parsed = value === 'true' ? true : value === 'false' ? false : isNaN(value) ? value : Number(value);
      config.set(key, parsed);
      console.log(chalk.green(`\n✓ ${key} = ${parsed}\n`));
    });

  cfg
    .command('reset')
    .description('Reset all configuration to defaults')
    .action(() => {
      config.clear();
      console.log(chalk.green('\n✓ Configuration reset to defaults\n'));
    });

  cfg
    .command('profiles')
    .description('List saved profiles')
    .action(() => {
      const profiles = config.listProfiles();
      if (!profiles.length) {
        console.log(chalk.dim('\nNo profiles saved yet.\n'));
        return;
      }
      console.log(chalk.cyan('\n📋 Saved Profiles:\n'));
      profiles.forEach(p => console.log(chalk.dim(`  • ${p}`)));
      console.log();
    });
}
