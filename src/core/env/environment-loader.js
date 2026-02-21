import fs from 'node:fs';
import path from 'node:path';

export class EnvironmentLoader {
  constructor(options = {}) {
    this.envPath = options.envPath ?? path.resolve(process.cwd(), '.env');
  }

  load() {
    if (!fs.existsSync(this.envPath)) {
      return process.env;
    }

    const content = fs.readFileSync(this.envPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    return process.env;
  }
}
