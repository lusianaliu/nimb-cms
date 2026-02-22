import crypto from 'node:crypto';

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
};

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

export class BootstrapSnapshot {
  static empty() {
    return deepFreeze({
      configHash: '',
      startupTimestamp: '',
      runtimeStatus: 'idle',
      loadedPlugins: Object.freeze([]),
      diagnostics: Object.freeze([])
    });
  }

  static create({ config, startupTimestamp, runtimeStatus, loadedPlugins, diagnostics }) {
    const configHash = crypto.createHash('sha256').update(stableStringify(config)).digest('hex');

    return deepFreeze({
      configHash,
      startupTimestamp: String(startupTimestamp ?? ''),
      runtimeStatus: String(runtimeStatus ?? 'unknown'),
      loadedPlugins: [...(loadedPlugins ?? [])].map((pluginId) => String(pluginId)).sort((a, b) => a.localeCompare(b)),
      diagnostics: [...(diagnostics ?? [])].map((item) => Object.freeze({ ...item }))
    });
  }
}
