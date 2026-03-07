import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const REPO_ROOT = '/workspace/nimb-cms';

const waitForOutput = ({ child, matcher, timeoutMs = 20000 }: { child: ReturnType<typeof spawn>; matcher: RegExp; timeoutMs?: number }) =>
  new Promise<void>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
      child.off('exit', onExit);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Process timed out waiting for output. stdout=${stdout} stderr=${stderr}`));
    }, timeoutMs);

    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (matcher.test(stdout)) {
        cleanup();
        resolve();
      }
    };

    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Process exited before expected output with code ${code}. stdout=${stdout} stderr=${stderr}`));
    };

    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
    child.on('exit', onExit);
  });

const terminate = (child: ReturnType<typeof spawn>) =>
  new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });

test('phase 125: release build generates distributable package and preserves installer flow', async () => {
  const buildResult = spawnSync('node', ['scripts/build-release.ts'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.equal(buildResult.status, 0, buildResult.stderr);

  const releaseRoot = path.join(REPO_ROOT, 'release');
  const zipPath = path.join(REPO_ROOT, 'dist', 'nimb-release.zip');

  assert.equal(fs.existsSync(releaseRoot), true, 'release directory should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'core')), true, 'release/core should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'public')), true, 'release/public should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'themes', 'default')), true, 'release/themes/default should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'data')), true, 'release/data should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'package.json')), true, 'release/package.json should exist');
  assert.equal(fs.existsSync(path.join(releaseRoot, 'server.js')), true, 'release/server.js should exist');
  assert.equal(fs.existsSync(zipPath), true, 'release zip should exist');

  const extractedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase125-'));
  const unzipResult = spawnSync('unzip', ['-q', zipPath, '-d', extractedRoot], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.equal(unzipResult.status, 0, unzipResult.stderr);

  const releaseExtractedRoot = extractedRoot;

  assert.equal(fs.existsSync(path.join(releaseExtractedRoot, 'core')), true, 'zip should contain core');
  assert.equal(fs.existsSync(path.join(releaseExtractedRoot, 'public')), true, 'zip should contain public');
  assert.equal(fs.existsSync(path.join(releaseExtractedRoot, 'themes', 'default')), true, 'zip should contain themes/default');
  assert.equal(fs.existsSync(path.join(releaseExtractedRoot, 'data', 'settings.json')), true, 'zip should contain data/settings.json');

  const configDirectory = path.join(releaseExtractedRoot, 'config');
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(configDirectory, 'nimb.config.json'),
    `${JSON.stringify({
      name: 'Phase 125 Release',
      plugins: [],
      runtime: { logLevel: 'info', mode: 'production' },
      admin: { enabled: true, title: 'Nimb Admin' },
      server: { port: 3250 }
    }, null, 2)}\n`,
    'utf8'
  );

  const child = spawn('node', ['server.js'], {
    cwd: releaseExtractedRoot,
    env: { ...process.env, PORT: '3250' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForOutput({ child, matcher: /Ready\./ });

    const rootResponse = await fetch('http://127.0.0.1:3250/', { redirect: 'manual' });
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/install');

    const installResponse = await fetch('http://127.0.0.1:3250/install', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        adminEmail: 'admin@example.com',
        adminPassword: 'super-secret-password',
        siteName: 'Phase 125 Site'
      }),
      redirect: 'manual'
    });

    assert.equal(installResponse.status, 302);
    assert.equal(installResponse.headers.get('location'), '/admin');

    const adminResponse = await fetch('http://127.0.0.1:3250/admin', { redirect: 'manual' });
    assert.equal([200, 302].includes(adminResponse.status), true);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
