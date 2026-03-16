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
  formatDirectoryRemediationWithPathSuffix,
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

export type RetryDecisionPath = {
  rerunSetupNow: boolean;
  rerunPreflightAfterManualFix: boolean;
  askSupportNow: boolean;
};

type RemediationCategory = 'Project layout' | 'Filesystem permissions' | 'Configuration' | 'Network/port binding' | 'Install-state data' | 'Other';

type EnvironmentFixPlaybook = {
  id: string;
  title: string;
  categories: RemediationCategory[];
  findingCodes: string[];
  typicalCauses: string[];
  commonCommands: string[];
  retryStep: string;
  escalation: string;
};

const REMEDIATION_CATEGORY_PRIORITY: RemediationCategory[] = [
  'Project layout',
  'Filesystem permissions',
  'Configuration',
  'Install-state data',
  'Network/port binding',
  'Other'
];

const addFinding = (findings: PreflightFinding[], finding: PreflightFinding) => {
  findings.push(Object.freeze(finding));
};

const categorizeFinding = (finding: PreflightFinding): RemediationCategory => {
  if (finding.code.includes('startup-port')) {
    return 'Network/port binding';
  }

  if (finding.code.startsWith('config-') || finding.code.startsWith('admin-static')) {
    return 'Configuration';
  }

  if (finding.code.startsWith('install-state')) {
    return 'Install-state data';
  }

  if (finding.code.includes('writable') || finding.code.includes('parent')) {
    return 'Filesystem permissions';
  }

  if (finding.code.includes('directory') || finding.code.includes('project-root') || finding.code.includes('shape')) {
    return 'Project layout';
  }

  return 'Other';
};

const remediationPlaybook: Record<RemediationCategory, string> = {
  'Project layout': 'Fix path conflicts first: replace files where directories are required, then re-run setup.',
  'Filesystem permissions': 'Grant runtime write access to required paths (`data/*`, `logs`) before retrying.',
  Configuration: 'Fix invalid or missing configuration values/paths in `config/nimb.config.json`.',
  'Network/port binding': 'Choose a free port (PORT or config.server.port), or stop the process currently using it.',
  'Install-state data': 'Ensure `data/system/config.json` exists as valid JSON and is readable by the runtime user.',
  Other: 'Review finding details and resolve the blocker before startup.'
};

const ENVIRONMENT_FIX_PLAYBOOKS: EnvironmentFixPlaybook[] = [
  {
    id: 'linux-runtime-write-access',
    title: 'Linux runtime write-access reset for required Nimb paths',
    categories: ['Filesystem permissions'],
    findingCodes: ['required-directory-writable', 'required-directory-parent'],
    typicalCauses: [
      'Project files were created by a different OS user than the runtime user.',
      'Parent directory exists but runtime user has no write bit on data/ or logs/ paths.',
      'Deployment copy preserved restrictive ownership from build machine artifacts.'
    ],
    commonCommands: [
      'ls -ld data data/system data/content data/uploads logs',
      'id -un',
      'sudo chown -R <runtime-user>:<runtime-group> data logs',
      'sudo chmod -R u+rwX,g+rwX data logs'
    ],
    retryStep: 'After ownership/permissions are corrected, run: npx nimb preflight',
    escalation: 'If ownership is managed by a hosting panel/container policy, stop and ask hosting support for writable access to data/* and logs for the runtime account.'
  },
  {
    id: 'startup-port-conflict-triage',
    title: 'Startup port conflict triage for local/container deployments',
    categories: ['Network/port binding'],
    findingCodes: ['startup-port-invalid-or-unavailable'],
    typicalCauses: [
      'Another app/process manager is already bound to the configured port.',
      'A stale dev server or prior Nimb instance is still running in the same host/container.',
      'PORT environment variable overrides config.server.port with a value that is blocked or invalid.'
    ],
    commonCommands: [
      'echo "$PORT"',
      'cat config/nimb.config.json',
      'lsof -iTCP -sTCP:LISTEN -n -P | grep ":<port>"',
      'ss -ltnp | grep ":<port>"',
      'PORT=3100 npx nimb preflight'
    ],
    retryStep: 'After selecting a free port or stopping the conflicting process, run: npx nimb preflight',
    escalation: 'If platform policy reserves or remaps ports and you cannot choose a known-free port, ask hosting/platform support for the allowed inbound bind port strategy.'
  },
  {
    id: 'json-state-recovery-config-install',
    title: 'Config/install-state JSON recovery (safe backup + validation first)',
    categories: ['Configuration', 'Install-state data'],
    findingCodes: ['config-invalid', 'install-state-invalid-json'],
    typicalCauses: [
      'Manual edits left trailing commas, comments, or partial JSON content.',
      'Deployment copy/merge left truncated config or install-state files.',
      'A text editor or script wrote non-JSON data to config/install-state paths.'
    ],
    commonCommands: [
      'cp config/nimb.config.json config/nimb.config.json.bak.$(date +%Y%m%d%H%M%S)',
      'cp data/system/config.json data/system/config.json.bak.$(date +%Y%m%d%H%M%S)',
      'node -e "JSON.parse(require(\'node:fs\').readFileSync(\'config/nimb.config.json\',\'utf8\')); console.log(\'config JSON valid\')"',
      'node -e "JSON.parse(require(\'node:fs\').readFileSync(\'data/system/config.json\',\'utf8\')); console.log(\'install-state JSON valid\')"',
      'npx nimb preflight'
    ],
    retryStep: 'After restoring valid JSON (or replacing from a known-good backup/template), run: npx nimb preflight',
    escalation: 'If you do not have a known-good backup or are unsure which keys are safe to change, stop and ask technical support before editing production state further.'
  }
];

