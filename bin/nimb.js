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
import { runPreflightDiagnostics, formatPreflightReport, formatPreflightReportJson } from '../core/cli/preflight.ts';
import { runSetupCommand } from '../core/cli/setup.ts';
import { runBaselineVerification, formatBaselineVerificationReport, formatBaselineVerificationReportJson } from '../core/cli/verify.ts';
import { resolveProjectRootFromArgs } from '../core/cli/project-root-resolver.ts';
import { assertValidStartupPort } from '../core/invariants/startup-port.ts';

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
    return assertValidStartupPort(Number(fromEnv), 'PORT environment variable');
  }

  if (config?.server?.port !== undefined) {
    return assertValidStartupPort(config.server.port, 'config.server.port');
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
    `# ${projectName}\n\nGenerated with \`nimb init\`.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpx nimb setup\nnpm start\n\`\`\`\n\n## Project vs repository\n\nRun Nimb from this generated project directory, not from the Nimb source repository.\n\n## Guided setup before run/deploy\n\n\`\`\`bash\nnpx nimb setup\n\`\`\`\n\nThis creates any missing canonical layout directories that are safe to create, then runs preflight automatically.\n\n## Preflight only (validation without setup changes)\n\n\`\`\`bash\nnpx nimb preflight\n\`\`\`\n\n## Verify known-good baseline before first run/deploy\n\n\`\`\`bash\nnpx nimb verify\n\`\`\`\n\n\`verify\` classifies baseline readiness as READY_TO_TRY_RUN, STOP_AND_FIX_FIRST, or ESCALATE_NOW.\nIt checks baseline assumptions only and does not guarantee full runtime behavior.\n\n## Required writable paths\n\nNimb must be able to write to:\n\n- \`data/\`\n- \`data/system/\`\n- \`data/content/\`\n- \`data/uploads/\`\n- \`logs/\`\n`
  );

  process.stdout.write('Project created.\n');
  process.stdout.write(`cd ${projectName}\n`);
  process.stdout.write('npm install\n');
  process.stdout.write('npx nimb setup\n');
  process.stdout.write('npx nimb\n');
};

const printOperatorGuide = ({ projectRoot }) => {
  process.stdout.write('Nimb Install & Deployment Guide\n');
  process.stdout.write('================================\n');
  process.stdout.write(`Project root: ${projectRoot}\n\n`);
  process.stdout.write('1) Create an installed project\n');
  process.stdout.write('   - Recommended: npx nimb init my-site\n');
  process.stdout.write('   - Then: cd my-site\n\n');
  process.stdout.write('2) Understand runtime context\n');
  process.stdout.write('   - Nimb should run from an installed project root.\n');
  process.stdout.write('   - The source repository root is a development environment, not a deployment target.\n');
  process.stdout.write('   - Override project root only when needed: --project-root <path>\n\n');
  process.stdout.write('3) Required writable paths\n');
  process.stdout.write('   - data/\n');
  process.stdout.write('   - data/system/ (install-state source: data/system/config.json)\n');
  process.stdout.write('   - data/content/\n');
  process.stdout.write('   - data/uploads/\n');
  process.stdout.write('   - logs/\n\n');
  process.stdout.write('4) Run deployment preflight\n');
  process.stdout.write('   - Recommended: npx nimb setup\n');
  process.stdout.write('   - It creates safe missing directories, then runs preflight automatically.\n');
  process.stdout.write('   - Manual fixes are still required for non-directory path conflicts and permission failures.\n\n');
  process.stdout.write('5) Run preflight directly when needed\n');
  process.stdout.write('   - npx nimb preflight\n');
  process.stdout.write('   - Use this for validation-only checks without setup actions.\n\n');
  process.stdout.write('6) Verify known-good baseline before first run/deploy\n');
  process.stdout.write('   - npx nimb verify\n');
  process.stdout.write('   - READY_TO_TRY_RUN means baseline assumptions are satisfied (not a full runtime guarantee).\n\n');
  process.stdout.write('7) Start Nimb\n');
  process.stdout.write('   - npx nimb\n');
  process.stdout.write('   - Open /admin after startup to continue setup/content operations.\n\n');
  process.stdout.write('8) If startup looks successful but site/admin is unreachable\n');
  process.stdout.write('   - If process exits/crashes: treat as startup failure and inspect startup output + logs/runtime-error.log.\n');
  process.stdout.write('   - If process stays up: check local host/port first, then treat external URL mismatch as proxy/panel/container routing issue.\n');
  process.stdout.write('   - Run one bounded retry cycle: npx nimb verify, then one startup retry.\n');
  process.stdout.write('   - If still READY_TO_TRY_RUN but unreachable, escalate with: npx nimb preflight --json > nimb-preflight-report.json\n');
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

const preflightJsonOutput = args.includes('--json');
const normalizedArgs = args.filter((arg) => arg !== '--json');

if (normalizedArgs[0] === 'init') {
  try {
    createProject(normalizedArgs[1]);
  } catch (error) {
    process.stderr.write(`Init failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'init' });
    process.exitCode = 1;
  }
} else if (normalizedArgs[0] === 'build') {
  try {
    const { distRoot } = runBuild({ runtimeRoot, projectRoot });
    process.stdout.write(`Build complete: ${distRoot}\n`);
  } catch (error) {
    process.stderr.write(`Build failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'build' });
    process.exitCode = 1;
  }
} else if (normalizedArgs[0] === 'release') {
  try {
    const { releaseRoot, zipPath } = runRelease({ runtimeRoot, projectRoot });
    process.stdout.write(`Release complete: ${releaseRoot}\n`);
    process.stdout.write(`Package created: ${zipPath}\n`);
  } catch (error) {
    process.stderr.write(`Release failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'release' });
    process.exitCode = 1;
  }
} else if (normalizedArgs[0] === 'bridge') {
  await startBridge();
} else if (normalizedArgs[0] === 'preflight') {
  const report = await runPreflightDiagnostics({ projectRoot, runtimeRoot });
  process.stdout.write(preflightJsonOutput ? formatPreflightReportJson(report) : formatPreflightReport(report));
  process.exitCode = report.exitCode;
} else if (normalizedArgs[0] === 'setup') {
  try {
    const result = await runSetupCommand({ projectRoot, runtimeRoot });
    process.exitCode = result.preflightExitCode === 0 && result.blockedPaths.length === 0 ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Setup failed: ${error?.message ?? String(error)}\n`);
    appendErrorLog({ projectRoot, error, context: 'setup' });
    process.exitCode = 1;
  }
} else if (normalizedArgs[0] === 'verify') {
  const report = await runBaselineVerification({ projectRoot, runtimeRoot });
  process.stdout.write(preflightJsonOutput ? formatBaselineVerificationReportJson(report) : formatBaselineVerificationReport(report));
  process.exitCode = report.readiness === 'READY_TO_TRY_RUN' ? 0 : 1;
} else if (normalizedArgs[0] === 'guide') {
  printOperatorGuide({ projectRoot });
} else {
  await startServer();
}
