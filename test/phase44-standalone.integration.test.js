import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase44-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
};

const waitForReady = (child) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Standalone runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
  }, 20000);

  const cleanup = () => {
    clearTimeout(timeout);
    child.stdout.off('data', onStdout);
    child.stderr.off('data', onStderr);
    child.off('exit', onExit);
  };

  const onStdout = (chunk) => {
    stdout += chunk.toString('utf8');
    if (stdout.includes('Ready.')) {
      cleanup();
      resolve({ stdout, stderr });
    }
  };

  const onStderr = (chunk) => {
    stderr += chunk.toString('utf8');
  };

  const onExit = (code) => {
    cleanup();
    reject(new Error(`Standalone runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child) => new Promise((resolve) => {
  child.once('exit', () => resolve(undefined));
  child.kill('SIGTERM');
});

test('phase 44: standalone runtime boots and exposes /health', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3210 },
    admin: { basePath: '/admin', staticDir: '/workspace/nimb-cms/ui/admin' }
  });

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js'], {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);

    const response = await fetch('http://127.0.0.1:3210/health');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.runtime, 'active');
    assert.equal(typeof body.version, 'string');
    assert.equal(['development', 'production'].includes(body.mode), true);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});

test('phase 44: standalone runtime can boot from outside project root using --project-root', async () => {
  const workspaceRoot = mkdtemp();
  const projectRoot = path.join(workspaceRoot, 'site');
  const invocationRoot = path.join(workspaceRoot, 'runner');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(invocationRoot, { recursive: true });

  writeConfig(projectRoot, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3213 },
    admin: { basePath: '/admin', staticDir: '/workspace/nimb-cms/ui/admin' }
  });

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js', '--project-root', projectRoot], {
    cwd: invocationRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);

    const response = await fetch('http://127.0.0.1:3213/health');
    assert.equal(response.status, 200);
    assert.equal(fs.existsSync(path.join(projectRoot, '.nimb', 'runtime.json')), true);
    assert.equal(fs.existsSync(path.join(invocationRoot, '.nimb', 'runtime.json')), false);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
