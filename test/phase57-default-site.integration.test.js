import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createHttpServer } from '../core/http/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase57-'));

const writeConfig = (cwd, port) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    server: { port },
    admin: { enabled: false }
  }, null, 2)}\n`);
};

const createServer = async (cwd) => {
  const bootstrap = await createBootstrap({ cwd });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    port: 0
  });

  const { port } = await server.start();
  return { server, port };
};

test('phase 57: install creates default site files', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3260);

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(response.status, 200);

    const siteConfigPath = path.join(cwd, 'config', 'site.json');
    const indexPath = path.join(cwd, 'public', 'index.html');
    assert.equal(fs.existsSync(siteConfigPath), true);
    assert.equal(fs.existsSync(indexPath), true);

    const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
    assert.equal(siteConfig.name, 'My Nimb Site');
    assert.equal(typeof siteConfig.createdAt, 'string');

    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.equal(indexContent.includes('<h1>Welcome to Nimb</h1>'), true);
    assert.equal(indexContent.includes('<p>Your site is ready.</p>'), true);
  } finally {
    await server.stop();
  }
});

test('phase 57: restart serves public/index.html at root', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3261);

  const started = await createServer(cwd);

  try {
    const installResponse = await fetch(`http://127.0.0.1:${started.port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(installResponse.status, 200);
  } finally {
    await started.server.stop();
  }

  const restarted = await createServer(cwd);
  try {
    const response = await fetch(`http://127.0.0.1:${restarted.port}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html.includes('Welcome to Nimb'), true);
    assert.equal(html.includes('Your site is ready.'), true);
  } finally {
    await restarted.server.stop();
  }
});

test('phase 57: existing site files are preserved', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd, 3262);

  fs.mkdirSync(path.join(cwd, 'config'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'public'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'config', 'site.json'), '{"name":"Custom"}\n');
  fs.writeFileSync(path.join(cwd, 'public', 'index.html'), '<h1>Custom Site</h1>\n');

  const { server, port } = await createServer(cwd);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(response.status, 200);

    assert.equal(fs.readFileSync(path.join(cwd, 'config', 'site.json'), 'utf8'), '{"name":"Custom"}\n');
    assert.equal(fs.readFileSync(path.join(cwd, 'public', 'index.html'), 'utf8'), '<h1>Custom Site</h1>\n');
  } finally {
    await server.stop();
  }
});

test('phase 57: default site bootstrap remains cwd-independent', async () => {
  const workspaceRoot = mkdtemp();
  const firstProjectRoot = path.join(workspaceRoot, 'site-a');
  const secondProjectRoot = path.join(workspaceRoot, 'site-b');
  fs.mkdirSync(firstProjectRoot, { recursive: true });
  fs.mkdirSync(secondProjectRoot, { recursive: true });
  writeConfig(firstProjectRoot, 3263);
  writeConfig(secondProjectRoot, 3264);

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  let server;
  let activePort;

  try {
    const started = await createServer(firstProjectRoot);
    server = started.server;
    activePort = started.port;

    const response = await fetch(`http://127.0.0.1:${activePort}/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(response.status, 200);

    assert.equal(fs.existsSync(path.join(firstProjectRoot, 'config', 'site.json')), true);
    assert.equal(fs.existsSync(path.join(firstProjectRoot, 'public', 'index.html')), true);
    assert.equal(fs.existsSync(path.join(secondProjectRoot, 'config', 'site.json')), false);
    assert.equal(fs.existsSync(path.join(secondProjectRoot, 'public', 'index.html')), false);
  } finally {
    process.chdir(originalCwd);

    if (server) {
      await server.stop();
    }
  }
});
