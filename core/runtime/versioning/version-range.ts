import { CapabilityVersion } from './capability-version.ts';

export class VersionRange {
  static parse(input: string) {
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('capability range must be a non-empty string');
    }

    const value = input.trim();
    if (value === '*') {
      return Object.freeze({
        raw: value,
        kind: 'any',
        minimum: null,
        maximumExclusive: null
      });
    }

    if (value.startsWith('^')) {
      const base = CapabilityVersion.parse(value.slice(1));
      return Object.freeze({
        raw: value,
        kind: 'caret',
        minimum: base,
        maximumExclusive: Object.freeze({ major: base.major + 1, minor: 0, patch: 0 })
      });
    }

    const exact = CapabilityVersion.parse(value);
    return Object.freeze({
      raw: value,
      kind: 'exact',
      minimum: exact,
      maximumExclusive: null
    });
  }

  static includes(range, version) {
    if (range.kind === 'any') {
      return true;
    }

    if (range.kind === 'exact') {
      return CapabilityVersion.compare(version, range.minimum) === 0;
    }

    return CapabilityVersion.compare(version, range.minimum) >= 0
      && CapabilityVersion.compare(version, range.maximumExclusive) < 0;
  }
}
