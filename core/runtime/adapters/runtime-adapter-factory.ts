import { createEmbeddedAdapter } from './embedded-adapter.ts';
import { createNodeAdapter } from './node-adapter.ts';

export const resolveAdapterType = (input = 'node') => {
  const normalized = String(input ?? 'node').trim().toLowerCase();
  if (normalized === 'embedded') {
    return 'embedded';
  }

  return 'node';
};

export const createRuntimeAdapter = ({ type = 'node', ...options }) => {
  const adapterType = resolveAdapterType(type);

  if (adapterType === 'embedded') {
    return createEmbeddedAdapter(options);
  }

  return createNodeAdapter(options);
};
