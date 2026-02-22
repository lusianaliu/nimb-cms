import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = Object.freeze({
  name: 'nimb-app',
  plugins: Object.freeze([]),
  runtime: Object.freeze({
    logLevel: 'info',
    mode: 'development'
  })
});

const ALLOWED_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
};

const normalizePlugins = (plugins) => {
  if (!Array.isArray(plugins)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    [...new Set(plugins.map((entry) => String(entry ?? '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right))
  );
};

const normalizeRuntime = (runtime) => {
  const logLevel = String(runtime?.logLevel ?? DEFAULT_CONFIG.runtime.logLevel).toLowerCase();
  const mode = String(runtime?.mode ?? DEFAULT_CONFIG.runtime.mode).toLowerCase();

  if (!ALLOWED_LOG_LEVELS.has(logLevel)) {
    throw new Error(`invalid runtime.logLevel: ${logLevel}`);
  }

  return Object.freeze({
    logLevel,
    mode
  });
};

const validateRoot = (input) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('nimb config must be an object');
  }

  const allowedKeys = new Set(['name', 'plugins', 'runtime']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`unsupported config key: ${key}`);
    }
  }
};

export const resolveConfigPath = (cwd = process.cwd()) => path.resolve(cwd, 'nimb.config.json');

export const loadConfig = ({ cwd = process.cwd(), fsModule = fs } = {}) => {
  const configPath = resolveConfigPath(cwd);
  let parsed = {};

  if (fsModule.existsSync(configPath)) {
    parsed = JSON.parse(fsModule.readFileSync(configPath, 'utf8'));
  }

  validateRoot(parsed);

  const normalized = {
    name: String(parsed.name ?? DEFAULT_CONFIG.name).trim() || DEFAULT_CONFIG.name,
    plugins: normalizePlugins(parsed.plugins ?? DEFAULT_CONFIG.plugins),
    runtime: normalizeRuntime(parsed.runtime ?? DEFAULT_CONFIG.runtime)
  };

  return deepFreeze(normalized);
};
