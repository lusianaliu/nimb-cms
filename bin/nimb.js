#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, createBootstrap, validateAdminStaticDir, validateStartupInvariants } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';
import { createProjectModel, createProjectPaths, PROJECT_DIRECTORY_NAMES, isProjectInstalled } from '../core/project/index.ts';
import { version, resolveRuntimeMode as resolveEnvironmentMode } from '../core/runtime/version.ts';
import { resolveRuntimeMode } from '../core/runtime/resolve-runtime-mode.ts';

const invocationCwd = process.cwd();
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimestamp = new Date().toISOString();
const BUILD_ALLOWLIST = Object.freeze([
  Object.freeze({ type: 'directory', source: 'bin', required: true }),
  Object.freeze({ type: 'directory', source: 'core', required: true }),
  Object.freeze({ type: 'directory', source: 'ui', required: true }),
  Object.freeze({ type: 'file', source: 'package.json', required: true }),
  Object.freeze({ type: 'file', source: 'nimb.config.json', required: true, fromProjectRoot: true }),
  Object.freeze({ type: 'directory', source: 'public', required: false, fromProjectRoot: true })
]);

const DEFAULT_CONFIG = {
  server: {
    port: 3000
  },
  admin: {
    enabled: true,
    basePath: '/admin'
  }
};

const INIT_DIRECTORIES = [
  PROJECT_DIRECTORY_NAMES.content,
  PROJECT_DIRECTORY_NAMES.data,
  PROJECT_DIRECTORY_NAMES.plugins,
  PROJECT_DIRECTORY_NAMES.themes,
  PROJECT_DIRECTORY_NAMES.public
];

const resolvePort = (config) => {
  const fromEnv = process.env.PORT;
  if (fromEnv !== undefined && `${fromEnv}`.trim() !== '') {
    const envPort = Number(fromEnv);
    if (!Number.isInteger(envPort) || envPort < 0 || envPort > 65535) {
      throw new Error(`Invalid PORT environment variable: ${fromEnv}`);
    }

    return envPort;
  }

  if (config?.server?.port !== undefined) {
    return config.server.port;
  }

  return 3000;
};

const resolveProjectRoot = (argv, env = process.env) => {
  let fromArg;
  const cleaned = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      fromArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--project-root=')) {
      fromArg = arg.slice('--project-root='.length);
      continue;
    }

    cleaned.push(arg);
  }

  const fromEnv = env.NIMB_PROJECT_ROOT;
  const fromStartCommand = cleaned[0] === 'start' && cleaned[1] && !cleaned[1].startsWith('-') ? cleaned[1] : undefined;
  const normalizedArgs = fromStartCommand ? [cleaned[0], ...cleaned.slice(2)] : cleaned;
  const configuredRoot = fromArg ?? fromEnv ?? fromStartCommand;
  const projectRoot = configuredRoot ? path.resolve(invocationCwd, configuredRoot) : invocationCwd;

  return Object.freeze({ projectRoot, args: Object.freeze(normalizedArgs) });
};

const createProject = (projectName) => {
  if (!projectName || projectName.trim() === '') {
    throw new Error('Project name is required. Usage: nimb init <project-name>');
  }

  const targetRoot = path.resolve(invocationCwd, projectName);
  const project = createProjectModel({ projectRoot: targetRoot });

  if (fs.existsSync(targetRoot)) {
    throw new Error(`Target directory already exists: ${targetRoot}`);
  }

  fs.mkdirSync(targetRoot, { recursive: false });

  for (const directory of INIT_DIRECTORIES) {
    fs.mkdirSync(path.join(targetRoot, directory), { recursive: false });
  }

  const configPath = project.configFile;
  fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);

  const packageJsonPath = path.join(targetRoot, 'package.json');
  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify(
      {
        name: projectName,
        private: true,
        dependencies: {
          nimb: 'latest'
        },
        scripts: {
          start: 'nimb'
        }
      },
      null,
      2
    )}\n`
  );

  const readmePath = path.join(targetRoot, 'README.md');
  fs.writeFileSync(
    readmePath,
    `# ${projectName}\n\nGenerated with \`nimb init\`.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`
  );

  process.stdout.write('Project created.\n');
  process.stdout.write(`cd ${projectName}\n`);
  process.stdout.write('npm install\n');
  process.stdout.write('npx nimb\n');
};

const ensureRemoved = (targetPath) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const copyFileDeterministic = (sourcePath, targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
};

const copyDirectoryDeterministic = (sourceDirectory, targetDirectory) => {
  fs.mkdirSync(targetDirectory, { recursive: true });
  const entries = fs.readdirSync(sourceDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryDeterministic(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      copyFileDeterministic(sourcePath, targetPath);
    }
  }
};

const validateBuildSource = ({ sourcePath, expectedType, required }) => {
  if (!fs.existsSync(sourcePath)) {
    if (required) {
      throw new Error(`Required build asset is missing: ${sourcePath}`);
    }

    return false;
  }

  const stats = fs.statSync(sourcePath);
  if (expectedType === 'directory' && !stats.isDirectory()) {
    throw new Error(`Expected directory build asset but found non-directory: ${sourcePath}`);
  }

  if (expectedType === 'file' && !stats.isFile()) {
    throw new Error(`Expected file build asset but found non-file: ${sourcePath}`);
  }

  return true;
};

