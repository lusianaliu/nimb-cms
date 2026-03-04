import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { createRuntimeAdapter } from '../core/runtime/adapters/index.ts';
import { createEmbeddedAdapter } from '../core/runtime/adapters/embedded-adapter.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase109-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const createMockRequest = ({ method = 'GET', url = '/' } = {}) => {
  const chunks: Buffer[] = [];
  return {
    method,
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }
  };
};

const createMockResponse = () => {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  const parts: Buffer[] = [];

  return {
    writeHead(code: number, values: Record<string, string | number>) {
      statusCode = code;
      for (const [key, value] of Object.entries(values)) {
        headers[String(key).toLowerCase()] = String(value);
      }
    },
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = String(value);
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    end(value?: Buffer | string) {
      if (value !== undefined) {
        parts.push(Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8'));
      }
    },
    snapshot() {
      return {
        statusCode,
        headers,
        body: Buffer.concat(parts).toString('utf8')
      };
    }
  };
};

test('phase 109: node adapter starts and serves root route', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const adapter = createRuntimeAdapter({
    type: 'node',
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    rootDirectory: cwd,
    port: 0,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  await adapter.start();
  try {
    const activePort = adapter.getPort();
    assert.equal(typeof activePort, 'number');
    const response = await fetch(`http://127.0.0.1:${activePort}/`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/install');
  } finally {
    await adapter.stop();
  }
});

test('phase 109: embedded adapter exposes handler and processes mock request', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const adapter = createEmbeddedAdapter({
    runtime: bootstrap.runtime,
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

  await adapter.start();
  try {
    assert.equal(typeof adapter.handler, 'function');
    const request = createMockRequest({ method: 'GET', url: '/install' });
    const response = createMockResponse();

    await adapter.handler(request as never, response as never);

    const snapshot = response.snapshot();
    assert.equal(snapshot.statusCode, 200);
    assert.equal(snapshot.headers['content-type'], 'text/html; charset=utf-8');
  } finally {
    await adapter.stop();
    await bootstrap.runtime.dispose?.();
  }
});

test('phase 109: install flow remains intact with node adapter', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const adapter = createRuntimeAdapter({
    type: 'node',
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp: '2026-01-01T00:00:00.000Z',
    rootDirectory: cwd,
    port: 0,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  await adapter.start();
  try {
    const activePort = adapter.getPort();
    const installPage = await fetch(`http://127.0.0.1:${activePort}/install`, { redirect: 'manual' });
    assert.equal(installPage.status, 200);

    const installAction = await fetch(`http://127.0.0.1:${activePort}/install`, { method: 'POST', redirect: 'manual' });
    assert.equal(installAction.status, 302);
    assert.equal(installAction.headers.get('location'), '/admin/login');
  } finally {
    await adapter.stop();
  }
});
