export class PermissionModel {
  constructor({ key, description = '', source = 'core' }) {
    this.key = key;
    this.description = description;
    this.source = source;
  }
}
