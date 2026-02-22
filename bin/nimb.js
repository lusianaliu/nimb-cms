#!/usr/bin/env node
import { createBootstrap } from '../core/bootstrap/index.ts';

try {
  const { config, snapshot } = await createBootstrap();
  process.stdout.write('Nimb Runtime Started\n');
  process.stdout.write(`status: ${snapshot.runtimeStatus}\n`);
  process.stdout.write(`plugins: ${snapshot.loadedPlugins.length}\n`);
  process.stdout.write(`mode: ${config.runtime.mode}\n`);
} catch (error) {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
}
