import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { loadConfig, resolveConfigPath } from '../config/config-loader.ts';

const LEGACY_CONFIG_FILENAME = 'nimb.config.json';
const DEFAULT_ADMIN_STATIC_DIR = './ui/admin';
const INSTALL_STATE_RELATIVE_PATH = path.join('data', 'system', 'config.json');

export type PreflightSeverity = 'PASS' | 'WARN' | 'FAIL';

export type PreflightFinding = {
  severity: PreflightSeverity;
  code: string;
  check: string;
  detail: string;
  why: string;
  next: string;
};

export type PreflightReport = {
  projectRoot: string;
  findings: PreflightFinding[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  exitCode: number;
};

const addFinding = (findings: PreflightFinding[], finding: PreflightFinding) => {
  findings.push(Object.freeze(finding));
};

const parseStartupPort = (config: ReturnType<typeof loadConfig> | null, env = process.env) => {
  const fromEnv = env.PORT;
  if (fromEnv !== undefined && `${fromEnv}`.trim() !== '') {
    const envPort = Number(fromEnv);
    if (!Number.isInteger(envPort) || envPort < 0 || envPort > 65535) {
      throw new Error(`Invalid PORT environment variable: ${fromEnv}`);
    }

    return envPort;
  }

  if (config?.server?.port !== undefined) {
    return config.server.port;
  }

  return 3000;
};

const checkPortAvailable = async (port: number) => {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    const done = (error?: Error | null) => {
      server.removeAllListeners();
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    };

    server.once('error', () => done(new Error(`Startup invariant failed: port is unavailable: ${port}`)));
    server.once('listening', () => {
      server.close((closeError) => done(closeError ? new Error(`Startup invariant failed: port check failed: ${port}`) : null));
    });
    server.listen(port, '127.0.0.1');
  });
};

