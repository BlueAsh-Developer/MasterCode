import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import ora from 'ora';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { TOOLS } from './tools.js';
import { ToolExecutor } from './executor.js';
import { config } from '../config/manager.js';

marked.use(markedTerminal());

const SYSTEM_PROMPT = `You are MasterCode, an elite full-stack AI developer agent. You build premium, production-ready websites and web applications with exceptional design and functionality.

## Your Capabilities
- Build complete full-stack apps: React, Next.js, Vue, Nuxt, Svelte, Astro, Express, FastAPI, Django
- Create stunning UIs with Tailwind CSS, shadcn/ui, Framer Motion, GSAP animations
- Set up databases: PostgreSQL, MongoDB, SQLite, Prisma ORM, Drizzle ORM
- Implement auth: NextAuth, Clerk, JWT, OAuth
- Deploy-ready: Docker, Vercel config, environment setup
- Install any npm/pip/custom packages the project needs

## Design Philosophy
- Premium, modern aesthetics with glassmorphism, gradients, micro-animations
- Mobile-first, fully responsive layouts
- Accessible (WCAG 2.1 AA), semantic HTML
- Performance-optimized (lazy loading, code splitting, image optimization)
- Dark/light mode support

## Workflow
1. Analyze the request thoroughly
2. Plan the architecture and file structure
3. Scaffold or create the project
4. Build all components, pages, API routes, and logic
5. Install all required dependencies
6. Ensure everything is wired together and works
7. Call task_complete with a summary

## Code Quality
- TypeScript by default for JS projects
- Proper error handling and loading states
- Clean, commented, maintainable code
- Follow best practices for each framework
- Include .env.example for environment variables

Always build COMPLETE, WORKING applications — not stubs or placeholders. Every feature requested must be fully implemented.`;

export class Agent {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.spinner = ora({ color: 'cyan' });
    this.executor = new ToolExecutor(projectDir, this.spinner);
    this.client = null;
    this.conversationHistory = [];
  }

  initClient() {
    if (!this.client) {
      const apiKey = config.requireApiKey();
      this.client = new Anthropic({ apiKey });
    }
  }

  async run(userMessage, { onThinking, onToolUse, onText } = {}) {
    this.initClient();
    this.conversationHistory.push({ role: 'user', content: userMessage });

    this.spinner.start(chalk.cyan('🤔 Thinking...'));

    let iterations = 0;
    const maxIterations = 50;

    while (iterations < maxIterations) {
      iterations++;

      let response;
      try {
        response = await this.client.messages.create({
          model: config.getModel(),
          max_tokens: config.get('maxTokens'),
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages: this.conversationHistory,
        });
      } catch (e) {
        this.spinner.fail(chalk.red('API Error: ' + e.message));
        throw e;
      }

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: response.content });

      // Process content blocks
      const toolResults = [];
      let hasText = false;

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          hasText = true;
          this.spinner.stop();
          if (onText) onText(block.text);
          else console.log('\n' + marked(block.text));
        }

        if (block.type === 'tool_use') {
          this.spinner.stop();
          this.printToolCall(block.name, block.input);
          this.spinner.start(chalk.cyan(`⚙️  ${this.toolLabel(block.name, block.input)}`));

          const result = await this.executor.execute(block.name, block.input);

          this.spinner.stop();
          this.printToolResult(block.name, result);

          // Check if task is done
          if (block.name === 'task_complete') {
            this.spinner.stop();
            this.printCompletion(result);
            return { done: true, result };
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      // If no tool calls, we're done
      if (response.stop_reason === 'end_turn' && toolResults.length === 0) {
        this.spinner.stop();
        return { done: true };
      }

      // Continue with tool results
      if (toolResults.length > 0) {
        this.conversationHistory.push({ role: 'user', content: toolResults });
        this.spinner.start(chalk.cyan('🤔 Processing results...'));
      }
    }

    this.spinner.warn(chalk.yellow('Max iterations reached'));
    return { done: false };
  }

  toolLabel(name, input) {
    const labels = {
      read_file: `Reading ${input.path}`,
      write_file: `Writing ${input.path}`,
      list_files: `Listing ${input.path}`,
      run_command: `Running: ${input.command?.slice(0, 60)}`,
      install_packages: `Installing: ${input.packages?.join(', ')}`,
      create_directory: `Creating dir: ${input.path}`,
      delete_file: `Deleting: ${input.path}`,
      search_files: `Searching for: ${input.pattern}`,
      scaffold_project: `Scaffolding ${input.template}: ${input.name}`,
      start_dev_server: `Starting server at ${input.path}`,
      fetch_url: `Fetching: ${input.url}`,
      task_complete: 'Completing task...',
    };
    return labels[name] || name;
  }

  printToolCall(name, input) {
    const icons = {
      read_file: '📖', write_file: '✍️', list_files: '📂',
      run_command: '⚡', install_packages: '📦', create_directory: '📁',
      delete_file: '🗑️', search_files: '🔍', scaffold_project: '🏗️',
      start_dev_server: '🚀', fetch_url: '🌐', task_complete: '✅',
    };
    const icon = icons[name] || '🔧';
    console.log(chalk.dim(`\n${icon} ${chalk.bold(name)}`));
    if (name === 'write_file') console.log(chalk.dim(`   → ${input.path}`));
    else if (name === 'run_command') console.log(chalk.dim(`   → ${input.command?.slice(0, 80)}`));
    else if (name === 'install_packages') console.log(chalk.dim(`   → ${input.packages?.join(', ')}`));
  }

  printToolResult(name, result) {
    if (result.error) {
      console.log(chalk.red(`   ✗ Error: ${result.error}`));
    } else if (name === 'write_file') {
      console.log(chalk.green(`   ✓ Written (${result.bytes} bytes)`));
    } else if (name === 'install_packages') {
      console.log(chalk.green(`   ✓ Installed: ${result.installed?.join(', ')}`));
    } else if (name === 'run_command') {
      if (result.stdout?.trim()) console.log(chalk.dim(`   ${result.stdout.trim().slice(0, 200)}`));
    }
  }

  printCompletion(result) {
    const boxen = chalk.green;
    console.log('\n' + chalk.bold.green('━'.repeat(60)));
    console.log(chalk.bold.green('✅ BUILD COMPLETE'));
    console.log(chalk.bold.green('━'.repeat(60)));
    if (result.summary) console.log(chalk.white('\n' + result.summary));
    if (result.files?.length) {
      console.log(chalk.cyan('\n📁 Key Files:'));
      result.files.forEach(f => console.log(chalk.dim(`   • ${f}`)));
    }
    if (result.nextSteps?.length) {
      console.log(chalk.yellow('\n🚀 Next Steps:'));
      result.nextSteps.forEach((s, i) => console.log(chalk.dim(`   ${i + 1}. ${s}`)));
    }
    console.log(chalk.bold.green('\n' + '━'.repeat(60) + '\n'));
  }

  // For multi-turn conversation
  async chat(message) {
    return this.run(message);
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}
