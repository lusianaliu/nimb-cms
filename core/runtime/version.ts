import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

export const version = String(packageJson?.version ?? '0.0.0');
export const buildTimestamp = '1970-01-01T00:00:00.000Z';

export const resolveRuntimeMode = (input) => {
  const normalized = String(input ?? '').toLowerCase();
  return normalized === 'production' ? 'production' : 'development';
};
