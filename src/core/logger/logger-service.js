const LEVELS = ['debug', 'info', 'warn', 'error'];

export class LoggerService {
  constructor(level = 'info') {
    this.level = LEVELS.includes(level) ? level : 'info';
  }

  log(level, message, context = {}) {
    if (LEVELS.indexOf(level) < LEVELS.indexOf(this.level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };

    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  debug(message, context) { this.log('debug', message, context); }
  info(message, context) { this.log('info', message, context); }
  warn(message, context) { this.log('warn', message, context); }
  error(message, context) { this.log('error', message, context); }
}
