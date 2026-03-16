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
  lines.push('If not ready: fix FAIL findings with setup/preflight guidance, then re-run verify.');
  lines.push('JSON handoff for support: npx nimb preflight --json > nimb-preflight-report.json');

  return `${lines.join('\n')}\n`;
};

export const formatBaselineVerificationReportJson = (report: BaselineVerificationReport) => `${JSON.stringify({
  projectRoot: report.projectRoot,
  readiness: report.readiness,
  recommendation: report.recommendation,
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
