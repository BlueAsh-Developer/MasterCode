import Anthropic from '@anthropic-ai/sdk';
import { WebToolExecutor, WEB_TOOLS } from './tools.js';

const SYSTEM = `You are MasterCode, an elite full-stack AI developer. You build premium, production-ready websites and web applications.

## Capabilities
- Full-stack: React, Next.js, Vue, Nuxt, Svelte, Astro, Express, FastAPI, Django
- Premium UI: Tailwind CSS, shadcn/ui, Framer Motion, GSAP, glassmorphism, dark mode
- Databases: PostgreSQL, MongoDB, SQLite, Prisma, Drizzle
- Auth: NextAuth, Clerk, JWT, OAuth
- Git operations, file management, package installation

## Standards
- TypeScript by default, proper error handling, loading states
- Mobile-first responsive, accessible (WCAG 2.1 AA)
- Complete implementations — no stubs or placeholders
- Include .env.example for environment variables

Always build COMPLETE, WORKING applications.`;

export async function runWebAgent({ prompt, projectDir, apiKey, history = [], onEvent }) {
  const client = new Anthropic({ apiKey });
  const executor = new WebToolExecutor(projectDir, onEvent);

  const messages = [
    ...history,
    { role: 'user', content: prompt },
  ];

  onEvent({ type: 'start' });

  let iterations = 0;
  while (iterations++ < 50) {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      system: SYSTEM,
      tools: WEB_TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];

    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        onEvent({ type: 'text', content: block.text });
      }
      if (block.type === 'tool_use') {
        const result = await executor.execute(block.name, block.input);
        if (block.name === 'task_complete') {
          onEvent({ type: 'complete', result });
          return { done: true, result, messages };
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }

    if (response.stop_reason === 'end_turn' && toolResults.length === 0) {
      onEvent({ type: 'complete', result: { summary: 'Done' } });
      return { done: true, messages };
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }
  }

  onEvent({ type: 'complete', result: { summary: 'Max iterations reached' } });
  return { done: false, messages };
}
