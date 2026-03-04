import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createBridgeHandler } from '../core/runtime/bridge/bridge-handler.ts';
import { pathToFileURL } from 'node:url';
import { runBuild } from '../core/cli/build.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase110-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const createMockResponse = () => {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  const bodyParts: Buffer[] = [];

  return {
    writeHead(code: number, values: Record<string, string | number>) {
      statusCode = code;
      for (const [key, value] of Object.entries(values)) {
        headers[key.toLowerCase()] = String(value);
      }
    },
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = String(value);
    },
    end(value?: Buffer | string) {
      if (value !== undefined) {
        bodyParts.push(Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8'));
      }
    },
    snapshot() {
      return {
        statusCode,
        headers,
        body: Buffer.concat(bodyParts).toString('utf8')
      };
    }
  };
};

test('phase 110: bridge handler responds with 200 for installed home route', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  fs.mkdirSync(path.join(cwd, 'public'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'public', 'index.html'), '<h1>Bridge Home</h1>\n', 'utf8');

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });

  const handle = createBridgeHandler(bootstrap.runtime, {
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    rootDirectory: cwd,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  const installResponse = createMockResponse();
  await handle({ method: 'POST', url: '/install', headers: { host: 'localhost:3000' } }, installResponse as never);
  assert.equal(installResponse.snapshot().statusCode, 302);

  const response = createMockResponse();

  await handle({ method: 'GET', url: '/', headers: { host: 'localhost:3000' } }, response as never);

  const snapshot = response.snapshot();
  assert.equal(snapshot.statusCode, 200);
  assert.equal(snapshot.headers['content-type'], 'text/html; charset=utf-8');
  await bootstrap.runtime.dispose?.();
});

test('phase 110: bridge handler preserves install routing before installation', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const handle = createBridgeHandler(bootstrap.runtime, {
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    rootDirectory: cwd,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  const redirectResponse = createMockResponse();
  await handle({ method: 'GET', url: '/', headers: { host: 'localhost:3000' } }, redirectResponse as never);
  assert.equal(redirectResponse.snapshot().statusCode, 302);
  assert.equal(redirectResponse.snapshot().headers.location, '/install');

  const installPageResponse = createMockResponse();
  await handle({ method: 'GET', url: '/install', headers: { host: 'localhost:3000' } }, installPageResponse as never);

  const installSnapshot = installPageResponse.snapshot();
  assert.equal(installSnapshot.statusCode, 200);
  assert.equal(installSnapshot.headers['content-type'], 'text/html; charset=utf-8');

  await bootstrap.runtime.dispose?.();
});


test('phase 110: build output exposes dist/server/bridge.js createBridge entry', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);

  const { distRoot } = runBuild({ runtimeRoot: '/workspace/nimb-cms', projectRoot: cwd });
  const bridgePath = path.join(distRoot, 'server', 'bridge.js');

  assert.equal(fs.existsSync(bridgePath), true);

  const bridgeModule = await import(pathToFileURL(bridgePath).href);
  assert.equal(typeof bridgeModule.createBridge, 'function');

  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    const handler = await bridgeModule.createBridge();
    assert.equal(typeof handler, 'function');
  } finally {
    process.chdir(previousCwd);
  }
});
