import Conf from 'conf';
import chalk from 'chalk';
import path from 'path';
import os from 'os';

const store = new Conf({
  projectName: 'mastercode',
  schema: {
    apiKey: { type: 'string', default: '' },
    model: { type: 'string', default: 'claude-opus-4-5' },
    theme: { type: 'string', default: 'dark' },
    defaultStack: { type: 'string', default: 'react' },
    outputDir: { type: 'string', default: process.cwd() },
    autoInstall: { type: 'boolean', default: true },
    autoPreview: { type: 'boolean', default: false },
    maxTokens: { type: 'number', default: 8192 },
    profiles: { type: 'object', default: {} },
  },
});

export const config = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  getAll: () => store.store,
  clear: () => store.clear(),
  path: store.path,

  getApiKey() {
    return process.env.ANTHROPIC_API_KEY || store.get('apiKey');
  },

  setApiKey(key) {
    store.set('apiKey', key);
  },

  requireApiKey() {
    const key = this.getApiKey();
    if (!key) {
      console.error(chalk.red('\n✗ No API key found.'));
      console.error(chalk.yellow('  Run: mastercode config set-key <your-api-key>'));
      console.error(chalk.yellow('  Or:  export ANTHROPIC_API_KEY=<your-api-key>\n'));
      process.exit(1);
    }
    return key;
  },

  getModel() {
    return process.env.MC_MODEL || store.get('model');
  },

  saveProfile(name, settings) {
    const profiles = store.get('profiles') || {};
    profiles[name] = { ...settings, savedAt: new Date().toISOString() };
    store.set('profiles', profiles);
  },

  loadProfile(name) {
    const profiles = store.get('profiles') || {};
    return profiles[name] || null;
  },

  listProfiles() {
    return Object.keys(store.get('profiles') || {});
  },
};
