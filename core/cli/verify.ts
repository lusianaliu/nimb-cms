import { deriveRetryDecisionPath, type PreflightFinding, type PreflightReport, runPreflightDiagnostics } from './preflight.ts';

export type BaselineReadiness = 'READY_TO_TRY_RUN' | 'STOP_AND_FIX_FIRST' | 'ESCALATE_NOW';

export type VerificationCheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_APPLICABLE';

export type VerificationCheck = {
  id: string;
  label: string;
  status: VerificationCheckStatus;
  detail: string;
};

export type BaselineVerificationReport = {
  projectRoot: string;
  readiness: BaselineReadiness;
  recommendation: string;
  firstRunHandoff: {
    immediateNextStep: string;
    meaningOfReady: string;
    notGuaranteed: string;
    ifStartupFails: string[];
    environmentContexts: string[];
    reachabilityTriage: {
      whenToUse: string;
      checklist: string[];
      environmentSpecificBoundary: string;
      escalateWhen: string[];
    };
    escalationWhen: string[];
  };
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  verifiedChecks: VerificationCheck[];
  notVerified: string[];
  escalationBoundaries: string[];
  preflight: PreflightReport;
};

const findWorstStatus = ({ findings, codePrefixes = [], codeExact = [] }: { findings: PreflightFinding[]; codePrefixes?: string[]; codeExact?: string[] }): VerificationCheckStatus => {
  const matches = findings.filter((finding) => codeExact.includes(finding.code) || codePrefixes.some((prefix) => finding.code.startsWith(prefix)));

  if (matches.length === 0) {
    return 'NOT_APPLICABLE';
  }

  if (matches.some((finding) => finding.severity === 'FAIL')) {
    return 'FAIL';
  }

  if (matches.some((finding) => finding.severity === 'WARN')) {
    return 'WARN';
  }

  return 'PASS';
};

const formatCheckDetail = (status: VerificationCheckStatus, passText: string, warnText: string, failText: string, notApplicableText: string) => {
  if (status === 'PASS') {
    return passText;
  }

  if (status === 'WARN') {
    return warnText;
  }

  if (status === 'FAIL') {
    return failText;
  }

  return notApplicableText;
};

