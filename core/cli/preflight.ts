import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { loadConfig, resolveConfigPath } from '../config/config-loader.ts';
import { SHARED_STARTUP_PREFLIGHT_INVARIANTS } from '../invariants/startup-preflight-invariants.ts';
import { ADMIN_STATIC_DIR_INVARIANT, formatAdminStaticDirInvariantFailure } from '../invariants/admin-static-dir.ts';
import { STARTUP_PORT_INVARIANT, assertValidStartupPort, formatStartupPortInvariantFailure } from '../invariants/startup-port.ts';
import { formatPersistenceRuntimeJsonInvariantFailure } from '../invariants/persistence-runtime-json.ts';
import {
  formatDirectoryMissingWithWritableParentDetail,
  formatDirectoryNextParentAnnotation,
  formatDirectoryNextPathSuffix,
  formatDirectoryParentNotWritableInvariantFailure,
  formatDirectoryShapeInvariantFailure,
  formatDirectoryUnresolvedParentInvariantFailure,
  formatDirectoryWritabilityInvariantFailure,
  resolveNearestExistingPath
} from '../invariants/directory-writability.ts';

const LEGACY_CONFIG_FILENAME = 'nimb.config.json';
const DEFAULT_ADMIN_STATIC_DIR = './ui/admin';
const INSTALL_STATE_RELATIVE_PATH = path.join('data', 'system', 'config.json');

const INSTALL_STATE_CONFIG_JSON_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.installStateConfigJson;
const DATA_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.dataDirectoryWritable;
const PERSISTENCE_RUNTIME_JSON_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson;
const PERSISTENCE_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceDirectoryWritable;
const LOGS_DIRECTORY_WRITABLE_INVARIANT = SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable;

const invariantFailSeverity = (invariant: { severityIntent: { preflight: { fail: 'FAIL' } } }): PreflightSeverity => invariant.severityIntent.preflight.fail;
const invariantWarnSeverity = (invariant: { severityIntent: { preflight: { warn?: 'WARN' } } }): PreflightSeverity => invariant.severityIntent.preflight.warn ?? 'WARN';

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
    return assertValidStartupPort(Number(fromEnv), 'PORT environment variable');
  }

  if (config?.server?.port !== undefined) {
    return assertValidStartupPort(config.server.port, 'config.server.port');
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

    server.once('error', () => done(new Error(formatStartupPortInvariantFailure(`port is unavailable: ${port}`))));
    server.once('listening', () => {
      server.close((closeError) => done(closeError ? new Error(formatStartupPortInvariantFailure(`port check failed: ${port}`)) : null));
    });
    server.listen(port, '127.0.0.1');
  });
};