const runBuild = () => {
  const projectPaths = createProjectPaths(projectRoot);
  const project = createProjectModel({ projectRoot: projectPaths.projectRoot });
  process.stdout.write('Build start.\n');
  process.stdout.write(`Project root: ${project.root}\n`);
  process.stdout.write(`Runtime root: ${runtimeRoot}\n`);

  const configPath = project.configFile;
  if (!fs.existsSync(configPath)) {
    throw new Error(`nimb.config.json is required for build: ${configPath}`);
  }

  const config = loadConfig({ cwd: project.root });
  validateAdminStaticDir(config, runtimeRoot);
  process.stdout.write('Config validation: ok.\n');

  const outputRoot = project.buildDirectory;
  ensureRemoved(outputRoot);
  fs.mkdirSync(outputRoot, { recursive: true });

  for (const rule of BUILD_ALLOWLIST) {
    const sourceRoot = rule.fromProjectRoot ? project.root : runtimeRoot;
    const sourcePath = path.join(sourceRoot, rule.source);
    const shouldCopy = validateBuildSource({ sourcePath, expectedType: rule.type, required: rule.required });

    if (!shouldCopy) {
      continue;
    }

    const targetPath = path.join(outputRoot, rule.source);
    if (rule.type === 'directory') {
      copyDirectoryDeterministic(sourcePath, targetPath);
      process.stdout.write(`Copied directory: ${rule.source}\n`);
      continue;
    }

    copyFileDeterministic(sourcePath, targetPath);
    process.stdout.write(`Copied file: ${rule.source}\n`);
  }

  process.stdout.write(`Build complete: ${outputRoot}\n`);
};

const startServer = async () => {
  const projectPaths = createProjectPaths(projectRoot);
  const project = createProjectModel({ projectRoot: projectPaths.projectRoot });
  let httpServer;
  let currentBootstrap;
  let restartHandled = false;

  const startBootstrapServer = async (bootstrapOptions = {}) => {
    const bootstrap = await createBootstrap({ project: projectPaths, startupTimestamp, ...bootstrapOptions });
    const server = createHttpServer({
      runtime: bootstrap.runtime,
      config: bootstrap.config,
      startupTimestamp,
      rootDirectory: runtimeRoot,
      port,
      authService: bootstrap.authService,
      authMiddleware: bootstrap.authMiddleware,
      adminController: bootstrap.adminController,
      contentRegistry: bootstrap.contentRegistry,
      persistContentTypes: bootstrap.persistContentTypes,
      entryRegistry: bootstrap.entryRegistry,
      persistEntries: bootstrap.persistEntries
    });

    const transitionHandler = async () => {
      if (restartHandled) {
        return;
      }

      restartHandled = true;

      try {
        await server.stop();
        const restarted = await startBootstrapServer({ mode: 'runtime' });
        httpServer = restarted.server;
        currentBootstrap = restarted.bootstrap;
      } catch (error) {
        process.stderr.write(`Runtime transition failed: ${error?.message ?? String(error)}\n`);
      }
    };

    bootstrap.runtime?.events?.on?.('system.installed', () => {
      void transitionHandler();
    });

    const { port: activePort } = await server.start();
    return { bootstrap, server, activePort };
  };

  let port;

  try {
    const config = loadConfig({ cwd: projectPaths.projectRoot });
    port = resolvePort(config);
    await validateStartupInvariants({ config, project: projectPaths, runtimeRoot, port });

    const started = await startBootstrapServer();
    currentBootstrap = started.bootstrap;
    httpServer = started.server;
    const activePort = started.activePort;

    const mode = resolveEnvironmentMode(currentBootstrap.config.runtime.mode);
    const adminEnabled = currentBootstrap.config.admin.enabled === true;
    const installed = isProjectInstalled(project);
    const runtimeMode = currentBootstrap.runtimeMode ?? resolveRuntimeMode(project);

    process.stdout.write(`Nimb v${version}\n`);
    process.stdout.write(`mode: ${mode}\n`);
    process.stdout.write(`project: ${project.projectRoot}\n`);
    process.stdout.write(`installed: ${installed ? 'yes' : 'no'}\n`);
    process.stdout.write(`runtimeMode: ${runtimeMode}\n`);
    process.stdout.write(`Admin: ${adminEnabled ? `enabled (${currentBootstrap.config.admin.basePath})` : 'disabled'}\n`);
    process.stdout.write('Storage: active\n');
    process.stdout.write(`Port: ${activePort}\n`);
    process.stdout.write('Ready.\n');
  } catch (error) {
    process.stderr.write(`Startup failed: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  }

  const shutdown = async () => {
    if (httpServer) {
      await httpServer.stop();
    }

    process.exit();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

const { projectRoot, args } = resolveProjectRoot(process.argv.slice(2));

if (args[0] === 'init') {
  try {
    createProject(args[1]);
  } catch (error) {
    process.stderr.write(`Init failed: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  }
} else if (args[0] === 'build') {
  try {
    runBuild();
  } catch (error) {
    process.stderr.write(`Build failed: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  }
} else {
  await startServer();
}
