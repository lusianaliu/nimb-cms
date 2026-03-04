import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = Object.freeze({
  name: 'My Nimb Site',
  plugins: Object.freeze([]),
  runtime: Object.freeze({
    logLevel: 'info',
    mode: 'production'
  }),
  server: Object.freeze({}),
  admin: Object.freeze({
    enabled: true,
    basePath: '/admin',
    staticDir: './ui/admin',
    title: 'Nimb Admin'
  })
});

const ALLOWED_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const ALLOWED_RUNTIME_MODES = new Set(['development', 'production']);

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

  if (!ALLOWED_RUNTIME_MODES.has(mode)) {
    throw new Error(`invalid runtime.mode: ${mode}`);
  }

  return Object.freeze({
    logLevel,
    mode
  });
};

const normalizeServer = (server) => {
  if (server === undefined) {
    return Object.freeze({});
  }

  if (server === null || typeof server !== 'object' || Array.isArray(server)) {
    throw new Error('config.server must be an object');
  }

  if (server.port === undefined) {
    return Object.freeze({});
  }

  const parsedPort = Number(server.port);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    throw new Error('config.server.port must be an integer between 0 and 65535');
  }

  return Object.freeze({ port: parsedPort });
};

const normalizeBasePath = (basePath) => {
  const raw = String(basePath ?? DEFAULT_CONFIG.admin.basePath).trim();

  if (!raw.startsWith('/')) {
    throw new Error('config.admin.basePath must start with "/"');
  }

  const normalized = raw.replace(/\/+$/g, '') || '/';

  if (normalized === '/api' || normalized.startsWith('/api/')) {
    throw new Error('config.admin.basePath cannot overlap with /api routes');
  }

  return normalized;
};

const normalizeAdmin = (admin) => {
  if (admin === undefined) {
    return DEFAULT_CONFIG.admin;
  }

  if (admin === null || typeof admin !== 'object' || Array.isArray(admin)) {
    throw new Error('config.admin must be an object');
  }

  const enabled = admin.enabled === undefined ? DEFAULT_CONFIG.admin.enabled : admin.enabled === true;
  const basePath = normalizeBasePath(admin.basePath);
  const staticDir = String(admin.staticDir ?? DEFAULT_CONFIG.admin.staticDir).trim() || DEFAULT_CONFIG.admin.staticDir;
  const title = typeof admin.title === 'string' && admin.title.trim() ? admin.title.trim() : DEFAULT_CONFIG.admin.title;

  return Object.freeze({
    enabled,
    basePath,
    staticDir,
    title
  });
};

const validateRoot = (input) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('nimb config must be an object');
  }

  const allowedKeys = new Set(['name', 'plugins', 'runtime', 'server', 'admin']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`unsupported config key: ${key}`);
    }
  }
};

export const resolveConfigPath = (cwd = process.cwd()) => path.resolve(cwd, 'config', 'nimb.config.json');

const resolveLegacyConfigPath = (cwd = process.cwd()) => path.resolve(cwd, 'nimb.config.json');

export const loadConfig = ({ cwd = process.cwd(), fsModule = fs } = {}) => {
  const packagedConfigPath = resolveConfigPath(cwd);
  const legacyConfigPath = resolveLegacyConfigPath(cwd);
  const configPath = fsModule.existsSync(packagedConfigPath) ? packagedConfigPath : legacyConfigPath;
  let parsed = {};

  if (fsModule.existsSync(configPath)) {
    parsed = JSON.parse(fsModule.readFileSync(configPath, 'utf8'));
  } else {
    fsModule.mkdirSync(path.dirname(packagedConfigPath), { recursive: true });
    fsModule.writeFileSync(packagedConfigPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    parsed = JSON.parse(fsModule.readFileSync(packagedConfigPath, 'utf8'));
  }

  validateRoot(parsed);

  const normalized = {
    name: String(parsed.name ?? DEFAULT_CONFIG.name).trim() || DEFAULT_CONFIG.name,
    plugins: normalizePlugins(parsed.plugins ?? DEFAULT_CONFIG.plugins),
    runtime: normalizeRuntime(parsed.runtime ?? DEFAULT_CONFIG.runtime),
    server: normalizeServer(parsed.server),
    admin: normalizeAdmin(parsed.admin)
  };

  return deepFreeze(normalized);
};
