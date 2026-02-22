const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export class CapabilityVersion {
  static parse(input: string) {
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('capability version must be a non-empty string');
    }

    const normalized = input.trim();
    const match = VERSION_PATTERN.exec(normalized);
    if (!match) {
      throw new Error(`invalid capability version: ${input}`);
    }

    return Object.freeze({
      raw: normalized,
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3])
    });
  }

  static compare(left, right) {
    if (left.major !== right.major) {
      return left.major - right.major;
    }

    if (left.minor !== right.minor) {
      return left.minor - right.minor;
    }

    return left.patch - right.patch;
  }
}
