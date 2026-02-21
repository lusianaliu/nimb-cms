import { RoleModel } from './models/role-model.js';

export class RoleManagementService {
  constructor({ permissionRegistry }) {
    this.permissionRegistry = permissionRegistry;
    this.roles = new Map();
    this.subjectRoles = new Map();
  }

  createRole({ id, permissionKeys = [] }) {
    if (!id) {
      throw new Error('Role id is required');
    }

    this.validatePermissionKeys(permissionKeys);

    const role = new RoleModel({ id, permissionKeys });
    this.roles.set(id, role);
    return role;
  }

  grantPermission(roleId, permissionKey) {
    const role = this.getRoleOrThrow(roleId);
    this.validatePermissionKeys([permissionKey]);
    role.permissionKeys.add(permissionKey);
    return role;
  }

  revokePermission(roleId, permissionKey) {
    const role = this.getRoleOrThrow(roleId);
    role.permissionKeys.delete(permissionKey);
    return role;
  }

  assignRole(subjectId, roleId) {
    if (!subjectId) {
      throw new Error('Subject id is required');
    }

    this.getRoleOrThrow(roleId);

    if (!this.subjectRoles.has(subjectId)) {
      this.subjectRoles.set(subjectId, new Set());
    }

    this.subjectRoles.get(subjectId).add(roleId);
  }

  subjectHasPermission(subjectId, permissionKey) {
    if (!subjectId || !this.permissionRegistry.has(permissionKey)) {
      return false;
    }

    const roleIds = this.subjectRoles.get(subjectId);
    if (!roleIds || roleIds.size === 0) {
      return false;
    }

    return Array.from(roleIds).some((roleId) => {
      const role = this.roles.get(roleId);
      return role ? role.permissionKeys.has(permissionKey) : false;
    });
  }

  listRoles() {
    return Array.from(this.roles.values()).map((role) => ({
      id: role.id,
      permissionKeys: Array.from(role.permissionKeys)
    }));
  }

  getRoleOrThrow(roleId) {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Unknown role: ${roleId}`);
    }

    return role;
  }

  validatePermissionKeys(permissionKeys) {
    permissionKeys.forEach((permissionKey) => {
      if (!this.permissionRegistry.has(permissionKey)) {
        throw new Error(`Unknown permission: ${permissionKey}`);
      }
    });
  }
}
