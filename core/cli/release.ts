import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runBuild } from './build.ts';

const RELEASE_ROOT_DIRECTORY = 'dist-release';
const RELEASE_PACKAGE_DIRECTORY = 'nimb';
const RELEASE_ZIP_NAME = 'nimb-v1.zip';

const ensureRemoved = (targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const copyDirectory = (sourcePath: string, targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourceEntry, targetEntry);
      continue;
    }

    fs.mkdirSync(path.dirname(targetEntry), { recursive: true });
    fs.copyFileSync(sourceEntry, targetEntry);
  }
};

const writeReleaseReadme = (releasePackageRoot: string) => {
  fs.writeFileSync(
    path.join(releasePackageRoot, 'README.md'),
    [
      '# Nimb CMS',
      '',
      'Quick start:',
      '',
      '1 Upload files to server',
      '2 Run:',
      '',
      '```bash',
      'node start.js',
      '```',
      '',
      '3 Visit:',
      '',
      '/install',
      ''
    ].join('\n'),
    'utf8'
  );
};

const scaffoldReleaseRuntimeDirectories = (releasePackageRoot: string) => {
  for (const directory of ['data/system', 'data/content', 'data/uploads', 'logs']) {
    fs.mkdirSync(path.join(releasePackageRoot, directory), { recursive: true });
  }
};

const writeReleaseStartScript = (releasePackageRoot: string) => {
  fs.writeFileSync(path.join(releasePackageRoot, 'start.js'), "import { start } from './dist/server/start.js'\n\nstart()\n", 'utf8');
};

const writeReleaseConfig = ({ projectRoot, releasePackageRoot }: { projectRoot: string; releasePackageRoot: string }) => {
  const sourceConfigPath = path.join(projectRoot, 'config', 'nimb.config.json');
  const fallbackConfigPath = path.join(projectRoot, 'nimb.config.json');
  const targetConfigPath = path.join(releasePackageRoot, 'config', 'nimb.config.json');

  const config = fs.existsSync(sourceConfigPath)
    ? JSON.parse(fs.readFileSync(sourceConfigPath, 'utf8'))
    : fs.existsSync(fallbackConfigPath)
      ? JSON.parse(fs.readFileSync(fallbackConfigPath, 'utf8'))
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

  fs.mkdirSync(path.dirname(targetConfigPath), { recursive: true });
  fs.writeFileSync(targetConfigPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
};

const createZipArchive = ({ projectRoot, releaseRoot, zipName }: { projectRoot: string; releaseRoot: string; zipName: string }) => {
  const zipPath = path.join(projectRoot, zipName);
  ensureRemoved(zipPath);

  execFileSync('zip', ['-r', zipPath, RELEASE_PACKAGE_DIRECTORY], {
    cwd: releaseRoot,
    stdio: 'pipe'
  });

  return zipPath;
};

export const runRelease = ({ runtimeRoot, projectRoot = process.cwd() }: { runtimeRoot: string; projectRoot?: string }) => {
  const releaseRoot = path.join(projectRoot, RELEASE_ROOT_DIRECTORY);
  const releasePackageRoot = path.join(releaseRoot, RELEASE_PACKAGE_DIRECTORY);

  ensureRemoved(releaseRoot);
  fs.mkdirSync(releasePackageRoot, { recursive: true });

  const { distRoot } = runBuild({ runtimeRoot, projectRoot });
  copyDirectory(distRoot, path.join(releasePackageRoot, 'dist'));

  writeReleaseConfig({ projectRoot, releasePackageRoot });
  scaffoldReleaseRuntimeDirectories(releasePackageRoot);
  writeReleaseStartScript(releasePackageRoot);
  writeReleaseReadme(releasePackageRoot);

  const zipPath = createZipArchive({ projectRoot, releaseRoot, zipName: RELEASE_ZIP_NAME });

  return Object.freeze({ releaseRoot, releasePackageRoot, zipPath });
};
