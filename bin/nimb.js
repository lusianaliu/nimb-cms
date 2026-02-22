#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, createRuntime, createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const projectRoot = process.cwd();
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimestamp = new Date().toISOString();

const DEFAULT_CONFIG = {
  server: {
    port: 3000
  },
  admin: {
    enabled: true,
    basePath: '/admin'
  }
};

const INIT_DIRECTORIES = ['content', 'data', 'plugins', 'public'];

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

const resolveAdminStaticDir = (config, rootDirectory) => {
  const staticDir = config?.admin?.staticDir ?? './ui/admin';
  return path.isAbsolute(staticDir) ? staticDir : path.resolve(rootDirectory, staticDir);
};

const validateAdminStaticDir = (config, rootDirectory) => {
  if (config?.admin?.enabled !== true) {
    return;
  }

  const adminDir = resolveAdminStaticDir(config, rootDirectory);
  if (!fs.existsSync(adminDir)) {
    throw new Error(`Admin staticDir does not exist: ${adminDir}`);
  }

  if (!fs.statSync(adminDir).isDirectory()) {
    throw new Error(`Admin staticDir is not a directory: ${adminDir}`);
  }
};

const createProject = (projectName) => {
  if (!projectName || projectName.trim() === '') {
    throw new Error('Project name is required. Usage: nimb init <project-name>');
  }

  const targetRoot = path.resolve(projectRoot, projectName);

  if (fs.existsSync(targetRoot)) {
    throw new Error(`Target directory already exists: ${targetRoot}`);
  }

  fs.mkdirSync(targetRoot, { recursive: false });

  for (const directory of INIT_DIRECTORIES) {
    fs.mkdirSync(path.join(targetRoot, directory), { recursive: false });
  }

  const configPath = path.join(targetRoot, 'nimb.config.json');
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

const startServer = async () => {
  let httpServer;

  try {
    const config = loadConfig({ cwd: projectRoot });
    validateAdminStaticDir(config, runtimeRoot);
    const port = resolvePort(config);

    createRuntime(config);
    const bootstrap = await createBootstrap({ cwd: projectRoot, startupTimestamp });

    httpServer = createHttpServer({
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

    const { port: activePort } = await httpServer.start();

    process.stdout.write('Nimb CMS starting...\n');
    process.stdout.write('Mode: standalone\n');
    process.stdout.write(`Port: ${activePort}\n`);
    process.stdout.write(`Admin path: ${bootstrap.config.admin.basePath}\n`);
    process.stdout.write(`Plugins loaded: ${bootstrap.snapshot.loadedPlugins.length}\n`);
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

const args = process.argv.slice(2);

if (args[0] === 'init') {
  try {
    createProject(args[1]);
  } catch (error) {
    process.stderr.write(`Init failed: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  }
} else {
  await startServer();
}
