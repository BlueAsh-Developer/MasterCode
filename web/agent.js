import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebToolExecutor, WEB_TOOLS } from './tools.js';

const SYSTEM = `You are MasterCode, an elite full-stack AI developer agent with Replit-like capabilities. You build premium, production-ready websites and web applications autonomously.

## Core Capabilities
- Full-stack: React, Next.js, Vue, Nuxt, Svelte, Astro, Express, FastAPI, Django, Flask
- Premium UI: Tailwind CSS, shadcn/ui, Framer Motion, GSAP, glassmorphism, dark mode, animations
- Databases: PostgreSQL, MongoDB, SQLite, MySQL, Prisma, Drizzle, Mongoose
- Auth: NextAuth, Clerk, JWT, OAuth, Supabase Auth
- Payments: Stripe, Paddle
- Deployment: Vercel, Netlify, Railway, Docker
- Git: init, commit, branch, merge, push
- Package managers: npm, yarn, pnpm, pip

## Agent Behavior
- Work autonomously — plan, scaffold, build, test, fix, iterate
- Read existing files before modifying them
- Install all required dependencies automatically
- Create .env.example for all environment variables
- Write complete, working code — no stubs or TODOs
- Fix errors automatically when commands fail
- Use TypeScript by default
- Mobile-first responsive design, WCAG 2.1 AA accessible
- Add proper error handling, loading states, and empty states

## Output Quality
- Production-ready code with proper structure
- Comprehensive README.md
- Proper .gitignore
- Environment variable documentation
- Clean, commented code

Always build COMPLETE, WORKING applications. Never leave placeholders.`;

// ─── Claude Provider ──────────────────────────────────────────────────────────
async function runClaudeAgent({ prompt, projectDir, apiKey, model, history, onEvent }) {
  const client = new Anthropic({ apiKey });
  const executor = new WebToolExecutor(projectDir, onEvent);

  const messages = [...history, { role: 'user', content: prompt }];
  onEvent({ type: 'start', provider: 'claude', model });

  let iterations = 0;
  while (iterations++ < 60) {
    const response = await client.messages.create({
      model: model || 'claude-opus-4-5',
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

// ─── Gemini Provider ──────────────────────────────────────────────────────────
function buildGeminiTools() {
  return WEB_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(t.input_schema.properties || {}).map(([k, v]) => [k, {
          type: v.type === 'array' ? 'ARRAY' : v.type === 'boolean' ? 'BOOLEAN' : 'STRING',
          description: v.description || k,
          ...(v.type === 'array' ? { items: { type: 'STRING' } } : {}),
          ...(v.enum ? { enum: v.enum } : {}),
        }])
      ),
      required: t.input_schema.required || [],
    },
  }));
}

async function runGeminiAgent({ prompt, projectDir, apiKey, model, history, onEvent }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const executor = new WebToolExecutor(projectDir, onEvent);

  const geminiModel = genAI.getGenerativeModel({
    model: model || 'gemini-2.0-flash',
    systemInstruction: SYSTEM,
    tools: [{ functionDeclarations: buildGeminiTools() }],
  });

  // Convert history to Gemini format
  const geminiHistory = [];
  for (const msg of history) {
    if (msg.role === 'user') {
      const parts = Array.isArray(msg.content)
        ? msg.content.map(c => c.type === 'tool_result' ? { text: `Tool result: ${c.content}` } : { text: c.text || '' })
        : [{ text: msg.content }];
      geminiHistory.push({ role: 'user', parts });
    } else if (msg.role === 'assistant') {
      const parts = Array.isArray(msg.content)
        ? msg.content.filter(c => c.type === 'text').map(c => ({ text: c.text }))
        : [{ text: msg.content }];
      if (parts.length > 0) geminiHistory.push({ role: 'model', parts });
    }
  }

  const chat = geminiModel.startChat({ history: geminiHistory });
  onEvent({ type: 'start', provider: 'gemini', model });

  const messages = [...history, { role: 'user', content: prompt }];
  let currentPrompt = prompt;

  let iterations = 0;
  while (iterations++ < 60) {
    const result = await chat.sendMessage(currentPrompt);
    const response = result.response;
    const candidates = response.candidates || [];
    if (!candidates.length) break;

    const parts = candidates[0].content?.parts || [];
    const toolCalls = [];
    let hasText = false;

    for (const part of parts) {
      if (part.text) {
        hasText = true;
        onEvent({ type: 'text', content: part.text });
      }
      if (part.functionCall) {
        toolCalls.push(part.functionCall);
      }
    }

    if (toolCalls.length === 0) {
      onEvent({ type: 'complete', result: { summary: 'Done' } });
      return { done: true, messages };
    }

    // Execute tools and collect results
    const toolResults = [];
    for (const call of toolCalls) {
      const toolResult = await executor.execute(call.name, call.args || {});
      if (call.name === 'task_complete') {
        onEvent({ type: 'complete', result: toolResult });
        return { done: true, messages };
      }
      toolResults.push({
        functionResponse: {
          name: call.name,
          response: { result: JSON.stringify(toolResult) },
        },
      });
    }

    // Feed results back
    currentPrompt = toolResults;
  }

  onEvent({ type: 'complete', result: { summary: 'Max iterations reached' } });
  return { done: false, messages };
}

// ─── Main Entry ───────────────────────────────────────────────────────────────
export async function runWebAgent({ prompt, projectDir, apiKey, geminiApiKey, model, provider, history = [], onEvent }) {
  // Auto-detect provider from model name or explicit provider
  const resolvedProvider = provider || (model?.startsWith('gemini') ? 'gemini' : 'claude');

  if (resolvedProvider === 'gemini') {
    const key = geminiApiKey || apiKey;
    if (!key) throw new Error('Gemini API key required');
    return runGeminiAgent({ prompt, projectDir, apiKey: key, model, history, onEvent });
  }

  return runClaudeAgent({ prompt, projectDir, apiKey, model, history, onEvent });
}

// Model catalog
export const MODELS = {
  claude: [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', desc: 'Most powerful, best for complex apps', badge: 'Best' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', desc: 'Fast & capable, great balance', badge: 'Fast' },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', desc: 'Fastest, best for quick tasks', badge: 'Quick' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Most capable Gemini model', badge: 'Best' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Fast and efficient', badge: 'Fast' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Long context, reliable', badge: 'Stable' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Quick responses', badge: 'Quick' },
  ],
};
