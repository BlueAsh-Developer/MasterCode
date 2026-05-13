import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import ora from 'ora';

export async function deployCommand(dir, options) {
  const projectDir = path.resolve(dir || process.cwd());
  const platform = options.platform || 'vercel';
  const spinner = ora({ color: 'cyan' });

  console.log(chalk.cyan(`\n🚀 Deploying to ${platform}...\n`));

  // Check if platform CLI is installed
  const cliMap = { vercel: 'vercel', netlify: 'netlify', railway: 'railway' };
  const cli = cliMap[platform];

  try {
    await execa('which', [cli]);
  } catch {
    spinner.start(`Installing ${cli} CLI...`);
    try {
      await execa('npm', ['install', '-g', cli], { stdio: 'pipe' });
      spinner.succeed(`${cli} CLI installed`);
    } catch (e) {
      spinner.fail(`Failed to install ${cli}: ${e.message}`);
      console.log(chalk.yellow(`\nManual install: npm install -g ${cli}\n`));
      return;
    }
  }

  // Build first if needed
  const pkgPath = path.join(projectDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (pkg.scripts?.build) {
      spinner.start('Building project...');
      try {
        await execa('npm', ['run', 'build'], { cwd: projectDir });
        spinner.succeed('Build complete');
      } catch (e) {
        spinner.warn('Build failed, deploying anyway...');
      }
    }
  }

  // Deploy
  spinner.start(`Deploying to ${platform}...`);
  try {
    const deployArgs = platform === 'vercel'
      ? ['--yes', ...(options.prod ? ['--prod'] : [])]
      : [];

    const result = await execa(cli, deployArgs, {
      cwd: projectDir,
      stdio: 'inherit',
    });

    spinner.succeed(chalk.green(`Deployed to ${platform}!`));
  } catch (e) {
    spinner.fail(`Deployment failed: ${e.message}`);
    console.log(chalk.yellow(`\nTry manually: cd ${projectDir} && ${cli} deploy\n`));
  }
}
