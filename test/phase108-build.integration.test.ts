import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { runBuild } from '../core/cli/build.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase108-'));

const waitForReady = (child) => new Promise<void>((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Built runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
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
      resolve();
    }
  };

  const onStderr = (chunk) => {
    stderr += chunk.toString('utf8');
  };

  const onExit = (code) => {
    cleanup();
    reject(new Error(`Built runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child) => new Promise((resolve) => {
  child.once('exit', () => resolve(undefined));
  child.kill('SIGTERM');
});

test('phase 108: nimb build creates dist runtime that serves / with 200', async () => {
  const cwd = mkdtemp();
  const projectName = 'demo-build';
  const projectRoot = path.join(cwd, projectName);

  const initResult = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'init', projectName], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(initResult.status, 0, initResult.stderr);

  fs.writeFileSync(path.join(projectRoot, 'public', 'index.html'), '<h1>Nimb Dist</h1>\n', 'utf8');

  const { distRoot } = runBuild({
    runtimeRoot: '/workspace/nimb-cms',
    projectRoot
  });

  assert.equal(fs.existsSync(distRoot), true);
  assert.equal(fs.existsSync(path.join(distRoot, 'server', 'start.js')), true);
  assert.equal(fs.existsSync(path.join(distRoot, 'server', 'bootstrap.js')), true);
  assert.equal(fs.existsSync(path.join(distRoot, 'public', 'admin')), true);
  assert.equal(fs.existsSync(path.join(distRoot, 'manifest.json')), true);

  const child = spawn('node', ['dist/server/start.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3318' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);

    const response = await fetch('http://127.0.0.1:3318/');
    assert.equal(response.status, 200);
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
