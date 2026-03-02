import { createBootstrap } from '../../core/bootstrap/index.ts';
import { createHttpServer } from '../../core/http/index.ts';

type CreateTestServerOptions = {
  cwd: string,
  startupTimestamp?: string,
  clock?: () => string
};

export async function createTestServer({ cwd, startupTimestamp = '2026-01-01T00:00:00.000Z', clock }: CreateTestServerOptions) {
  const bootstrap = await createBootstrap({ cwd, mode: 'runtime' });
  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    port: 0,
    rootDirectory: cwd,
    ...(clock ? { clock } : {})
  });

  return {
    bootstrap,
    config: bootstrap.config,
    runtime: bootstrap.runtime,
    server
  };
}