const sortCategoryEntries = (entries: [RemediationCategory, PreflightFinding[]][]) => entries.sort((left, right) => {
  const leftPriority = REMEDIATION_CATEGORY_PRIORITY.indexOf(left[0]);
  const rightPriority = REMEDIATION_CATEGORY_PRIORITY.indexOf(right[0]);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (left[1].length !== right[1].length) {
    return right[1].length - left[1].length;
  }

  return left[0].localeCompare(right[0]);
});

const groupFindingsByCategory = (findings: PreflightFinding[]) => {
  const grouped = new Map<RemediationCategory, PreflightFinding[]>();
  for (const finding of findings) {
    const category = categorizeFinding(finding);
    const existing = grouped.get(category);
    if (existing) {
      existing.push(finding);
    } else {
      grouped.set(category, [finding]);
    }
  }

  return sortCategoryEntries([...grouped.entries()]);
};

const pushGroupedFindings = ({ lines, title, findings }: { lines: string[]; title: string; findings: PreflightFinding[] }) => {
  lines.push(title);

  if (findings.length === 0) {
    lines.push('- none');
    lines.push('');
    return;
  }

  for (const [category, categoryFindings] of groupFindingsByCategory(findings)) {
    lines.push(`- ${category}:`);
    lines.push(`  operator next step: ${remediationPlaybook[category]}`);
    for (const finding of categoryFindings) {
      lines.push(`  - ${finding.check} (${finding.code})`);
      lines.push(`    next: ${finding.next}`);
    }
  }

  lines.push('');
};

const buildRetrySummaryLines = (report: PreflightReport) => {
  const failFindings = report.findings.filter((finding) => finding.severity === 'FAIL');
  const warnFindings = report.findings.filter((finding) => finding.severity === 'WARN');
  const failGroups = groupFindingsByCategory(failFindings);
  const warnGroups = groupFindingsByCategory(warnFindings);

  const lines: string[] = [];
  lines.push('Retry summary:');
  lines.push(`- Blocking now: ${failFindings.length} FAIL finding(s) across ${failGroups.length} categor${failGroups.length === 1 ? 'y' : 'ies'}.`);
  lines.push(`- Can wait: ${warnFindings.length} WARN finding(s) across ${warnGroups.length} categor${warnGroups.length === 1 ? 'y' : 'ies'}.`);

  if (failGroups.length > 0) {
    lines.push('- Fix first (in order):');
    failGroups.forEach(([category, categoryFindings], index) => {
      lines.push(`  ${index + 1}. ${category} (${categoryFindings.length} blocker${categoryFindings.length === 1 ? '' : 's'}) — ${remediationPlaybook[category]}`);
    });
  } else {
    lines.push('- Fix first: none (no blocking findings).');
  }

  if (warnGroups.length > 0) {
    lines.push('- Warnings to schedule after blockers are cleared:');
    for (const [category, categoryFindings] of warnGroups) {
      lines.push(`  - ${category} (${categoryFindings.length} warning${categoryFindings.length === 1 ? '' : 's'})`);
    }
  }

  lines.push('- Retry after fixes: npx nimb preflight');
  lines.push('- Support handoff: npx nimb preflight --json > nimb-preflight-report.json');
  lines.push(...buildDecisionPathLines(report));
  lines.push('');
  return lines;
};

const deriveEnvironmentFixPlaybooks = (report: PreflightReport): EnvironmentFixPlaybook[] => {
  const actionableFindings = report.findings.filter((finding) => finding.severity === 'FAIL' || finding.severity === 'WARN');
  const actionableCodes = new Set(actionableFindings.map((finding) => finding.code));
  const actionableCategories = new Set(groupFindingsByCategory(actionableFindings).map(([category]) => category));

  return ENVIRONMENT_FIX_PLAYBOOKS.filter((playbook) => {
    const categoryMatch = playbook.categories.some((category) => actionableCategories.has(category));
    const codeMatch = playbook.findingCodes.some((code) => actionableCodes.has(code));
    return categoryMatch || codeMatch;
  });
};

