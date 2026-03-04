import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase51-'));

const writeConfig = (cwd, config) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify(config, null, 2)}\n`);
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

test('phase 51: startup from empty project root auto-creates data and persistence directories', async () => {
  const projectRoot = mkdtemp();
  writeConfig(projectRoot, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3220 },
    admin: { enabled: false }
  });

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js', 'start'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  try {
    await waitForReady(child);
    assert.equal(fs.existsSync(path.join(projectRoot, 'data')), true);
    assert.equal(fs.existsSync(path.join(projectRoot, 'data', 'system')), true);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});

test('phase 51: two project roots run sequentially with isolated persistence storage', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });

  writeConfig(firstProjectRoot, {
    name: 'site-a',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3221 },
    admin: { enabled: false }
  });

  writeConfig(secondProjectRoot, {
    name: 'site-b',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3222 },
    admin: { enabled: false }
  });

  const run = async (projectRoot, port) => {
    const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js', '--project-root', projectRoot, 'start'], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) }
    });

    try {
      await waitForReady(child);
    } finally {
      if (child.exitCode === null) {
        await terminate(child);
      }
    }
  };

  await run(firstProjectRoot, 3221);
  await run(secondProjectRoot, 3222);

  assert.equal(fs.existsSync(path.join(firstProjectRoot, 'data', 'system')), true);
  assert.equal(fs.existsSync(path.join(secondProjectRoot, 'data', 'system')), true);
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'data', 'system')), false);
});

test('phase 51: standalone cwd execution remains compatible', async () => {
  const projectRoot = mkdtemp();
  writeConfig(projectRoot, {
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port: 3223 },
    admin: { enabled: false }
  });

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  try {
    await waitForReady(child);
    const response = await fetch('http://127.0.0.1:3223/');
    assert.equal(response.status, 200);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
