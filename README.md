# 🚀 MasterCode — Cloud CLI AI Agent

**Build premium full-stack websites and web apps with AI — directly from your terminal.**

MasterCode is a powerful CLI AI agent that uses Claude to generate complete, production-ready web applications with exceptional design and functionality. Just describe what you want, and watch it build.

---

## ✨ Features

- 🎨 **Premium Design** — Modern UIs with Tailwind, animations, glassmorphism, dark mode
- ⚡ **Full-Stack** — React, Next.js, Vue, Nuxt, Svelte, Express, FastAPI, Django
- 🗄️ **Database Setup** — PostgreSQL, MongoDB, SQLite, Prisma, Drizzle
- 🔐 **Authentication** — NextAuth, Clerk, JWT, OAuth
- 📦 **Auto Dependencies** — Installs all required packages automatically
- 🚀 **Deploy Ready** — Vercel, Netlify, Railway integration
- 💬 **Interactive Chat** — Multi-turn conversations with the AI
- 🔧 **AI Bug Fixing** — Automatically diagnose and fix issues
- 🎯 **Feature Addition** — Add features to existing projects

---

## 📦 Installation

```bash
npm install -g mastercode
```

Or use directly with `npx`:

```bash
npx mastercode build "your project description"
```

---

## 🔑 Setup

Get your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

```bash
mc config set-key sk-ant-api03-...
```

Or set as environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 🎯 Usage

### Build a Full-Stack App

```bash
mc build "SaaS dashboard with authentication, dark mode, and Stripe payments"
```

With options:

```bash
mc build "E-commerce store" \
  --stack next \
  --style tailwind \
  --db postgres \
  --auth clerk \
  --preview
```

### Interactive Chat

```bash
mc chat
```

Chat commands:
- `/clear` — Clear conversation history
- `/exit` — Exit chat
- `/dir <path>` — Change working directory
- `/help` — Show help

### Add Features to Existing Project

```bash
mc add "authentication with Google OAuth"
mc add "dark mode toggle with system preference detection"
```

### AI Bug Fixing

```bash
mc fix "API endpoint returns 500 error"
mc fix  # Auto-detect and fix all issues
```

### Preview Locally

```bash
mc preview ./my-project --open
```

### Deploy

```bash
mc deploy ./my-project --platform vercel --prod
```

### Scaffold New Project

```bash
mc new next my-app
mc new react my-app
mc new vue my-app
```

---

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `mc build <description>` | Build a full-stack website/app |
| `mc chat` | Interactive AI chat session |
| `mc add <feature>` | Add feature to existing project |
| `mc fix [description]` | AI-powered bug fixing |
| `mc preview [dir]` | Preview project locally |
| `mc deploy [dir]` | Deploy to Vercel/Netlify/Railway |
| `mc new <template> <name>` | Scaffold new project |
| `mc config set-key <key>` | Set API key |
| `mc config show` | Show configuration |

---

## 🎨 Examples

### SaaS Dashboard
```bash
mc build "SaaS dashboard with user auth, subscription management, analytics charts, and admin panel" \
  --stack next \
  --db postgres \
  --auth nextauth
```

### E-commerce Store
```bash
mc build "Modern e-commerce store with product catalog, cart, checkout, and Stripe integration" \
  --stack next \
  --style tailwind \
  --db mongodb
```

### Portfolio Website
```bash
mc build "Personal portfolio with animations, blog, project showcase, and contact form" \
  --stack astro \
  --style tailwind
```

### REST API
```bash
mc build "REST API for task management with JWT auth, CRUD operations, and PostgreSQL" \
  --stack express \
  --db postgres
```

---

## ⚙️ Configuration

View config:
```bash
mc config show
```

Set values:
```bash
mc config set model claude-opus-4-5
mc config set maxTokens 8192
mc config set autoInstall true
```

Reset to defaults:
```bash
mc config reset
```

---

## 🧠 How It Works

1. **Analyze** — Claude analyzes your request and plans the architecture
2. **Scaffold** — Creates project structure using best practices
3. **Build** — Generates all components, pages, APIs, and logic
4. **Install** — Automatically installs all required dependencies
5. **Verify** — Ensures everything is wired together correctly

The AI has access to powerful tools:
- File system operations (read, write, list, search)
- Shell command execution
- Package installation (npm, pip, etc.)
- Project scaffolding
- Dev server management
- URL fetching (for docs, templates)

---

## 🎯 Tech Stack Support

**Frontend:**
- React, Next.js, Vue, Nuxt, Svelte, Astro, Vite

**Backend:**
- Express, Fastify, NestJS, FastAPI, Django, Flask

**Styling:**
- Tailwind CSS, shadcn/ui, Chakra UI, Material-UI, Styled Components

**Databases:**
- PostgreSQL, MongoDB, SQLite, MySQL, Supabase

**ORMs:**
- Prisma, Drizzle, TypeORM, Mongoose

**Auth:**
- NextAuth, Clerk, Supabase Auth, JWT, OAuth

---

## 🚀 Advanced Usage

### Custom Output Directory
```bash
mc build "blog platform" --output ~/projects/my-blog
```

### Multi-turn Conversation
```bash
mc chat
> Build a todo app with Next.js
> Add dark mode
> Add user authentication
> Deploy it to Vercel
```

### Fix Specific Issues
```bash
mc fix "The login form doesn't validate email properly" --dir ./my-app
```

---

## 📝 Environment Variables

- `ANTHROPIC_API_KEY` — Your Anthropic API key
- `MC_MODEL` — Override default model (e.g., `claude-opus-4-5`)

---

## 🤝 Contributing

Contributions welcome! This is an open-source project.

---

## 📄 License

MIT License — see LICENSE file for details

---

## 🙏 Credits

Powered by [Anthropic Claude](https://anthropic.com) — the world's most capable AI assistant.

---

**Built with ❤️ for developers who want to ship faster.**