export const deriveBaselineVerificationReport = (preflight: PreflightReport): BaselineVerificationReport => {
  const decision = deriveRetryDecisionPath(preflight);

  const readiness: BaselineReadiness = preflight.summary.fail === 0
    ? 'READY_TO_TRY_RUN'
    : decision.askSupportNow
      ? 'ESCALATE_NOW'
      : 'STOP_AND_FIX_FIRST';

  const recommendation = readiness === 'READY_TO_TRY_RUN'
    ? 'Baseline assumptions look satisfied. You can try startup now: npx nimb'
    : readiness === 'STOP_AND_FIX_FIRST'
      ? 'Baseline is not verified. Stop and fix FAIL findings first, then re-run: npx nimb verify'
      : 'Baseline is outside safe operator assumptions for self-service repair. Escalate with JSON handoff: npx nimb preflight --json > nimb-preflight-report.json';

  const immediateNextStep = readiness === 'READY_TO_TRY_RUN'
    ? 'Run startup now from this project root: npx nimb'
    : readiness === 'STOP_AND_FIX_FIRST'
      ? 'Do not start yet. Fix FAIL findings, then re-run: npx nimb verify'
      : 'Do not keep retrying startup. Export JSON and escalate now: npx nimb preflight --json > nimb-preflight-report.json';

  const ifStartupFails = [
    'Re-run baseline check once: npx nimb verify',
    'If verify is no longer READY_TO_TRY_RUN, fix reported FAIL findings first.',
    'If verify stays READY_TO_TRY_RUN but startup/reachability still fails, treat as runtime/deployment-layer issue and escalate with preflight JSON handoff.'
  ];

  const environmentContexts = [
    'Local/dev-like process run: try npx nimb in the project root and open /admin after startup.',
    'Container/process-manager/proxy context: verify app process starts first, then confirm host/port/proxy route actually forwards traffic to Nimb.',
    'Shared-host/panel-like context: platform policy may control writable paths, process model, or routing; escalate when those controls block startup/reachability.'
  ];

  const reachabilityTriageChecklist = [
    'First separate startup from reachability: if npx nimb exits/crashes, treat as startup/runtime failure and inspect startup error + logs/runtime-error.log.',
    'If process stays up and reports Ready/Port, check the same host first (for example http://127.0.0.1:<port>/ and /admin).',
    'If local host:port works but external/admin URL does not, treat as environment routing mismatch (proxy, panel domain mapping, container port publish/forward).',
    'Run one bounded re-check cycle only: npx nimb verify, then one startup retry. If still READY_TO_TRY_RUN but unreachable, escalate with JSON handoff instead of repeated retries.'
  ];

  const verifiedChecks: VerificationCheck[] = [
    {
      id: 'project-root',
      label: 'Project root resolves to a usable directory',
      status: findWorstStatus({ findings: preflight.findings, codePrefixes: ['project-root-'] }),
      detail: ''
    },
    {
      id: 'config-load',
      label: 'Config can be loaded for startup assumptions',
      status: findWorstStatus({ findings: preflight.findings, codePrefixes: ['config-'] }),
      detail: ''
    },
    {
      id: 'install-state',
      label: 'Install-state source is readable as valid JSON',
      status: findWorstStatus({ findings: preflight.findings, codePrefixes: ['install-state-'] }),
      detail: ''
    },
    {
      id: 'runtime-writable-paths',
      label: 'Runtime writable paths are usable (data/*, logs)',
      status: findWorstStatus({ findings: preflight.findings, codeExact: ['required-directory-writable', 'required-directory-parent', 'required-directory-missing', 'required-directory-shape'] }),
      detail: ''
    },
    {
      id: 'startup-port',
      label: 'Configured startup port can be bound',
      status: findWorstStatus({ findings: preflight.findings, codePrefixes: ['startup-port-'] }),
      detail: ''
    }
  ];

  for (const check of verifiedChecks) {
    check.detail = formatCheckDetail(
      check.status,
      'Check passed in current environment.',
      'Check has warnings; review before production deployment.',
      'Check failed; this blocks baseline verification.',
      'Check was not applicable in this run.'
    );
  }

  return {
    projectRoot: preflight.projectRoot,
    readiness,
    recommendation,
    firstRunHandoff: {
      immediateNextStep,
      meaningOfReady: 'READY_TO_TRY_RUN means baseline preflight assumptions passed right now and a first startup attempt is justified.',
      notGuaranteed: 'It does not prove full runtime behavior, plugin/theme correctness, or platform-specific routing/proxy policy.',
      ifStartupFails,
      environmentContexts,
      reachabilityTriage: {
        whenToUse: 'Use this when Nimb appears to start but the site/admin URL is still not reachable as expected.',
        checklist: reachabilityTriageChecklist,
        environmentSpecificBoundary: 'External reachability depends on deployment environment routing/policy and cannot be universally verified by this command.',
        escalateWhen: [
          'Process stays up, verify remains READY_TO_TRY_RUN, and expected URL is still unreachable after one careful retry cycle.',
          'You cannot inspect or change proxy/panel/container publish-forward settings directly in your environment.',
          'You cannot explain host/port route mapping with confidence after the bounded checklist.'
        ]
      },
      escalationWhen: [
        'Startup or reachability still fails after one careful verify + startup retry cycle.',
        'Port/proxy/process policy is managed by container, host panel, or platform and you cannot change it directly.',
        'JSON/state values or filesystem ownership constraints remain unclear after one targeted fix attempt.'
      ]
    },
    summary: preflight.summary,
    verifiedChecks,
    notVerified: [
      'It does not guarantee full runtime behavior after startup.',
      'It does not prove plugin/theme business logic correctness.',
      'It does not prove shared-host/container routing/proxy policy compatibility.'
    ],
    escalationBoundaries: [
      'Escalate when JSON/state values are unclear after one careful fix attempt.',
      'Escalate when port policy or filesystem ownership is controlled by hosting/platform policy.',
      'Escalate when FAIL findings persist after targeted fixes and re-verification.'
    ],
    preflight
  };
};

