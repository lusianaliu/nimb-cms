import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase48-'));

const waitForReady = (child) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Deploy runtime did not become ready in time. stdout=${stdout} stderr=${stderr}`));
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
    reject(new Error(`Deploy runtime exited before ready with code ${code}. stdout=${stdout} stderr=${stderr}`));
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  child.on('exit', onExit);
});

const terminate = (child) => new Promise((resolve) => {
  child.once('exit', () => resolve(undefined));
  child.kill('SIGTERM');
});

const postJson = async (url, body, headers = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  return { status: response.status, body: await response.json() };
};

const getJson = async (url) => {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
};

test('phase 48: deploy lifecycle remains deterministic across build and restart', async () => {
  const cwd = mkdtemp();
  const projectName = 'demo';
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
  const env = { ...process.env, PORT: '3216' };

  const first = spawn('node', ['bin/nimb.js'], { cwd: buildRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });

  let createdId = '';
  try {
    await waitForReady(first);

    const health = await getJson('http://127.0.0.1:3216/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.runtime, 'active');
    assert.equal(typeof health.body.version, 'string');
    assert.equal(['development', 'production'].includes(health.body.mode), true);

    const adminResponse = await fetch('http://127.0.0.1:3216/admin');
    assert.equal(adminResponse.status, 200);

    const login = await postJson('http://127.0.0.1:3216/api/auth/login', { username: 'admin', password: 'admin' });
    assert.equal(login.status, 200);
    const token = login.body.data.session.token;
    const headers = { authorization: `Bearer ${token}` };

    const schemaCreated = await postJson('http://127.0.0.1:3216/api/admin/content-types', {
      name: 'article',
      fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'body', type: 'text', required: true }
      ]
    }, headers);
    assert.equal(schemaCreated.status, 200);

    const created = await postJson('http://127.0.0.1:3216/api/admin/entries/article', {
      title: 'Persisted from deploy build',
      body: 'restart-safe'
    }, headers);
    assert.equal(created.status, 200);
    createdId = created.body.data.entry.id;
  } finally {
    if (first.exitCode === null) {
      await terminate(first);
    }
  }

  const second = spawn('node', ['bin/nimb.js'], { cwd: buildRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    await waitForReady(second);
    const restored = await getJson('http://127.0.0.1:3216/api/entries/article');
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.entries.some((entry) => entry.id === createdId), true);
  } finally {
    if (second.exitCode === null) {
      await terminate(second);
    }
  }
});