const buildEnvironmentFixPlaybookLines = (report: PreflightReport) => {
  const playbooks = deriveEnvironmentFixPlaybooks(report);
  if (playbooks.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push('Environment fix playbooks (common examples, not universal guarantees):');
  for (const playbook of playbooks) {
    lines.push(`- ${playbook.title} (${playbook.id})`);
    lines.push('  typical causes:');
    for (const cause of playbook.typicalCauses) {
      lines.push(`    - ${cause}`);
    }
    lines.push('  common command examples (review before running):');
    for (const command of playbook.commonCommands) {
      lines.push(`    - ${command}`);
    }
    lines.push(`  retry: ${playbook.retryStep}`);
    lines.push(`  escalation: ${playbook.escalation}`);
  }

  lines.push('');
  return lines;
};

const SUPPORT_NOW_FAIL_CODES = new Set([
  'config-invalid',
  'install-state-invalid-json',
  'persistence-runtime-invalid-json',
  'startup-port-invalid-or-unavailable'
]);

export const deriveRetryDecisionPath = (report: PreflightReport): RetryDecisionPath => {
  const failFindings = report.findings.filter((finding) => finding.severity === 'FAIL');
  const hasSetupFixableMissingDirectory = report.findings.some((finding) => finding.code === 'required-directory-missing');
  const rerunSetupNow = hasSetupFixableMissingDirectory && failFindings.length === 0;
  const askSupportNow = failFindings.some((finding) => SUPPORT_NOW_FAIL_CODES.has(finding.code));

  return Object.freeze({
    rerunSetupNow,
    rerunPreflightAfterManualFix: failFindings.length > 0 && rerunSetupNow === false,
    askSupportNow
  });
};

const buildDecisionPathLines = (report: PreflightReport) => {
  const decision = deriveRetryDecisionPath(report);
  const lines: string[] = [];
  lines.push('Decision path:');

  if (decision.rerunSetupNow) {
    lines.push('- Re-run setup now: FAIL findings are missing required directories that setup can create safely.');
    lines.push('  command: npx nimb setup');
  } else {
    lines.push('- Re-run setup now: not recommended for current FAIL findings.');
  }

  if (decision.rerunPreflightAfterManualFix) {
    lines.push('- Re-run preflight after manual fixes: use preflight to confirm blockers are cleared without changing files.');
    lines.push('  command: npx nimb preflight');
  } else {
    lines.push('- Re-run preflight after manual fixes: not needed yet.');
  }

  if (decision.askSupportNow) {
    lines.push('- Ask support now: blocker type usually needs technical help if unclear after one fix attempt.');
    lines.push('  handoff: npx nimb preflight --json > nimb-preflight-report.json');
  } else {
    lines.push('- Ask support now: optional (use if blockers remain unclear).');
  }

  return lines;
};

export const formatPreflightReportJson = (report: PreflightReport) => {
  const failFindings = report.findings.filter((finding) => finding.severity === 'FAIL');
  const warnFindings = report.findings.filter((finding) => finding.severity === 'WARN');
  const failGroups = groupFindingsByCategory(failFindings);
  const warnGroups = groupFindingsByCategory(warnFindings);
  const overall = report.summary.fail > 0 ? 'FAIL' : report.summary.warn > 0 ? 'WARN' : 'PASS';
  const decisionPath = deriveRetryDecisionPath(report);
  const environmentFixPlaybooks = deriveEnvironmentFixPlaybooks(report);

  return `${JSON.stringify({
    projectRoot: report.projectRoot,
    result: overall,
    summary: report.summary,
    retrySummary: {
      blockingCategories: failGroups.map(([category, findings]) => ({
        category,
        findingCount: findings.length,
        operatorNextStep: remediationPlaybook[category],
        findings: findings.map((finding) => ({ check: finding.check, code: finding.code, next: finding.next }))
      })),
      warningCategories: warnGroups.map(([category, findings]) => ({
        category,
        findingCount: findings.length,
        operatorNextStep: remediationPlaybook[category],
        findings: findings.map((finding) => ({ check: finding.check, code: finding.code, next: finding.next }))
      })),
      environmentFixPlaybooks,
      retryCommand: 'npx nimb preflight',
      decisionPath
    },
    findings: report.findings
  }, null, 2)}\n`;
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
        next: formatDirectoryRemediationWithPathSuffix(invariant.remediation, directoryPath)
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
      next: formatDirectoryRemediationWithPathSuffix(invariant.remediation, directoryPath)
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
      next: formatDirectoryRemediationWithPathSuffix(invariant.remediation, directoryPath)
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

  lines.push('Change status: preflight is validation-only and does not auto-fix files or directories.');
  lines.push('');

  const failFindings = report.findings.filter((finding) => finding.severity === 'FAIL');
  const warnFindings = report.findings.filter((finding) => finding.severity === 'WARN');
  pushGroupedFindings({ lines, title: 'Manual action required (FAIL findings):', findings: failFindings });
  pushGroupedFindings({ lines, title: 'Warnings to review (WARN findings):', findings: warnFindings });
  lines.push(...buildEnvironmentFixPlaybookLines(report));
  lines.push(...buildRetrySummaryLines(report));

  const overall = report.summary.fail > 0 ? 'FAIL' : report.summary.warn > 0 ? 'WARN' : 'PASS';
  lines.push(`Preflight result: ${overall}`);
  lines.push(`Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`);
  lines.push('Limits: preflight checks path/layout/writability assumptions only; it does not prove full runtime behavior.');

  return `${lines.join('\n')}\n`;
};
