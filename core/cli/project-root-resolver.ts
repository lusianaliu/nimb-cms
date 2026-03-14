import path from 'node:path';

type ResolveProjectRootOptions = {
  argv?: string[];
  invocationCwd?: string;
  env?: NodeJS.ProcessEnv;
};

const normalizeOptionalRoot = (input: unknown): string | undefined => {
  if (typeof input !== 'string') {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveProjectRootFromArgs = ({
  argv = [],
  invocationCwd = process.cwd(),
  env = process.env
}: ResolveProjectRootOptions = {}) => {
  let fromArg: string | undefined;
  const cleaned: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      fromArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--project-root=')) {
      fromArg = arg.slice('--project-root='.length);
      continue;
    }

    cleaned.push(arg);
  }

  const argRoot = normalizeOptionalRoot(fromArg);
  const envRoot = normalizeOptionalRoot(env.NIMB_ROOT) ?? normalizeOptionalRoot(env.NIMB_PROJECT_ROOT);
  const configuredRoot = argRoot ?? envRoot ?? invocationCwd;

  return Object.freeze({
    projectRoot: path.resolve(invocationCwd, configuredRoot),
    args: Object.freeze(cleaned)
  });
};
