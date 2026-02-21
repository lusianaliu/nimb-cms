import { Application } from './core/system/application.js';

const app = new Application();

try {
  await app.boot();
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}

const shutdown = async () => {
  try {
    await app.shutdown();
  } finally {
    process.exit();
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
