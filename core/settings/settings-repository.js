const IN_MEMORY_TABLES_KEY = '__nimbInMemoryTables';

const SETTINGS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
`;

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function ensureInMemoryTable(database, tableName) {
  if (!database[IN_MEMORY_TABLES_KEY]) {
    database[IN_MEMORY_TABLES_KEY] = new Map();
  }

  if (!database[IN_MEMORY_TABLES_KEY].has(tableName)) {
    database[IN_MEMORY_TABLES_KEY].set(tableName, { rows: new Map(), nextId: 1 });
  }

  return database[IN_MEMORY_TABLES_KEY].get(tableName);
}

export class SettingsRepository {
  constructor({ database, tableName = 'settings' }) {
    this.database = database ?? {};
    this.tableName = tableName;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.database && typeof this.database.execute === 'function') {
      await this.database.execute(SETTINGS_TABLE_SCHEMA);
    }

    ensureInMemoryTable(this.database, this.tableName);
    this.initialized = true;
  }

  async get(key) {
    await this.initialize();
    const table = ensureInMemoryTable(this.database, this.tableName);
    const row = table.rows.get(key);

    return row ? cloneJsonValue(row.value) : undefined;
  }

  async has(key) {
    await this.initialize();
    const table = ensureInMemoryTable(this.database, this.tableName);

    return table.rows.has(key);
  }

  async set(key, value) {
    await this.initialize();
    const table = ensureInMemoryTable(this.database, this.tableName);
    const now = new Date().toISOString();
    const existing = table.rows.get(key);

    const row = {
      id: existing ? existing.id : table.nextId++,
      key,
      value: cloneJsonValue(value),
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };

    table.rows.set(key, row);

    return cloneJsonValue(row.value);
  }

  async remove(key) {
    await this.initialize();
    const table = ensureInMemoryTable(this.database, this.tableName);

    return table.rows.delete(key);
  }

  async getMany(keys) {
    await this.initialize();
    const table = ensureInMemoryTable(this.database, this.tableName);

    return keys.reduce((result, key) => {
      const row = table.rows.get(key);
      if (row) {
        result[key] = cloneJsonValue(row.value);
      }
      return result;
    }, {});
  }
}

export { SETTINGS_TABLE_SCHEMA };
