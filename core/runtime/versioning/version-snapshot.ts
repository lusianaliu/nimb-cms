const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export class VersionSnapshot {
  static from({ resolutions, warnings, rejectedPlugins }) {
    return Object.freeze({
      resolvedVersions: freezeEntries(resolutions),
      compatibilityWarnings: freezeEntries(warnings),
      rejectedPlugins: Object.freeze([...rejectedPlugins])
    });
  }
}
