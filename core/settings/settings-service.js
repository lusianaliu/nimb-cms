import { SettingsCache } from './settings-cache.js';

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export class SettingsService {
  constructor({ repository, cache = new SettingsCache() }) {
    this.repository = repository;
    this.cache = cache;
  }

  async get(key) {
    if (this.cache.has(key)) {
      return cloneJsonValue(this.cache.get(key));
    }

    const value = await this.repository.get(key);
    if (value !== undefined) {
      this.cache.set(key, value);
    }

    return cloneJsonValue(value);
  }

  async set(key, value) {
    const stored = await this.repository.set(key, value);
    this.cache.set(key, stored);

    return cloneJsonValue(stored);
  }

  async has(key) {
    if (this.cache.has(key)) {
      return true;
    }

    return this.repository.has(key);
  }

  async remove(key) {
    const removed = await this.repository.remove(key);
    if (removed) {
      this.cache.delete(key);
    }

    return removed;
  }

  async getMany(keys) {
    const result = {};
    const missing = [];

    for (const key of keys) {
      if (this.cache.has(key)) {
        result[key] = cloneJsonValue(this.cache.get(key));
      } else {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      const loaded = await this.repository.getMany(missing);
      for (const [key, value] of Object.entries(loaded)) {
        this.cache.set(key, value);
        result[key] = cloneJsonValue(value);
      }
    }

    return result;
  }
}
