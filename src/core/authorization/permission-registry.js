import { PermissionModel } from './models/permission-model.js';

export class PermissionRegistry {
  constructor() {
    this.permissions = new Map();
  }

  register(input) {
    const permission = input instanceof PermissionModel ? input : new PermissionModel(input);

    if (!permission.key) {
      throw new Error('Permission key is required');
    }

    this.permissions.set(permission.key, permission);
    return permission;
  }

  registerMany(inputs) {
    return inputs.map((input) => this.register(input));
  }

  has(permissionKey) {
    return this.permissions.has(permissionKey);
  }

  get(permissionKey) {
    return this.permissions.get(permissionKey) ?? null;
  }

  list() {
    return Array.from(this.permissions.values());
  }
}
