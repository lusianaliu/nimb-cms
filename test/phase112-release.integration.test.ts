import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const REPO_ROOT = '/workspace/nimb-cms';
const RELEASE_ZIP = 'nimb-v1.zip';
const RELEASE_ROOT = 'dist-release';

const waitForReady = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Released runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
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
    reject(new Error(`Released runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout?.on('data', onStdout);
  child.stderr?.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve) => {
  child.once('exit', () => resolve());
  child.kill('SIGTERM');
});

test('phase 112: release package is generated and bootable', async () => {
  const release = spawnSync('node', ['bin/nimb.js', 'release'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  assert.equal(release.status, 0, release.stderr);

  const zipPath = path.join(REPO_ROOT, RELEASE_ZIP);
  assert.equal(fs.existsSync(zipPath), true, 'expected release zip file');
  assert.equal(fs.existsSync(path.join(REPO_ROOT, RELEASE_ROOT, 'nimb', 'README.md')), true, 'expected generated README');

  const extractedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase112-'));
  const unzip = spawnSync('unzip', ['-q', zipPath, '-d', extractedRoot], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  assert.equal(unzip.status, 0, unzip.stderr);

  const packageRoot = path.join(extractedRoot, 'nimb');
  const configPath = path.join(packageRoot, 'config', 'nimb.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const port = 3231;
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({
      ...config,
      server: {
        ...(config.server ?? {}),
        port
      }
    }, null, 2)}\n`,
    'utf8'
  );

  const child = spawn('node', ['start.js'], {
    cwd: packageRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);
    const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
    assert.equal([200, 302].includes(response.status), true, `unexpected status: ${response.status}`);
    if (response.status === 302) {
      assert.equal(response.headers.get('location'), '/install');
    }
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
