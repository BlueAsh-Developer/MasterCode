import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { Agent } from '../agent/agent.js';
import { config } from '../config/manager.js';
import { printInfo } from './display.js';
import boxen from 'boxen';

export async function buildCommand(description, options) {
  config.requireApiKey();

  const outputDir = options.output
    ? path.resolve(options.output)
    : path.resolve(process.cwd(), options.name || sanitizeName(description));

  await fs.ensureDir(outputDir);

  console.log(
    boxen(
      chalk.bold.cyan('🏗️  Building Your Project') + '\n\n' +
      chalk.white(description) + '\n\n' +
      chalk.dim(`Output: ${outputDir}`),
      { padding: 1, borderStyle: 'double', borderColor: 'cyan' }
    )
  );

  const agent = new Agent(outputDir);

  // Build the prompt with all options
  const prompt = buildPrompt(description, options, outputDir);

  try {
    const result = await agent.run(prompt);

    if (result.done) {
      if (options.preview) {
        const { previewCommand } = await import('./preview.js');
        await previewCommand(outputDir, { open: true });
      }
    }
  } catch (e) {
    if (e.status === 401) {
      console.error(chalk.red('\n✗ Invalid API key. Run: mc config set-key <your-key>\n'));
    } else {
      console.error(chalk.red(`\n✗ Build failed: ${e.message}\n`));
    }
    process.exit(1);
  }
}

function buildPrompt(description, options, outputDir) {
  const parts = [
    `Build the following project in directory: ${outputDir}`,
    `\n## Project Description\n${description}`,
  ];

  if (options.stack) parts.push(`\n## Tech Stack\nUse: ${options.stack}`);
  if (options.style) parts.push(`\n## Styling\nUse: ${options.style}`);
  if (options.db) parts.push(`\n## Database\nUse: ${options.db}`);
  if (options.auth) parts.push(`\n## Authentication\nInclude: ${options.auth}`);
  if (options.features) parts.push(`\n## Additional Features\n${options.features}`);

  parts.push(`
## Requirements
- Build a COMPLETE, production-ready application
- Premium, modern design with animations and polished UI
- Fully responsive (mobile-first)
- All features fully implemented (no placeholders)
- Install all required dependencies
- Include README.md with setup instructions
- Create .env.example if environment variables are needed
- The project must run successfully after setup`);

  return parts.join('\n');
}

function sanitizeName(description) {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('-') || 'my-project';
}

export async function addFeatureCommand(feature, options) {
  config.requireApiKey();

  const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();

  console.log(chalk.cyan(`\n⚡ Adding feature to: ${projectDir}`));
  console.log(chalk.white(`   Feature: ${feature}\n`));

  const agent = new Agent(projectDir);

  // First, let the agent understand the existing project
  const prompt = `Add the following feature to the existing project in ${projectDir}:

## Feature to Add
${feature}

## Instructions
1. First, explore the project structure to understand what's already built
2. Implement the feature following the existing code style and patterns
3. Install any required new dependencies
4. Ensure the feature integrates seamlessly with the existing codebase
5. Update any relevant files (routes, components, types, etc.)`;

  try {
    await agent.run(prompt);
  } catch (e) {
    console.error(chalk.red(`\n✗ Failed: ${e.message}\n`));
    process.exit(1);
  }
}

export async function fixCommand(description, options) {
  config.requireApiKey();

  const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();
  const agent = new Agent(projectDir);

  const prompt = description
    ? `Fix the following issue in the project at ${projectDir}:\n\n${description}\n\nExplore the code, identify the root cause, and fix it completely.`
    : `Analyze the project at ${projectDir}, identify any bugs, errors, or issues, and fix them all. Run the project to verify it works.`;

  console.log(chalk.cyan(`\n🔧 AI Bug Fixer\n`));

  try {
    await agent.run(prompt);
  } catch (e) {
    console.error(chalk.red(`\n✗ Failed: ${e.message}\n`));
    process.exit(1);
  }
}