const isWritableDirectory = (directoryPath: string) => {
  const probePath = path.join(directoryPath, `.nimb-preflight-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(probePath, 'ok\n', 'utf8');
  fs.rmSync(probePath, { force: true });
};

const evaluateRequiredDirectory = (
  findings: PreflightFinding[],
  directoryPath: string,
  label: string,
  invariant = DATA_DIRECTORY_WRITABLE_INVARIANT
) => {
  if (fs.existsSync(directoryPath)) {
    if (!fs.statSync(directoryPath).isDirectory()) {
      addFinding(findings, {
        severity: invariantFailSeverity(invariant),
        code: 'required-directory-shape',
        check: `${label} path shape`,
        detail: formatDirectoryShapeInvariantFailure(invariant, label, directoryPath),
        why: invariant.why,
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
        why: invariant.why,
        next: 'No action needed.'
      });
    } catch {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'required-directory-writable',
        check: `${label} writable`,
        detail: formatDirectoryWritabilityInvariantFailure(invariant, `${label} directory is not writable: ${directoryPath}`),
        why: invariant.why,
        next: `${invariant.remediation} ${formatDirectoryNextPathSuffix(directoryPath)}`
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
      detail: formatDirectoryUnresolvedParentInvariantFailure(invariant, directoryPath),
      why: invariant.why,
      next: `${invariant.remediation} ${formatDirectoryNextPathSuffix(directoryPath)}`
    });
    return;
  }

  try {
    fs.accessSync(nearestExisting, fs.constants.W_OK);
    addFinding(findings, {
      severity: 'WARN',
      code: 'required-directory-missing',
      check: `${label} exists`,
      detail: formatDirectoryMissingWithWritableParentDetail(directoryPath, nearestExisting),
      why: invariant.why,
      next: `${invariant.remediation} ${formatDirectoryNextPathSuffix(directoryPath)}`
    });
  } catch {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'required-directory-parent',
      check: `${label} parent path writable`,
      detail: formatDirectoryParentNotWritableInvariantFailure(invariant, directoryPath, nearestExisting),
      why: invariant.why,
      next: `${invariant.remediation} (Path: ${directoryPath}; ${formatDirectoryNextParentAnnotation(nearestExisting)})`
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
            check: ADMIN_STATIC_DIR_INVARIANT.title,
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir} and exists.`,
            why: ADMIN_STATIC_DIR_INVARIANT.why,
            next: 'No action needed.'
          });
        } else if (staticDirExists) {
          addFinding(findings, {
            severity: invariantFailSeverity(ADMIN_STATIC_DIR_INVARIANT),
            code: 'admin-static-dir-shape',
            check: ADMIN_STATIC_DIR_INVARIANT.title,
            detail: formatAdminStaticDirInvariantFailure(`admin staticDir is not a directory: ${resolvedAdminStaticDir}`),
            why: ADMIN_STATIC_DIR_INVARIANT.why,
            next: `${ADMIN_STATIC_DIR_INVARIANT.remediation} (Resolved path: ${resolvedAdminStaticDir})`
          });
        } else if (usingDefaultStaticDir) {
          addFinding(findings, {
            severity: invariantWarnSeverity(ADMIN_STATIC_DIR_INVARIANT),
            code: 'admin-static-fallback',
            check: ADMIN_STATIC_DIR_INVARIANT.title,
            detail: `Admin staticDir resolves to ${resolvedAdminStaticDir}, but this directory is missing.`,
            why: ADMIN_STATIC_DIR_INVARIANT.why,
            next: 'If you expect custom admin assets, deploy them at the configured staticDir; otherwise fallback behavior is expected.'
          });
        } else {
          addFinding(findings, {
            severity: invariantFailSeverity(ADMIN_STATIC_DIR_INVARIANT),
            code: 'admin-static-configured-missing',
            check: ADMIN_STATIC_DIR_INVARIANT.title,
            detail: formatAdminStaticDirInvariantFailure(`admin staticDir does not exist: ${resolvedAdminStaticDir}`),
            why: ADMIN_STATIC_DIR_INVARIANT.why,
            next: `${ADMIN_STATIC_DIR_INVARIANT.remediation} (Resolved path: ${resolvedAdminStaticDir})`
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
      severity: invariantWarnSeverity(INSTALL_STATE_CONFIG_JSON_INVARIANT),
      code: 'install-state-missing',
      check: INSTALL_STATE_CONFIG_JSON_INVARIANT.title,
      detail: `Install-state file not found: ${installStatePath}`,
      why: INSTALL_STATE_CONFIG_JSON_INVARIANT.why,
      next: `${INSTALL_STATE_CONFIG_JSON_INVARIANT.remediation} Missing path: ${installStatePath}. This is normal for first install.`
    });
  } else if (!fs.statSync(installStatePath).isFile()) {
    addFinding(findings, {
      severity: invariantFailSeverity(INSTALL_STATE_CONFIG_JSON_INVARIANT),
      code: 'install-state-shape',
      check: INSTALL_STATE_CONFIG_JSON_INVARIANT.title,
      detail: `${installStatePath} exists but is not a file.`,
      why: INSTALL_STATE_CONFIG_JSON_INVARIANT.why,
      next: `${INSTALL_STATE_CONFIG_JSON_INVARIANT.remediation} (Path: ${installStatePath})`
    });
  } else {
    try {
      JSON.parse(fs.readFileSync(installStatePath, 'utf8'));
      addFinding(findings, {
        severity: 'PASS',
        code: 'install-state-readable',
        check: INSTALL_STATE_CONFIG_JSON_INVARIANT.title,
        detail: `Install-state file exists and is valid JSON: ${installStatePath}`,
        why: INSTALL_STATE_CONFIG_JSON_INVARIANT.why,
        next: 'No action needed.'
      });
    } catch {
      addFinding(findings, {
        severity: invariantWarnSeverity(INSTALL_STATE_CONFIG_JSON_INVARIANT),
        code: 'install-state-invalid-json',
        check: INSTALL_STATE_CONFIG_JSON_INVARIANT.title,
        detail: `Install-state file exists but is not valid JSON: ${installStatePath}`,
        why: INSTALL_STATE_CONFIG_JSON_INVARIANT.why,
        next: `${INSTALL_STATE_CONFIG_JSON_INVARIANT.remediation} (Path: ${installStatePath})`
      });
    }
  }

  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'plugins'), 'plugins');
  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'themes'), 'themes');
  evaluateExpectedDirectory(findings, path.join(normalizedProjectRoot, 'public'), 'public');

  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data'), 'data', DATA_DIRECTORY_WRITABLE_INVARIANT);
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'system'), 'data/system', PERSISTENCE_DIRECTORY_WRITABLE_INVARIANT);
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'content'), 'data/content', DATA_DIRECTORY_WRITABLE_INVARIANT);
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'data', 'uploads'), 'data/uploads', DATA_DIRECTORY_WRITABLE_INVARIANT);
  evaluateRequiredDirectory(findings, path.join(normalizedProjectRoot, 'logs'), 'logs', LOGS_DIRECTORY_WRITABLE_INVARIANT);

  const persistenceRuntimePath = path.join(normalizedProjectRoot, 'data', 'system', 'runtime.json');
  if (fs.existsSync(persistenceRuntimePath)) {
    if (!fs.statSync(persistenceRuntimePath).isFile()) {
      addFinding(findings, {
        severity: 'FAIL',
        code: 'persistence-runtime-shape',
        check: PERSISTENCE_RUNTIME_JSON_INVARIANT.title,
        detail: `${persistenceRuntimePath} exists but is not a file.`,
        why: PERSISTENCE_RUNTIME_JSON_INVARIANT.why,
        next: `${PERSISTENCE_RUNTIME_JSON_INVARIANT.remediation} (Path: ${persistenceRuntimePath})`
      });
    } else {
      try {
        JSON.parse(fs.readFileSync(persistenceRuntimePath, 'utf8'));
        addFinding(findings, {
          severity: 'PASS',
          code: 'persistence-runtime-valid',
          check: PERSISTENCE_RUNTIME_JSON_INVARIANT.title,
          detail: `${persistenceRuntimePath} exists and is valid JSON.`,
          why: PERSISTENCE_RUNTIME_JSON_INVARIANT.why,
          next: 'No action needed.'
        });
      } catch {
        addFinding(findings, {
          severity: 'FAIL',
          code: 'persistence-runtime-invalid-json',
          check: PERSISTENCE_RUNTIME_JSON_INVARIANT.title,
          detail: formatPersistenceRuntimeJsonInvariantFailure(`persistence file is invalid JSON: ${persistenceRuntimePath}`),
          why: PERSISTENCE_RUNTIME_JSON_INVARIANT.why,
          next: `${PERSISTENCE_RUNTIME_JSON_INVARIANT.remediation} (Path: ${persistenceRuntimePath})`
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
      check: STARTUP_PORT_INVARIANT.title,
      detail: `Port ${startupPort} is available for binding on 127.0.0.1.`,
      why: STARTUP_PORT_INVARIANT.why,
      next: 'No action needed.'
    });
  } catch (error) {
    addFinding(findings, {
      severity: 'FAIL',
      code: 'startup-port-invalid-or-unavailable',
      check: STARTUP_PORT_INVARIANT.title,
      detail: error instanceof Error ? error.message : String(error),
      why: STARTUP_PORT_INVARIANT.why,
      next: STARTUP_PORT_INVARIANT.remediation
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
