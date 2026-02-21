export class DatabaseConnection {
  constructor(databaseUrl, logger) {
    this.databaseUrl = databaseUrl;
    this.logger = logger;
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.logger.info('Database connection established', { databaseUrl: this.databaseUrl });
  }

  async disconnect() {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.logger.info('Database connection closed');
  }
}
