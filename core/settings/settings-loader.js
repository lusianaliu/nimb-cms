const DEFAULT_SETTINGS = Object.freeze({
  homepage_mode: 'posts',
  posts_slug: 'blog',
  site_name: 'Nimb'
});

export class SettingsLoader {
  constructor({ settingsService, defaults = DEFAULT_SETTINGS }) {
    this.settingsService = settingsService;
    this.defaults = defaults;
  }

  async loadDefaults() {
    for (const [key, value] of Object.entries(this.defaults)) {
      const exists = await this.settingsService.has(key);
      if (!exists) {
        await this.settingsService.set(key, value);
      }
    }
  }
}

export { DEFAULT_SETTINGS };
