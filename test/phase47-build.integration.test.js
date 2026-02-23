import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase47-'));

const waitForReady = (child) => new Promise((resolve, reject) => {
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
      resolve({ stdout, stderr });
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

test('phase 47: nimb build produces deployable output that serves /health', async () => {
  const cwd = mkdtemp();
  const projectName = 'demo-build';
  const projectRoot = path.join(cwd, projectName);

  const initResult = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'init', projectName], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(initResult.status, 0, initResult.stderr);

  const buildResult = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(buildResult.status, 0, buildResult.stderr);

  const buildRoot = path.join(projectRoot, '.nimb-build');
  assert.equal(fs.existsSync(buildRoot), true);

  const requiredBuildEntries = ['bin', 'core', 'ui', 'package.json', 'nimb.config.json'];
  for (const entry of requiredBuildEntries) {
    assert.equal(fs.existsSync(path.join(buildRoot, entry)), true, `Expected build entry: ${entry}`);
  }

  const child = spawn('node', ['bin/nimb.js'], {
    cwd: buildRoot,
    env: { ...process.env, PORT: '3212' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);

    const response = await fetch('http://127.0.0.1:3212/health');
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
