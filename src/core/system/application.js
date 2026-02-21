import { EnvironmentLoader } from '../env/environment-loader.js';
import { ConfigService } from '../config/config-service.js';
import { LoggerService } from '../logger/logger-service.js';
import { DatabaseConnection } from '../database/database-connection.js';
import { MigrationRunner } from '../database/migration-runner.js';
import { BaseRouter } from '../router/base-router.js';

export class Application {
  constructor() {
    this.environmentLoader = new EnvironmentLoader();
    this.configService = new ConfigService();
    this.server = null;
    this.database = null;
  }

  async boot() {
    this.environmentLoader.load();

    const config = this.configService.load();
    const logger = new LoggerService(config.logger.level);

    this.database = new DatabaseConnection(config.database.url, logger);
    await this.database.connect();

    const migrationRunner = new MigrationRunner(config.migrations.path, logger);
    await migrationRunner.run();

    const router = new BaseRouter(logger);
    this.server = router.createServer();

    await new Promise((resolve) => {
      this.server.listen(config.server.port, config.server.host, resolve);
    });

    logger.info('System boot complete', {
      host: config.server.host,
      port: config.server.port,
      env: config.app.env
    });

    return { config, logger };
  }

  async shutdown() {
    if (this.server) {
      await new Promise((resolve, reject) => {
        this.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    if (this.database) {
      await this.database.disconnect();
    }
  }
}
