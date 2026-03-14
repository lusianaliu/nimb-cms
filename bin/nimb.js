#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, createBootstrap, validateAdminStaticDir, validateStartupInvariants } from '../core/bootstrap/index.ts';
import { createRuntimeAdapter, createEmbeddedAdapter, resolveAdapterType } from '../core/runtime/adapters/index.ts';
import { createProjectModel, createProjectPaths, PROJECT_DIRECTORY_NAMES, isProjectInstalled } from '../core/project/index.ts';
import { version, resolveRuntimeMode as resolveEnvironmentMode } from '../core/runtime/version.ts';
import { resolveRuntimeMode } from '../core/runtime/resolve-runtime-mode.ts';
import { runBuild } from '../core/cli/build.ts';
import { runRelease } from '../core/cli/release.ts';
import { runPreflightDiagnostics, formatPreflightReport } from '../core/cli/preflight.ts';
import { resolveProjectRootFromArgs } from '../core/cli/project-root-resolver.ts';

const invocationCwd = process.cwd();
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimestamp = new Date().toISOString();

const DEFAULT_CONFIG = {
  name: 'My Nimb Site',
  runtime: {
    mode: 'production'
  },
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
  PROJECT_DIRECTORY_NAMES.public,
  PROJECT_DIRECTORY_NAMES.logs,
  'config',
  'data/system',
  'data/content',
  'data/uploads'
];


const appendErrorLog = ({ projectRoot, error, context }) => {
  try {
    const logsDir = path.join(projectRoot, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, 'runtime-error.log');
    const message = `[${new Date().toISOString()}] ${context}: ${error?.stack ?? error?.message ?? String(error)}
`;
    fs.appendFileSync(logPath, message, 'utf8');
  } catch (_loggingError) {
    // best-effort logging only
  }
};

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


const resolveRuntimeAdapter = (config, env = process.env) => {
  const fromEnv = env.NIMB_RUNTIME_ADAPTER;
  const fromConfig = config?.runtime?.adapter;
  return resolveAdapterType(fromEnv ?? fromConfig ?? 'node');
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


const startBridge = async () => {
  const projectPaths = createProjectPaths(projectRoot);
  const project = createProjectModel({ projectRoot: projectPaths.projectRoot });
  let bridgeServer;

  try {
    const config = loadConfig({ cwd: projectPaths.projectRoot });
    const port = resolvePort(config);
    await validateStartupInvariants({ config, project: projectPaths, runtimeRoot, port });

    const bootstrap = await createBootstrap({ project: projectPaths, startupTimestamp });
    const adapter = createEmbeddedAdapter({
      runtime: bootstrap.runtime,
      config: bootstrap.config,
      startupTimestamp,
      rootDirectory: runtimeRoot,
      authService: bootstrap.authService,
      authMiddleware: bootstrap.authMiddleware,
      adminController: bootstrap.adminController,
      contentRegistry: bootstrap.contentRegistry,
      persistContentTypes: bootstrap.persistContentTypes,
      entryRegistry: bootstrap.entryRegistry,
      persistEntries: bootstrap.persistEntries
    });

    await adapter.start();

    bridgeServer = http.createServer((request, response) => {
      void adapter.handler(request, response);
    });

    await new Promise((resolve, reject) => {
      bridgeServer.once('error', reject);
      bridgeServer.listen(port, '0.0.0.0', () => resolve(undefined));
    });

    process.stdout.write(`Nimb v${version}\n`);
    process.stdout.write('mode: bridge\n');
    process.stdout.write(`project: ${project.projectRoot}\n`);
    process.stdout.write('Bridge target: adapter.handler(request, response)\n');
    process.stdout.write('Reverse proxy hint: forward method/url/headers/body to this handler.\n');
    process.stdout.write(`Debug port: ${port}\n`);
    process.stdout.write('Ready.\n');

    const shutdown = async () => {
      if (bridgeServer) {
        await new Promise((resolve) => bridgeServer.close(() => resolve(undefined)));
      }

      await adapter.stop();
      await bootstrap.runtime.dispose?.();
      process.exit();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    process.stderr.write(`Bridge startup failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'bridge-startup' });
    process.exitCode = 1;
  }
};

const startServer = async () => {
  const projectPaths = createProjectPaths(projectRoot);
  const project = createProjectModel({ projectRoot: projectPaths.projectRoot });
  let httpServer;
  let currentBootstrap;
  let restartHandled = false;

  const startBootstrapServer = async (bootstrapOptions = {}) => {
    const bootstrap = await createBootstrap({ project: projectPaths, startupTimestamp, ...bootstrapOptions });
    const adapterType = resolveRuntimeAdapter(bootstrap.config);
    const adapter = createRuntimeAdapter({
      type: adapterType,
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
        await adapter.stop();
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

    await adapter.start();
    const activePort = typeof adapter.getPort === 'function' ? adapter.getPort() : null;
    return { bootstrap, server: adapter, activePort: activePort ?? port };
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
    appendErrorLog({ projectRoot, error, context: 'startup' });
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

const { projectRoot, args } = resolveProjectRootFromArgs({
  argv: process.argv.slice(2),
  invocationCwd
});

if (args[0] === 'init') {
  try {
    createProject(args[1]);
  } catch (error) {
    process.stderr.write(`Init failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'init' });
    process.exitCode = 1;
  }
} else if (args[0] === 'build') {
  try {
    const { distRoot } = runBuild({ runtimeRoot, projectRoot });
    process.stdout.write(`Build complete: ${distRoot}\n`);
  } catch (error) {
    process.stderr.write(`Build failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'build' });
    process.exitCode = 1;
  }
} else if (args[0] === 'release') {
  try {
    const { releaseRoot, zipPath } = runRelease({ runtimeRoot, projectRoot });
    process.stdout.write(`Release complete: ${releaseRoot}\n`);
    process.stdout.write(`Package created: ${zipPath}\n`);
  } catch (error) {
    process.stderr.write(`Release failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'release' });
    process.exitCode = 1;
  }
} else if (args[0] === 'bridge') {
  await startBridge();
} else if (args[0] === 'preflight') {
  const report = await runPreflightDiagnostics({ projectRoot, runtimeRoot });
  process.stdout.write(formatPreflightReport(report));
  process.exitCode = report.exitCode;
} else {
  await startServer();
}
