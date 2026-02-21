export class RoleModel {
  constructor({ id, permissionKeys = [] }) {
    this.id = id;
    this.permissionKeys = new Set(permissionKeys);
  }
}
