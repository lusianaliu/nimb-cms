import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPO_ROOT = '/workspace/nimb-cms';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase126-'));

const writeConfig = (cwd: string, port: number) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'Phase 126 Runtime',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'production' },
    admin: { enabled: true, title: 'Nimb Admin' },
    server: { port }
  }, null, 2)}\n`, 'utf8');
};

const waitForOutput = ({ child, matcher, timeoutMs = 20000 }: { child: ReturnType<typeof spawn>; matcher: RegExp; timeoutMs?: number }) =>
  new Promise<string>((resolve, reject) => {
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
        resolve(stdout);
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

test('phase 126: production runtime entry starts server and serves installer/admin routes', async () => {
  const cwd = mkdtemp();
  const port = 3260;
  writeConfig(cwd, port);

  const child = spawn('node', [path.join(REPO_ROOT, 'server.js')], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    const output = await waitForOutput({ child, matcher: /Nimb CMS started/ });
    assert.match(output, /Nimb CMS started/);
    assert.match(output, /Port: 3260/);
    assert.match(output, /Admin: \/admin/);

    const installerGet = await fetch(`http://127.0.0.1:${port}/install`, { redirect: 'manual' });
    assert.equal(installerGet.status, 200);

    const adminBeforeInstall = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal(adminBeforeInstall.status, 302);
    assert.equal(adminBeforeInstall.headers.get('location'), '/install');

    const installerPost = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        adminEmail: 'admin@example.com',
        adminPassword: 'super-secret-password',
        siteName: 'Phase 126 Site'
      }),
      redirect: 'manual'
    });

    assert.equal(installerPost.status, 302);
    assert.equal(installerPost.headers.get('location'), '/admin');

    const adminAfterInstall = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: 'manual' });
    assert.equal([200, 302].includes(adminAfterInstall.status), true);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
