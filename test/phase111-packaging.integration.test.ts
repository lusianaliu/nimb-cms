import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const REPO_ROOT = '/workspace/nimb-cms';

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

const waitForReady = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Packaged runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
  }, 20000);

  const cleanup = () => {
    clearTimeout(timeout);
    child.stdout?.off('data', onStdout);
    child.stderr?.off('data', onStderr);
    child.off('exit', onExit);
  };

  const onStdout = (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
    if (stdout.includes('Ready.')) {
      cleanup();
      resolve();
    }
  };

  const onStderr = (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  };

  const onExit = (code: number | null) => {
    cleanup();
    reject(new Error(`Packaged runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout?.on('data', onStdout);
  child.stderr?.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve) => {
  child.once('exit', () => resolve());
  child.kill('SIGTERM');
});

test('phase 111: packaged runtime boots from installable layout', async () => {
  const build = spawnSync('node', ['bin/nimb.js', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  assert.equal(build.status, 0, build.stderr);

  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase111-'));
  copyDirectory(path.join(REPO_ROOT, 'dist'), path.join(packageRoot, 'dist'));
  fs.copyFileSync(path.join(REPO_ROOT, 'start.js'), path.join(packageRoot, 'start.js'));

  fs.mkdirSync(path.join(packageRoot, 'config'), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase111-site',
    runtime: { mode: 'production' },
    server: { port: 3220 },
    admin: { enabled: true, basePath: '/admin', staticDir: '../public/admin' }
  }, null, 2)}\n`);

  const child = spawn('node', ['start.js'], {
    cwd: packageRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);
    const response = await fetch('http://127.0.0.1:3220/');
    assert.equal(response.status, 200);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
