import { createTestServer } from './create-test-server.ts';
import { ensureInstalled } from './install-state.ts';

type CreateInstalledServerOptions = {
  cwd: string,
  startupTimestamp?: string,
  clock?: () => string
};

export async function createInstalledServer(options: CreateInstalledServerOptions) {
  const { runtime, server, bootstrap, config } = await createTestServer(options);

  await ensureInstalled(runtime);
  const { port } = await server.start();

  return { runtime, server, bootstrap, config, port };
}
