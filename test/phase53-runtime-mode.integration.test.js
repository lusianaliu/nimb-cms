import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createBootstrap } from '../core/bootstrap/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase53-'));

const writeConfig = (cwd, port) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd, version = '1.0.0') => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version, installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const waitForReady = (child) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Nimb runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
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
    reject(new Error(`Nimb runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child) => new Promise((resolve) => {
  child.once('exit', () => resolve(undefined));
  child.kill('SIGTERM');
});

test('phase 53: missing install.json resolves installer mode', async () => {
  const projectRoot = mkdtemp();
  writeConfig(projectRoot, 3230);

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js', 'start'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  try {
    const { stdout } = await waitForReady(child);
    assert.match(stdout, /installed: no/);
    assert.match(stdout, /runtimeMode: installer/);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});

test('phase 53: valid install.json resolves normal mode', async () => {
  const projectRoot = mkdtemp();
  writeConfig(projectRoot, 3231);
  writeInstallState(projectRoot, '2.0.0');

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js', 'start'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  try {
    const { stdout } = await waitForReady(child);
    assert.match(stdout, /installed: yes/);
    assert.match(stdout, /runtimeMode: normal/);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});

test('phase 53: runtime mode resolution is cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3232);
  writeConfig(secondProjectRoot, 3233);
  writeInstallState(firstProjectRoot, '3.0.0');

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  try {
    const bootstrap = await createBootstrap({ cwd: firstProjectRoot });
    assert.equal(bootstrap.runtimeMode, 'normal');
  } finally {
    process.chdir(originalCwd);
  }
});

test('phase 53: standalone startup compatibility is preserved', async () => {
  const projectRoot = mkdtemp();
  writeConfig(projectRoot, 3234);

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  try {
    await waitForReady(child);
    const response = await fetch('http://127.0.0.1:3234/health', { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/install');
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
