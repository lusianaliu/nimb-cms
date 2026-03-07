import { createBootstrap } from './core/bootstrap/bootstrap.ts';
import { createHttpServer } from './core/http/http-server.ts';

const resolvePort = () => {
  const raw = process.env.PORT;

  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      throw new Error(`Invalid PORT value: ${raw}`);
    }

    return parsed;
  }

  return 3000;
};

const startProductionServer = async () => {
  process.env.NODE_ENV = 'production';

  const startupTimestamp = new Date().toISOString();
  const projectRoot = process.cwd();
  const port = resolvePort();
  const bootstrap = await createBootstrap({ cwd: projectRoot, startupTimestamp });

  const server = createHttpServer({
    runtime: bootstrap.runtime,
    config: bootstrap.config,
    startupTimestamp,
    rootDirectory: projectRoot,
    port,
    authService: bootstrap.authService,
    authMiddleware: bootstrap.authMiddleware,
    adminController: bootstrap.adminController,
    contentRegistry: bootstrap.contentRegistry,
    persistContentTypes: bootstrap.persistContentTypes,
    entryRegistry: bootstrap.entryRegistry,
    persistEntries: bootstrap.persistEntries
  });

  await server.start();

  process.stdout.write('Nimb CMS started\n');
  process.stdout.write(`Port: ${port}\n`);
  process.stdout.write('Admin: /admin\n');
};

startProductionServer().catch((error) => {
  process.stderr.write(`Nimb CMS startup failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
