import fs from 'node:fs';
import path from 'node:path';
import { formatPreflightReport, runPreflightDiagnostics } from './preflight.ts';

const SETUP_DIRECTORIES = [
  'content',
  'config',
  'data',
  path.join('data', 'system'),
  path.join('data', 'content'),
  path.join('data', 'uploads'),
  'plugins',
  'themes',
  'public',
  'logs'
] as const;

type SetupOutcome = {
  projectRoot: string;
  createdDirectories: string[];
  existingDirectories: string[];
  blockedPaths: string[];
  preflightExitCode: number;
};

export const runSetupCommand = async ({ projectRoot, runtimeRoot }: { projectRoot: string; runtimeRoot: string }): Promise<SetupOutcome> => {
  const normalizedProjectRoot = path.resolve(projectRoot);

  if (!fs.existsSync(normalizedProjectRoot)) {
    throw new Error(`Resolved project root does not exist: ${normalizedProjectRoot}`);
  }

  if (!fs.statSync(normalizedProjectRoot).isDirectory()) {
    throw new Error(`Resolved project root is not a directory: ${normalizedProjectRoot}`);
  }

  const createdDirectories: string[] = [];
  const existingDirectories: string[] = [];
  const blockedPaths: string[] = [];

  for (const relativeDirectory of SETUP_DIRECTORIES) {
    const directoryPath = path.join(normalizedProjectRoot, relativeDirectory);

    if (fs.existsSync(directoryPath)) {
      if (fs.statSync(directoryPath).isDirectory()) {
        existingDirectories.push(relativeDirectory);
      } else {
        blockedPaths.push(relativeDirectory);
      }
      continue;
    }

    try {
      fs.mkdirSync(directoryPath, { recursive: true });
      createdDirectories.push(relativeDirectory);
    } catch {
      blockedPaths.push(relativeDirectory);
    }
  }

  process.stdout.write('Nimb Guided Setup\n');
  process.stdout.write('=================\n');
  process.stdout.write(`Project root: ${normalizedProjectRoot}\n\n`);

  if (createdDirectories.length > 0) {
    process.stdout.write('Created directories:\n');
    for (const created of createdDirectories) {
      process.stdout.write(`- ${created}\n`);
    }
  } else {
    process.stdout.write('Created directories:\n- none\n');
  }

  if (existingDirectories.length > 0) {
    process.stdout.write('\nAlready present:\n');
    for (const existing of existingDirectories) {
      process.stdout.write(`- ${existing}\n`);
    }
  }

  if (blockedPaths.length > 0) {
    process.stdout.write('\nManual action required:\n');
    for (const blocked of blockedPaths) {
      process.stdout.write(`- ${blocked} exists as a non-directory path or could not be created safely.\n`);
    }
  }

  process.stdout.write('\nRunning deployment preflight...\n\n');
  const report = await runPreflightDiagnostics({ projectRoot: normalizedProjectRoot, runtimeRoot });
  process.stdout.write(formatPreflightReport(report));

  process.stdout.write('\nSetup next step:\n');
  if (report.exitCode === 0 && blockedPaths.length === 0) {
    process.stdout.write('- Setup checks passed without FAIL findings.\n');
    process.stdout.write('- Start Nimb: npx nimb\n');
  } else {
    process.stdout.write('- Resolve FAIL findings and any manual-action paths listed above.\n');
    process.stdout.write('- Re-run: npx nimb setup\n');
  }

  return {
    projectRoot: normalizedProjectRoot,
    createdDirectories,
    existingDirectories,
    blockedPaths,
    preflightExitCode: report.exitCode
  };
};