export const runBaselineVerification = async ({ projectRoot, runtimeRoot, env = process.env }: { projectRoot: string; runtimeRoot: string; env?: NodeJS.ProcessEnv }) => {
  const preflight = await runPreflightDiagnostics({ projectRoot, runtimeRoot, env });
  return deriveBaselineVerificationReport(preflight);
};

const formatCheckLine = (check: VerificationCheck) => `- [${check.status}] ${check.label} — ${check.detail}`;

export const formatBaselineVerificationReport = (report: BaselineVerificationReport) => {
  const lines: string[] = [];
  lines.push('Nimb Known-Good Baseline Verification');
  lines.push(`project: ${report.projectRoot}`);
  lines.push('');
  lines.push(`Baseline readiness: ${report.readiness}`);
  lines.push(`Recommendation: ${report.recommendation}`);
  lines.push(`Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`);
  lines.push('');
  lines.push('Verified assumptions (bounded checks):');

  for (const check of report.verifiedChecks) {
    lines.push(formatCheckLine(check));
  }

  lines.push('');
  lines.push('Not verified by this command:');
  for (const item of report.notVerified) {
    lines.push(`- ${item}`);
  }

  lines.push('');
  lines.push('Escalate now when:');
  for (const item of report.escalationBoundaries) {
    lines.push(`- ${item}`);
  }

  lines.push('');
  lines.push('First-run startup handoff:');
  lines.push(`- Next step: ${report.firstRunHandoff.immediateNextStep}`);
  lines.push(`- What READY_TO_TRY_RUN means: ${report.firstRunHandoff.meaningOfReady}`);
  lines.push(`- What it does not prove: ${report.firstRunHandoff.notGuaranteed}`);
  lines.push('- If startup still fails:');
  for (const step of report.firstRunHandoff.ifStartupFails) {
    lines.push(`  - ${step}`);
  }
  lines.push('- Common deployment contexts (illustrative, not exhaustive):');
  for (const context of report.firstRunHandoff.environmentContexts) {
    lines.push(`  - ${context}`);
  }
  lines.push('- Post-startup reachability triage (bounded):');
  lines.push(`  - When to use: ${report.firstRunHandoff.reachabilityTriage.whenToUse}`);
  lines.push('  - Checklist:');
  for (const item of report.firstRunHandoff.reachabilityTriage.checklist) {
    lines.push(`    - ${item}`);
  }
  lines.push(`  - Environment boundary: ${report.firstRunHandoff.reachabilityTriage.environmentSpecificBoundary}`);
  lines.push('  - Escalate when:');
  for (const item of report.firstRunHandoff.reachabilityTriage.escalateWhen) {
    lines.push(`    - ${item}`);
  }
  lines.push('- Escalate instead of blind retries when:');
  for (const boundary of report.firstRunHandoff.escalationWhen) {
    lines.push(`  - ${boundary}`);
  }

  lines.push('');
  lines.push('If not ready: fix FAIL findings with setup/preflight guidance, then re-run verify.');
  lines.push('JSON handoff for support: npx nimb preflight --json > nimb-preflight-report.json');

  return `${lines.join('\n')}\n`;
};

export const formatBaselineVerificationReportJson = (report: BaselineVerificationReport) => `${JSON.stringify({
  projectRoot: report.projectRoot,
  readiness: report.readiness,
  recommendation: report.recommendation,
  firstRunHandoff: report.firstRunHandoff,
  summary: report.summary,
  verifiedChecks: report.verifiedChecks,
  notVerified: report.notVerified,
  escalationBoundaries: report.escalationBoundaries,
  preflight: {
    result: report.preflight.summary.fail > 0 ? 'FAIL' : report.preflight.summary.warn > 0 ? 'WARN' : 'PASS',
    exitCode: report.preflight.exitCode,
    findings: report.preflight.findings
  }
}, null, 2)}\n`;
