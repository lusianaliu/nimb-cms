import { SettingsRepository } from './settings-repository.js';
import { SettingsService } from './settings-service.js';
import { SettingsLoader, DEFAULT_SETTINGS } from './settings-loader.js';

function registerService(container, key, value) {
  if (!container) {
    return;
  }

  if (typeof container.register === 'function') {
    container.register(key, value);
    return;
  }

  if (typeof container.set === 'function') {
    container.set(key, value);
    return;
  }

  container[key] = value;
}

// Boot helper keeps settings setup isolated and reusable in host apps/plugins.
export async function bootstrapSettingsModule({ database, container, defaults = DEFAULT_SETTINGS } = {}) {
  const repository = new SettingsRepository({ database });
  const settings = new SettingsService({ repository });
  const loader = new SettingsLoader({ settingsService: settings, defaults });

  await repository.initialize();
  await loader.loadDefaults();

  registerService(container, 'settingsService', settings);
  registerService(container, 'settings', settings);

  return { repository, settings, loader };
}

export { SettingsRepository, SettingsService, SettingsLoader, DEFAULT_SETTINGS };
