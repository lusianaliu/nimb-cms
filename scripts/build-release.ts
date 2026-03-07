import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RELEASE_ROOT = 'release';
const DIST_ROOT = 'dist';
const RELEASE_ARCHIVE = 'nimb-release.zip';

const removePath = (targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const copyDirectory = (sourcePath: string, targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });
  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourceEntryPath, targetEntryPath);
      continue;
    }

    fs.mkdirSync(path.dirname(targetEntryPath), { recursive: true });
    fs.copyFileSync(sourceEntryPath, targetEntryPath);
  }
};

const ensureDataFiles = ({ projectRoot, releaseRoot }: { projectRoot: string; releaseRoot: string }) => {
  const releaseDataRoot = path.join(releaseRoot, 'data');
  const settingsPath = path.join(releaseDataRoot, 'settings.json');
  const sourceInstallLockPath = path.join(projectRoot, 'data', 'install.lock');
  const targetInstallLockPath = path.join(releaseDataRoot, 'install.lock');

  fs.mkdirSync(releaseDataRoot, { recursive: true });

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, '{}\n', 'utf8');
  }

  if (fs.existsSync(sourceInstallLockPath)) {
    fs.copyFileSync(sourceInstallLockPath, targetInstallLockPath);
  }
};

const writeReleasePackageJson = ({ projectRoot, releaseRoot }: { projectRoot: string; releaseRoot: string }) => {
  const sourcePackageJsonPath = path.join(projectRoot, 'package.json');
  const targetPackageJsonPath = path.join(releaseRoot, 'package.json');
  const sourcePackageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, 'utf8'));

  const releasePackageJson = {
    name: sourcePackageJson.name,
    version: sourcePackageJson.version,
    private: true,
    type: 'module',
    scripts: {
      start: 'node server.js'
    }
  };

  fs.writeFileSync(targetPackageJsonPath, `${JSON.stringify(releasePackageJson, null, 2)}\n`, 'utf8');
};

const writeServerEntry = (releaseRoot: string) => {
  const serverEntryPath = path.join(releaseRoot, 'server.js');
  fs.writeFileSync(
    serverEntryPath,
    [
      "import { createBootstrap } from './core/bootstrap/index.ts';",
      "import { createHttpServer } from './core/http/index.ts';",
      '',
      'const start = async () => {',
      '  const projectRoot = process.cwd();',
      '  const bootstrap = await createBootstrap({ cwd: projectRoot });',
      '  const port = Number(process.env.PORT ?? 3000);',
      '  const server = createHttpServer({',
      '    runtime: bootstrap.runtime,',
      '    config: bootstrap.config,',
      '    startupTimestamp: new Date().toISOString(),',
      '    port,',
      '    rootDirectory: projectRoot',
      '  });',
      '',
      '  await server.start();',
      "  process.stdout.write(`Ready. Port: ${port}\\n`);",
      '};',
      '',
      'start().catch((error) => {',
      "  process.stderr.write(`Release startup failed: ${error?.message ?? String(error)}\\n`);",
      '  process.exitCode = 1;',
      '});',
      ''
    ].join('\n'),
    'utf8'
  );
};

const createReleaseArchive = ({ projectRoot, releaseRoot }: { projectRoot: string; releaseRoot: string }) => {
  const distRoot = path.join(projectRoot, DIST_ROOT);
  const zipPath = path.join(distRoot, RELEASE_ARCHIVE);

  fs.mkdirSync(distRoot, { recursive: true });
  removePath(zipPath);

  execFileSync('zip', ['-r', zipPath, '.'], {
    cwd: releaseRoot,
    stdio: 'pipe'
  });

  return zipPath;
};

const buildRelease = ({ projectRoot = process.cwd() } = {}) => {
  const releaseRoot = path.join(projectRoot, RELEASE_ROOT);

  removePath(releaseRoot);
  fs.mkdirSync(releaseRoot, { recursive: true });

  copyDirectory(path.join(projectRoot, 'core'), path.join(releaseRoot, 'core'));
  copyDirectory(path.join(projectRoot, 'public'), path.join(releaseRoot, 'public'));
  copyDirectory(path.join(projectRoot, 'themes', 'default'), path.join(releaseRoot, 'themes', 'default'));
  copyDirectory(path.join(projectRoot, 'data'), path.join(releaseRoot, 'data'));

  ensureDataFiles({ projectRoot, releaseRoot });
  writeReleasePackageJson({ projectRoot, releaseRoot });
  writeServerEntry(releaseRoot);

  const zipPath = createReleaseArchive({ projectRoot, releaseRoot });
  return Object.freeze({ releaseRoot, zipPath });
};

const { releaseRoot, zipPath } = buildRelease();
process.stdout.write(`Release directory created: ${releaseRoot}\n`);
process.stdout.write(`Release package created: ${zipPath}\n`);

export { buildRelease };
