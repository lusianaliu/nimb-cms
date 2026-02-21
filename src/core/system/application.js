import { EnvironmentLoader } from '../env/environment-loader.js';
import { ConfigService } from '../config/config-service.js';
import { SecurityConfigService } from '../config/security-config-service.js';
import { LoggerService } from '../logger/logger-service.js';
import { DatabaseConnection } from '../database/database-connection.js';
import { MigrationRunner } from '../database/migration-runner.js';
import { BaseRouter } from '../router/base-router.js';
import { AuthService } from '../auth/auth-service.js';
import { SessionStore } from '../auth/session-store.js';
import { HttpAuthRouter } from '../auth/http-auth-router.js';
import { PermissionRegistry } from '../authorization/permission-registry.js';
import { RoleManagementService } from '../authorization/role-management-service.js';
import { CapabilityCheckMiddleware } from '../authorization/middleware/capability-check-middleware.js';

export class Application {
  constructor() {
    this.environmentLoader = new EnvironmentLoader();
    this.configService = new ConfigService();
    this.securityConfigService = new SecurityConfigService();
    this.server = null;
    this.database = null;
  }

  async boot() {
    this.environmentLoader.load();

    const config = this.configService.load();
    const securityConfig = this.securityConfigService.load();
    const logger = new LoggerService(config.logger.level);

    this.database = new DatabaseConnection(config.database.url, logger);
    await this.database.connect();

    const migrationRunner = new MigrationRunner(config.migrations.path, logger);
    await migrationRunner.run();

    const permissionRegistry = new PermissionRegistry();
    permissionRegistry.register({
      key: 'nimb.admin.panel.read',
      description: 'Allows reading the admin panel endpoint',
      source: 'core.system'
    });

    const roleManagementService = new RoleManagementService({ permissionRegistry });
    roleManagementService.createRole({
      id: securityConfig.adminBootstrapRoleId,
      permissionKeys: ['nimb.admin.panel.read']
    });

    const authorizationMiddleware = new CapabilityCheckMiddleware({
      logger,
      permissionRegistry,
      roleManagementService
    });

    const authRouter = new HttpAuthRouter({
      logger,
      securityConfig,
      userAuthService: new AuthService(),
      adminAuthService: new AuthService(),
      userSessions: new SessionStore(),
      adminSessions: new SessionStore(),
      roleManagementService,
      authorizationMiddleware
    });

    const router = new BaseRouter({ logger, authRouter });
    this.server = router.createServer();

    await new Promise((resolve) => {
      this.server.listen(config.server.port, config.server.host, resolve);
    });

    logger.info('System boot complete', {
      host: config.server.host,
      port: config.server.port,
      env: config.app.env,
      adminPath: securityConfig.adminPath,
      adminLoginPath: securityConfig.adminLoginPath
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
