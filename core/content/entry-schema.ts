import { createHash } from 'node:crypto';

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort((left, right) => left.localeCompare(right)).reduce((accumulator, key) => {
      accumulator[key] = canonicalize(value[key]);
      return accumulator;
    }, {});
  }

  return value;
};

const toDeterministicUuid = (hex) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;

export const canonicalizeEntryData = (value) => canonicalize(value ?? {});

export const stableEntryId = ({ type, data }) => {
  const payload = JSON.stringify({ type: String(type ?? '').trim(), data: canonicalizeEntryData(data) });
  const digest = createHash('sha256').update(payload).digest('hex');
  return toDeterministicUuid(digest);
};

export const createEntry = ({ type, data, createdAt, updatedAt }) => {
  const normalizedType = String(type ?? '').trim();
  const normalizedData = canonicalizeEntryData(data);

  return Object.freeze(canonicalize({
    id: stableEntryId({ type: normalizedType, data: normalizedData }),
    type: normalizedType,
    data: normalizedData,
    createdAt: String(createdAt ?? ''),
    updatedAt: String(updatedAt ?? '')
  }));
};
