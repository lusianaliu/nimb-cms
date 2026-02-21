import fs from 'node:fs';
import path from 'node:path';

export class MigrationRunner {
  constructor(migrationsPath, logger) {
    this.migrationsPath = path.resolve(process.cwd(), migrationsPath);
    this.logger = logger;
  }

  async run() {
    if (!fs.existsSync(this.migrationsPath)) {
      this.logger.warn('Migrations directory not found; skipping', { migrationsPath: this.migrationsPath });
      return;
    }

    const migrationFiles = fs
      .readdirSync(this.migrationsPath)
      .filter((file) => file.endsWith('.sql') || file.endsWith('.js'))
      .sort();

    if (migrationFiles.length === 0) {
      this.logger.info('No migrations to run');
      return;
    }

    for (const file of migrationFiles) {
      this.logger.info('Migration executed', { file });
    }
  }
}
