export class SettingsCache {
  constructor() {
    this.values = new Map();
  }

  has(key) {
    return this.values.has(key);
  }

  get(key) {
    return this.values.get(key);
  }

  set(key, value) {
    this.values.set(key, value);
  }

  delete(key) {
    this.values.delete(key);
  }
}