const isWritableDirectory = (directoryPath: string) => {
  const probePath = path.join(directoryPath, `.nimb-preflight-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(probePath, 'ok\n', 'utf8');
  fs.rmSync(probePath, { force: true });
};

const resolveNearestExistingPath = (targetPath: string) => {
  let currentPath = path.resolve(targetPath);
  while (!fs.existsSync(currentPath)) {
    const nextPath = path.dirname(currentPath);
    if (nextPath === currentPath) {
      return null;
    }

    currentPath = nextPath;
  }

  return currentPath;
};

const evaluateRequiredDirectory = (findings: PreflightFinding[], directoryPath: string, label: string) => {
  if (fs.existsSync(directoryPath)) {
    if (!fs.statSync(directoryPath).isDirectory()) {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'required-directory-shape',
        check: `${label} path shape`,
        detail: `${directoryPath} exists but is not a directory.`,
        why: 'Nimb startup requires this path to be a writable directory.',
        next: `Replace ${directoryPath} with a directory before starting Nimb.`
      });
      return;
    }

    try {
      isWritableDirectory(directoryPath);
      addFinding(findings, {
        severity: 'PASS',
        code: 'required-directory-writable',
        check: `${label} writable`,
        detail: `${directoryPath} exists and accepted a temporary write probe.`,
        why: 'Nimb needs writable storage for runtime data and logs.',
        next: 'No action needed.'
      });
    } catch {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'required-directory-writable',
        check: `${label} writable`,
        detail: `${directoryPath} exists but is not writable by the current process.`,
        why: 'Nimb startup invariants require writable runtime directories.',
        next: `Adjust ownership/permissions for ${directoryPath} or choose a writable project root.`
      });
    }

    return;
  }

  const nearestExisting = resolveNearestExistingPath(directoryPath);
  if (!nearestExisting) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'required-directory-parent',
      check: `${label} parent path`,
      detail: `Unable to resolve an existing parent path for ${directoryPath}.`,
      why: 'Nimb cannot create required directories without a writable parent path.',
      next: `Create ${directoryPath} (and parent folders) manually with writable permissions.`
    });
    return;
  }

  try {
    fs.accessSync(nearestExisting, fs.constants.W_OK);
    addFinding(findings, {
      severity: 'WARN',
      code: 'required-directory-missing',
      check: `${label} exists`,
      detail: `${directoryPath} is missing, but parent path ${nearestExisting} appears writable.`,
      why: 'Nimb startup will attempt to create this required directory.',
      next: `Optional: pre-create ${directoryPath} to reduce first-start surprises.`
    });
  } catch {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'required-directory-parent',
      check: `${label} parent path writable`,
      detail: `${directoryPath} is missing and parent path ${nearestExisting} is not writable.`,
      why: 'Nimb startup cannot create required runtime directories in read-only parents.',
      next: `Grant write permissions on ${nearestExisting} or pre-create ${directoryPath} with correct ownership.`
    });
  }
};

const evaluateExpectedDirectory = (findings: PreflightFinding[], directoryPath: string, label: string) => {
  if (!fs.existsSync(directoryPath)) {
    addFinding(findings, {
      severity: 'WARN',
      code: 'expected-directory-missing',
      check: `${label} directory presence`,
      detail: `${directoryPath} is missing.`,
      why: 'This directory is part of Nimb\'s canonical project layout.',
      next: `Create ${directoryPath} if this project expects ${label} resources.`
    });
    return;
  }

  if (!fs.statSync(directoryPath).isDirectory()) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'expected-directory-shape',
      check: `${label} directory shape`,
      detail: `${directoryPath} exists but is not a directory.`,
      why: 'Nimb expects this layout path to be a directory.',
      next: `Replace ${directoryPath} with a directory.`
    });
    return;
  }

  addFinding(findings, {
    severity: 'PASS',
    code: 'expected-directory-present',
    check: `${label} directory presence`,
    detail: `${directoryPath} exists as a directory.`,
    why: 'Directory layout matches canonical project expectations.',
    next: 'No action needed.'
  });
};

export const runPreflightDiagnostics = async ({ projectRoot, runtimeRoot, env = process.env }: { projectRoot: string; runtimeRoot: string; env?: NodeJS.ProcessEnv }): Promise<PreflightReport> => {
  const findings: PreflightFinding[] = [];
  const normalizedProjectRoot = path.resolve(projectRoot);
  let loadedConfig: ReturnType<typeof loadConfig> | null = null;

  if (!fs.existsSync(normalizedProjectRoot)) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'project-root-missing',
      check: 'Project root resolution',
      detail: `Resolved project root does not exist: ${normalizedProjectRoot}`,
      why: 'All canonical runtime paths are relative to the resolved project root.',
      next: 'Use --project-root (or NIMB_ROOT/NIMB_PROJECT_ROOT) to point to a valid project directory.'
    });
  } else if (!fs.statSync(normalizedProjectRoot).isDirectory()) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'project-root-shape',
      check: 'Project root resolution',
      detail: `Resolved project root is not a directory: ${normalizedProjectRoot}`,
      why: 'Nimb cannot start from a non-directory project root.',
      next: 'Point Nimb at a valid project directory.'
    });
  } else {
    addFinding(findings, {
      severity: 'PASS',
      code: 'project-root-resolved',
      check: 'Project root resolution',
      detail: `Resolved project root: ${normalizedProjectRoot}`,
      why: 'The canonical runtime path depends on a stable project root.',
      next: 'No action needed.'
    });
  }

  const configPath = resolveConfigPath(normalizedProjectRoot);
  const legacyConfigPath = path.join(normalizedProjectRoot, LEGACY_CONFIG_FILENAME);

  const configPathExists = fs.existsSync(configPath);
  const legacyConfigExists = fs.existsSync(legacyConfigPath);

  if (!configPathExists && !legacyConfigExists) {
    addFinding(findings, {
      severity: 'WARN',
      code: 'config-missing',
      check: 'Config file availability',
      detail: `No config file found at ${configPath} (or legacy ${legacyConfigPath}).`,
      why: 'Nimb can create default config on first startup, which still depends on writable project paths.',
      next: `Create ${configPath} now if you want explicit configuration before first boot.`
    });
  } else {
    const activeConfigPath = configPathExists ? configPath : legacyConfigPath;
    try {
      const config = loadConfig({ cwd: normalizedProjectRoot });
      loadedConfig = config;
      addFinding(findings, {
        severity: 'PASS',
        code: 'config-valid',
        check: 'Config file availability',
        detail: `Config loaded successfully from ${activeConfigPath}.`,
        why: 'Nimb startup requires a valid config shape.',
        next: 'No action needed.'
      });

      const adminStaticDir = config.admin?.staticDir ?? DEFAULT_ADMIN_STATIC_DIR;
      const resolvedAdminStaticDir = path.isAbsolute(adminStaticDir)
        ? adminStaticDir
        : path.resolve(runtimeRoot, adminStaticDir);

      if (config.admin?.enabled === true) {
        const staticDirExists = fs.existsSync(resolvedAdminStaticDir);
        const staticDirIsDirectory = staticDirExists && fs.statSync(resolvedAdminStaticDir).isDirectory();
        const configuredStaticDir = typeof config.admin?.staticDir === 'string' && config.admin.staticDir.trim() !== ''
          ? config.admin.staticDir
          : DEFAULT_ADMIN_STATIC_DIR;
        const usingDefaultStaticDir = configuredStaticDir === DEFAULT_ADMIN_STATIC_DIR;

        if (staticDirIsDirectory) {
          addFinding(findings, {
            severity: 'PASS',
            code: 'admin-static-dir',
            check: 'Admin static directory',
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir} and exists.`,
            why: 'This is the first-choice location for admin UI static assets.',
            next: 'No action needed.'
          });
        } else if (staticDirExists) {
          addFinding(findings, {
            severity: 'FAIL',
            code: 'admin-static-dir-shape',
            check: 'Admin static directory',
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir}, but this path is not a directory.`,
            why: 'Startup invariant validation fails when admin staticDir resolves to a non-directory path.',
            next: `Replace ${resolvedAdminStaticDir} with a directory, or update config.admin.staticDir.`
          });
        } else if (usingDefaultStaticDir) {
          addFinding(findings, {
            severity: 'WARN',
            code: 'admin-static-fallback',
            check: 'Admin static directory',
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir}, but this directory is missing.`,
            why: 'Nimb can fall back to built-in admin shell/assets, but this can hide packaging/layout issues.',
            next: 'If you expect custom admin assets, deploy them at the configured staticDir.'
          });
        } else {
          addFinding(findings, {
            severity: 'FAIL',
            code: 'admin-static-configured-missing',
            check: 'Admin static directory',
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir}, but this directory is missing.`,
            why: 'Startup invariant validation requires configured admin staticDir paths to exist.',
            next: `Create ${resolvedAdminStaticDir}, or remove config.admin.staticDir to use the built-in fallback path.`
          });
        }
      }
    } catch (error) {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'config-invalid',
        check: 'Config file availability',
        detail: `Config validation failed: ${error instanceof Error ? error.message : String(error)}`,
        why: 'Invalid config blocks canonical startup.',
        next: `Fix the config at ${activeConfigPath} before startup.`
      });
    }
  }

  const installStatePath = path.join(normalizedProjectRoot, INSTALL_STATE_RELATIVE_PATH);
  if (!fs.existsSync(installStatePath)) {
    addFinding(findings, {
      severity: 'WARN',
      code: 'install-state-missing',
      check: 'Install-state source path',
      detail: `Install-state file not found: ${installStatePath}`,
      why: 'Canonical install state is read from data/system/config.json.',
      next: 'This is normal for first install. For existing deployments, verify the file was deployed and is writable.'
    });
  } else if (!fs.statSync(installStatePath).isFile()) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'install-state-shape',
      check: 'Install-state source path',
      detail: `${installStatePath} exists but is not a file.`,
      why: 'Nimb expects install state at a JSON file path.',
      next: `Replace ${installStatePath} with a valid JSON file.`
    });
  } else {
    try {
      JSON.parse(fs.readFileSync(installStatePath, 'utf8'));
      addFinding(findings, {
        severity: 'PASS',
        code: 'install-state-readable',
        check: 'Install-state source path',
        detail: `Install-state file exists and is valid JSON: ${installStatePath}`,
        why: 'Install state drives canonical installed/uninstalled behavior.',
        next: 'No action needed.'
      });
    } catch {
      addFinding(findings, {
        severity: 'WARN',
        code: 'install-state-invalid-json',
        check: 'Install-state source path',
        detail: `Install-state file exists but is not valid JSON: ${installStatePath}`,
        why: 'Nimb will treat unreadable config as default state, which can misrepresent install status.',
        next: `Repair JSON at ${installStatePath} to preserve expected install status.`
      });
    }
  }

  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'plugins'), 'plugins');
  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'themes'), 'themes');
  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'public'), 'public');

  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data'), 'data');
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'system'), 'data/system');
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'content'), 'data/content');
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'uploads'), 'data/uploads');
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'logs'), 'logs');

  const persistenceRuntimePath = path.join(normalizedProjectRoot, 'data', 'system', 'runtime.json');
  if (fs.existsSync(persistenceRuntimePath)) {
    if (!fs.statSync(persistenceRuntimePath).isFile()) {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'persistence-runtime-shape',
        check: 'Persistence runtime file',
        detail: `${persistenceRuntimePath} exists but is not a file.`,
        why: 'Startup invariant validation expects persistence runtime state at a JSON file path.',
        next: `Replace ${persistenceRuntimePath} with a JSON file or remove it.`
      });
    } else {
      try {
        JSON.parse(fs.readFileSync(persistenceRuntimePath, 'utf8'));
        addFinding(findings, {
          severity: 'PASS',
          code: 'persistence-runtime-valid',
          check: 'Persistence runtime file',
          detail: `${persistenceRuntimePath} exists and is valid JSON.`,
          why: 'Startup invariant validation loads this file when present.',
          next: 'No action needed.'
        });
      } catch {
        addFinding(findings, {
          severity: 'FAIL',
          code: 'persistence-runtime-invalid-json',
          check: 'Persistence runtime file',
          detail: `${persistenceRuntimePath} exists but is not valid JSON.`,
          why: 'Startup invariant validation fails on invalid persistence runtime JSON.',
          next: `Fix JSON formatting in ${persistenceRuntimePath}, or remove the file.`
        });
      }
    }
  }

  try {
    const startupPort = parseStartupPort(loadedConfig, env);
    await checkPortAvailable(startupPort);
    addFinding(findings, {
      severity: 'PASS',
      code: 'startup-port-available',
      check: 'Startup port availability',
      detail: `Port ${startupPort} is available for binding on 127.0.0.1.`,
      why: 'Canonical startup validates port availability before HTTP server boot.',
      next: 'No action needed.'
    });
  } catch (error) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'startup-port-invalid-or-unavailable',
      check: 'Startup port availability',
      detail: error instanceof Error ? error.message : String(error),
      why: 'Canonical startup fails when the selected startup port is invalid or already in use.',
      next: 'Set PORT (or config.server.port) to a valid, free port before startup.'
    });
  }

  const summary = findings.reduce(
    (accumulator, finding) => {
      if (finding.severity === 'PASS') {
        accumulator.pass += 1;
      } else if (finding.severity === 'WARN') {
        accumulator.warn += 1;
      } else {
        accumulator.fail += 1;
      }

      return accumulator;
    },
    { pass: 0, warn: 0, fail: 0 }
  );

  return Object.freeze({
    projectRoot: normalizedProjectRoot,
    findings: Object.freeze(findings),
    summary: Object.freeze(summary),
    exitCode: summary.fail > 0 ? 1 : 0
  });
};

export const formatPreflightReport = (report: PreflightReport) => {
  const lines: string[] = [];
  lines.push('Nimb Deployment Preflight');
  lines.push(`project: ${report.projectRoot}`);
  lines.push('');

  for (const finding of report.findings) {
    lines.push(`[${finding.severity}] ${finding.check}`);
    lines.push(`  detail: ${finding.detail}`);
    lines.push(`  why: ${finding.why}`);
    lines.push(`  next: ${finding.next}`);
    lines.push('');
  }

  const overall = report.summary.fail > 0 ? 'FAIL' : report.summary.warn > 0 ? 'WARN' : 'PASS';
  lines.push(`Preflight result: ${overall}`);
  lines.push(`Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`);
  lines.push('Limits: preflight checks path/layout/writability assumptions only; it does not prove full runtime behavior.');

  return `${lines.join('\n')}\n`;
};
