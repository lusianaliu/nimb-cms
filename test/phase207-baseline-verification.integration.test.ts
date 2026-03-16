import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deriveBaselineVerificationReport, formatBaselineVerificationReport, runBaselineVerification } from '../core/cli/verify.ts';
import { runPreflightDiagnostics } from '../core/cli/preflight.ts';

const mkProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase207-'));

const seedBasicProject = (projectRoot: string) => {
  fs.mkdirSync(path.join(projectRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'themes'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'public'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'data', 'system'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'data', 'content'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'data', 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'logs'), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase-207-site',
    runtime: { mode: 'production' },
    admin: { enabled: true }
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'config.json'), `${JSON.stringify({
    installed: false,
    version: '0.1.0',
    installedAt: null
  }, null, 2)}\n`);
};

test('phase 207: verify classifies ready baseline when preflight has no FAIL findings', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const report = await runBaselineVerification({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.readiness, 'READY_TO_TRY_RUN');
  assert.match(report.recommendation, /try startup now/i);
  assert.match(report.firstRunHandoff.immediateNextStep, /npx nimb/);
  assert.equal(report.firstRunHandoff.ifStartupFails.length >= 3, true);
  assert.equal(report.firstRunHandoff.environmentContexts.length, 3);
  assert.match(report.firstRunHandoff.reachabilityTriage.whenToUse, /not reachable/i);
  assert.equal(report.firstRunHandoff.reachabilityTriage.checklist.length >= 4, true);
  assert.match(report.firstRunHandoff.reachabilityTriage.environmentSpecificBoundary, /cannot be universally verified/i);
  assert.equal(report.firstRunHandoff.reachabilityTriage.escalateWhen.length >= 3, true);
  assert.equal(report.summary.fail, 0);
});

test('phase 207: verify classifies stop-and-fix for non-escalation FAIL findings', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'logs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'logs'), 'not-a-directory\n');

  const preflight = await runPreflightDiagnostics({ projectRoot, runtimeRoot: '/workspace/nimb-cms' });
  const report = deriveBaselineVerificationReport(preflight);

  assert.equal(report.readiness, 'STOP_AND_FIX_FIRST');
  assert.equal(report.verifiedChecks.some((check) => check.id === 'runtime-writable-paths' && check.status === 'FAIL'), true);

  const formatted = formatBaselineVerificationReport(report);
  assert.match(formatted, /Baseline readiness: STOP_AND_FIX_FIRST/);
  assert.match(formatted, /does not guarantee full runtime behavior/i);
  assert.match(formatted, /First-run startup handoff:/);
  assert.match(formatted, /illustrative, not exhaustive/i);
  assert.match(formatted, /Post-startup reachability triage \(bounded\):/);
  assert.match(formatted, /First separate startup from reachability/i);
});

test('phase 207: verify classifies escalation for known support-now blocker classes', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), '{broken json\n', 'utf8');

  const report = await runBaselineVerification({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.readiness, 'ESCALATE_NOW');
  assert.match(report.recommendation, /json handoff/i);
});

test('phase 207: canonical verify CLI supports --json and non-zero exit when baseline is not ready', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'logs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'logs'), 'not-a-directory\n');

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'verify', '--json', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.readiness, 'STOP_AND_FIX_FIRST');
  assert.equal(Array.isArray(parsed.verifiedChecks), true);
  assert.equal(typeof parsed.firstRunHandoff?.immediateNextStep, 'string');
  assert.equal(Array.isArray(parsed.firstRunHandoff?.ifStartupFails), true);
  assert.equal(Array.isArray(parsed.firstRunHandoff?.reachabilityTriage?.checklist), true);
  assert.equal(typeof parsed.firstRunHandoff?.reachabilityTriage?.environmentSpecificBoundary, 'string');
  assert.equal(parsed.preflight.result, 'FAIL');
});
