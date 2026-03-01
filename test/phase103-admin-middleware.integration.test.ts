import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMiddlewareStack } from '../core/http/run-middleware.ts';
import { createAdminMiddlewareRegistry } from '../core/admin/admin-middleware.ts';
import { createBootstrap } from '../core/bootstrap/index.ts';
import { markInstalled } from '../core/setup/setup-state.ts';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase103-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true, title: 'Acme Admin' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const nimbDir = path.join(cwd, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), `${JSON.stringify({ installed: true, version: '103.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
};

const withInstallState = async (run: () => Promise<void> | void) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

test('phase 103: runMiddlewareStack executes middleware in order and runs handler last', async () => {
  const events: string[] = [];
  const ctx = { req: {}, res: {}, runtime: {}, state: {} };

  await runMiddlewareStack(
    ctx,
    [
      async (_ctx, next) => {
        events.push('m1:before');
        await next();
        events.push('m1:after');
      },
      async (_ctx, next) => {
        events.push('m2:before');
        await next();
        events.push('m2:after');
      }
    ],
    async () => {
      events.push('handler');
    }
  );

  assert.deepEqual(events, ['m1:before', 'm2:before', 'handler', 'm2:after', 'm1:after']);
});

test('phase 103: middleware state mutation flows through chain', async () => {
  const ctx = { req: {}, res: {}, runtime: {}, state: {} as Record<string, unknown> };

  await runMiddlewareStack(
    ctx,
    [
      async (context, next) => {
        context.state.user = 'admin';
        await next();
      },
      async (context, next) => {
        context.state.scope = `${context.state.user}:write`;
        await next();
      }
    ],
    async () => undefined
  );

  assert.equal(ctx.state.user, 'admin');
  assert.equal(ctx.state.scope, 'admin:write');
});

test('phase 103: runMiddlewareStack rejects multiple next calls', async () => {
  const ctx = { req: {}, res: {}, runtime: {}, state: {} };

  await assert.rejects(
    () => runMiddlewareStack(
      ctx,
      [
        async (_context, next) => {
          await next();
          await next();
        }
      ],
      async () => undefined
    ),
    /next\(\) called multiple times/
  );
});

test('phase 103: admin middleware registry tracks middleware in insertion order', () => {
  const registry = createAdminMiddlewareRegistry();
  const first = async (_ctx, next) => next();
  const second = async (_ctx, next) => next();

  registry.use(first);
  registry.use(second);

  assert.deepEqual(registry.list(), [first, second]);
});

test('phase 103: bootstrap registers default middleware and plugins can append middleware', async () => {
  await withInstallState(async () => {
    markInstalled({ version: '103.0.0' });

    const cwd = mkdtemp();
    writeConfig(cwd);
    writeInstallState(cwd);

    const pluginDir = path.join(cwd, 'plugins', 'admin-middleware-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), `${JSON.stringify({
      id: 'admin-middleware-plugin',
      name: 'admin-middleware-plugin',
      version: '1.0.0',
      entry: 'index.ts',
      apiVersion: '^1.0.0',
      capabilities: []
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(pluginDir, 'index.ts'), `
      export default function register(api) {
        api.runtime.events.on('admin.middleware.register', () => {
          api.runtime.admin.middleware.use(async (ctx, next) => {
            ctx.state.plugin = 'attached';
            await next();
          });
        });
      }
    `);

    const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
    const middleware = bootstrap.runtime.admin.middleware.list();

    assert.equal(middleware.length >= 2, true);

    const middlewareContext = {
      req: {},
      res: {},
      runtime: bootstrap.runtime,
      state: {} as Record<string, unknown>
    };

    await runMiddlewareStack(middlewareContext, middleware, async () => undefined);

    assert.equal(middlewareContext.state.admin, true);
    assert.equal(middlewareContext.state.plugin, 'attached');
  });
});
