// Tool definitions for Claude's tool_use API
export const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file, creating directories as needed',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        recursive: { type: 'boolean', description: 'List recursively', default: false },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the project directory',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
        cwd: { type: 'string', description: 'Working directory' },
      },
      required: ['command'],
    },
  },
  {
    name: 'install_packages',
    description: 'Install npm/pip/other packages',
    input_schema: {
      type: 'object',
      properties: {
        packages: { type: 'array', items: { type: 'string' }, description: 'Package names' },
        manager: { type: 'string', enum: ['npm', 'yarn', 'pnpm', 'pip', 'pip3'], default: 'npm' },
        dev: { type: 'boolean', description: 'Install as dev dependency', default: false },
        cwd: { type: 'string', description: 'Working directory' },
      },
      required: ['packages'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a directory and all parent directories',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
        recursive: { type: 'boolean', default: false },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text patterns in files',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex)' },
        path: { type: 'string', description: 'Directory to search in' },
        filePattern: { type: 'string', description: 'File glob pattern e.g. *.js' },
      },
      required: ['pattern', 'path'],
    },
  },
  {
    name: 'scaffold_project',
    description: 'Scaffold a new project using a template (react, next, vue, express, fastapi, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: 'Template name' },
        name: { type: 'string', description: 'Project name' },
        path: { type: 'string', description: 'Output directory' },
        options: { type: 'object', description: 'Template-specific options' },
      },
      required: ['template', 'name', 'path'],
    },
  },
  {
    name: 'start_dev_server',
    description: 'Start a local development/preview server',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project directory' },
        port: { type: 'number', description: 'Port number', default: 3000 },
        command: { type: 'string', description: 'Custom start command' },
      },
      required: ['path'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL (for downloading templates, docs, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal that the task is complete with a summary',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was built' },
        files: { type: 'array', items: { type: 'string' }, description: 'Key files created' },
        nextSteps: { type: 'array', items: { type: 'string' }, description: 'Suggested next steps' },
      },
      required: ['summary'],
    },
  },
];
