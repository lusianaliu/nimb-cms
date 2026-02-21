import fs from 'node:fs';
import path from 'node:path';

const ROUTE_SEGMENT_PATTERN = /^[a-z0-9-]+$/i;
const ROLE_IDENTIFIER_PATTERN = /^[a-z0-9._:-]+$/i;

export class SecurityConfigService {
  constructor(options = {}) {
    this.configDir = options.configDir ?? path.resolve(process.cwd(), 'config');
    this.fileName = options.fileName ?? 'security.config.ts';
    this.cache = null;
  }

  load() {
    const configPath = path.join(this.configDir, this.fileName);
    const content = fs.readFileSync(configPath, 'utf-8');

    const adminPath = this.extractStringProperty(content, 'adminPath');
    const adminLoginPath = this.extractStringProperty(content, 'adminLoginPath');
    const adminBootstrapRoleId = this.extractStringProperty(content, 'adminBootstrapRoleId');

    this.cache = {
      adminPath: this.validateSegment(adminPath, 'adminPath'),
      adminLoginPath: this.validateSegment(adminLoginPath, 'adminLoginPath'),
      adminBootstrapRoleId: this.validateRoleId(adminBootstrapRoleId, 'adminBootstrapRoleId')
    };

    return this.cache;
  }

  extractStringProperty(content, propertyName) {
    const pattern = new RegExp(`${propertyName}\\s*:\\s*['\"]([^'\"]+)['\"]`);
    const match = content.match(pattern);

    if (!match) {
      throw new Error(`Missing security config value: ${propertyName}`);
    }

    return match[1];
  }

  validateSegment(value, name) {
    if (!ROUTE_SEGMENT_PATTERN.test(value)) {
      throw new Error(`Invalid route segment for ${name}: ${value}`);
    }

    return value;
  }

  validateRoleId(value, name) {
    if (!ROLE_IDENTIFIER_PATTERN.test(value)) {
      throw new Error(`Invalid role id for ${name}: ${value}`);
    }

    return value;
  }
}
