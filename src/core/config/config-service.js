import fs from 'node:fs';
import path from 'node:path';

export class ConfigService {
  constructor(options = {}) {
    this.configDir = options.configDir ?? path.resolve(process.cwd(), 'config');
    this.fileName = options.fileName ?? 'default.json';
    this.cache = null;
  }

  load() {
    const configPath = path.join(this.configDir, this.fileName);
    const content = fs.readFileSync(configPath, 'utf-8');
    const baseConfig = JSON.parse(content);
    this.cache = this.applyEnvOverrides(baseConfig);
    return this.cache;
  }

  get(pathExpression, fallback = undefined) {
    if (!this.cache) {
      this.load();
    }

    const keys = pathExpression.split('.');
    let cursor = this.cache;

    for (const key of keys) {
      if (cursor == null || !(key in cursor)) {
        return fallback;
      }
      cursor = cursor[key];
    }

    return cursor;
  }

  applyEnvOverrides(config) {
    const merged = structuredClone(config);

    if (process.env.APP_ENV) {
      merged.app.env = process.env.APP_ENV;
    }

    if (process.env.PORT) {
      merged.server.port = Number(process.env.PORT);
    }

    if (process.env.HOST) {
      merged.server.host = process.env.HOST;
    }

    if (process.env.DATABASE_URL) {
      merged.database.url = process.env.DATABASE_URL;
    }

    if (process.env.LOG_LEVEL) {
      merged.logger.level = process.env.LOG_LEVEL;
    }

    return merged;
  }
}
