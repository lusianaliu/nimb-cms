import fs from 'node:fs';
import path from 'node:path';
import { version } from '../runtime/version.ts';

const BUILD_DIRECTORIES = Object.freeze([
  Object.freeze({ source: 'core', target: 'server/core' }),
  Object.freeze({ source: 'admin', target: 'public/admin', optional: true }),
  Object.freeze({ source: 'public', target: 'public', optional: true })
]);

const SKIP_PATH_NAMES = new Set(['test', 'tests', 'docs', 'scripts', '.git', 'node_modules']);

const ensureRemoved = (targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const shouldSkipEntry = (entryName: string) => SKIP_PATH_NAMES.has(entryName.toLowerCase());

const copyFile = (sourcePath: string, targetPath: string) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
};

const copyDirectory = (sourcePath: string, targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });
  const entries = fs.readdirSync(sourcePath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const entrySourcePath = path.join(sourcePath, entry.name);
    const entryTargetPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(entrySourcePath, entryTargetPath);
      continue;
    }

    if (entry.isFile()) {
      copyFile(entrySourcePath, entryTargetPath);
    }
  }
};

const writeRuntimeEntrypoints = (distRoot: string) => {
  const serverRoot = path.join(distRoot, 'server');

  fs.writeFileSync(
    path.join(serverRoot, 'bootstrap.js'),
    [
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      "import { loadConfig, createBootstrap, validateAdminStaticDir, validateStartupInvariants } from './core/bootstrap/index.ts';",
      "import { createRuntimeAdapter } from './core/runtime/adapters/index.ts';",
      "import { createProjectPaths } from './core/project/index.ts';",
      '',
      'export const start = async () => {',
      "  const distRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
      "  const projectRoot = path.resolve(distRoot, '..');",
      "  const serverRoot = path.resolve(distRoot, 'server');",
      '  const projectPaths = createProjectPaths(projectRoot);',
      '  const config = loadConfig({ cwd: projectRoot });',
      "  const port = Number(process.env.PORT ?? config?.server?.port ?? 3000);",
      '  validateAdminStaticDir(config, serverRoot);',
      '  await validateStartupInvariants({ config, project: projectPaths, runtimeRoot: serverRoot, port });',
      "  const bootstrap = await createBootstrap({ project: projectPaths, startupTimestamp: new Date().toISOString(), mode: 'runtime' });",
      "  const server = createRuntimeAdapter({",
      "    type: 'node',",
      '    runtime: bootstrap.runtime,',
      '    config: bootstrap.config,',
      "    startupTimestamp: new Date().toISOString(),",
      '    rootDirectory: distRoot,',
      '    port,',
      '    authService: bootstrap.authService,',
      '    authMiddleware: bootstrap.authMiddleware,',
      '    adminController: bootstrap.adminController,',
      '    contentRegistry: bootstrap.contentRegistry,',
      '    persistContentTypes: bootstrap.persistContentTypes,',
      '    entryRegistry: bootstrap.entryRegistry,',
      '    persistEntries: bootstrap.persistEntries',
      '  });',
      '  await server.start();',
      "  process.stdout.write('Ready.\\n');",
      '  return server;',
      '};',
      ''
    ].join('\n'),
    'utf8'
  );

  fs.writeFileSync(path.join(serverRoot, 'http-server.js'), "export { createHttpServer } from './core/http/index.ts';\n", 'utf8');
  fs.writeFileSync(path.join(serverRoot, 'runtime-adapters.js'), "export { createRuntimeAdapter } from './core/runtime/adapters/index.ts';\n", 'utf8');
  fs.writeFileSync(path.join(serverRoot, 'bridge.js'), "export const createBridge = async () => { throw new Error('Bridge mode is unavailable in packaged runtime.'); };\n", 'utf8');
  fs.writeFileSync(path.join(serverRoot, 'start.js'), "export { start } from './bootstrap.js';\n", 'utf8');
};

const writeManifest = (distRoot: string) => {
  const manifestPath = path.join(distRoot, 'manifest.json');
  const payload = Object.freeze({
    name: 'nimb',
    version,
    buildTime: new Date().toISOString(),
    mode: 'production'
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const writePackagedConfig = ({ projectRoot }: { projectRoot: string }) => {
  const legacyConfigPath = path.join(projectRoot, 'nimb.config.json');
  const packagedConfigPath = path.join(projectRoot, 'config', 'nimb.config.json');
  const config = fs.existsSync(packagedConfigPath)
    ? JSON.parse(fs.readFileSync(packagedConfigPath, 'utf8'))
    : fs.existsSync(legacyConfigPath)
      ? JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'))
      : {};

  const normalized = {
    ...config,
    name: String(config?.name ?? 'My Nimb Site'),
    runtime: {
      ...(config.runtime ?? {}),
      mode: 'production'
    },
    admin: {
      ...(config.admin ?? {}),
      enabled: config?.admin?.enabled === false ? false : true,
      staticDir: '../public/admin'
    }
  };

  fs.mkdirSync(path.dirname(packagedConfigPath), { recursive: true });
  fs.writeFileSync(packagedConfigPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
};

const writeRootStartScript = (projectRoot: string) => {
  const startPath = path.join(projectRoot, 'start.js');
  fs.writeFileSync(startPath, "import { start } from './dist/server/start.js'\n\nstart()\n", 'utf8');
};

const ensureRuntimeDirectories = (projectRoot: string) => {
  for (const directory of ['data/system', 'data/content', 'data/uploads', 'logs']) {
    fs.mkdirSync(path.join(projectRoot, directory), { recursive: true });
  }
};

export const runBuild = ({ runtimeRoot, projectRoot = process.cwd() }: { runtimeRoot: string; projectRoot?: string }) => {
  const distRoot = path.join(projectRoot, 'dist');

  ensureRemoved(distRoot);
  fs.mkdirSync(distRoot, { recursive: true });

  for (const directory of BUILD_DIRECTORIES) {
    const sourceRoot = directory.source === 'public' ? projectRoot : runtimeRoot;
    const sourcePath = path.join(sourceRoot, directory.source);
    if (!fs.existsSync(sourcePath)) {
      if (directory.optional) {
        continue;
      }

      throw new Error(`Build failed: required directory is missing: ${sourcePath}`);
    }

    copyDirectory(sourcePath, path.join(distRoot, directory.target));
  }

  copyFile(path.join(runtimeRoot, 'package.json'), path.join(distRoot, 'server', 'package.json'));
  writeRuntimeEntrypoints(distRoot);
  writeManifest(distRoot);
  writePackagedConfig({ projectRoot });
  ensureRuntimeDirectories(projectRoot);
  writeRootStartScript(projectRoot);

  return Object.freeze({ distRoot });
};
