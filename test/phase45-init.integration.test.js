import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase45-'));

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

test('phase 45: nimb init scaffolds a runnable project', async () => {
  const cwd = mkdtemp();
  const projectName = 'demo-site';
  const projectRoot = path.join(cwd, projectName);

  const initResult = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'init', projectName], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(initResult.status, 0, initResult.stderr);
  assert.ok(initResult.stdout.includes('Project created.'));

  assert.equal(fs.existsSync(projectRoot), true);

  const expectedDirectories = ['content', 'data', 'plugins', 'public'];
  for (const directory of expectedDirectories) {
    const directoryPath = path.join(projectRoot, directory);
    assert.equal(fs.existsSync(directoryPath), true, `Expected ${directory} to exist`);
    assert.equal(fs.statSync(directoryPath).isDirectory(), true, `Expected ${directory} to be a directory`);
  }

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'nimb.config.json'), 'utf8'));
  assert.deepEqual(config, {
    server: {
      port: 3000
    },
    admin: {
      enabled: true,
      basePath: '/admin'
    }
  });

  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.deepEqual(packageJson, {
    name: projectName,
    private: true,
    dependencies: {
      nimb: 'latest'
    },
    scripts: {
      start: 'nimb'
    }
  });

  const readmeContent = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.ok(readmeContent.includes('Generated with `nimb init`.'));

  const child = spawn('node', ['/workspace/nimb-cms/bin/nimb.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3211' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForReady(child);

    const response = await fetch('http://127.0.0.1:3211/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', runtime: 'active' });
  } finally {
    if (child.exitCode === null) {
      await terminate(child);
    }
  }
});
