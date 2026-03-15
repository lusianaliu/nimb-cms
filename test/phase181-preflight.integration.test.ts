import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { formatPreflightReport, runPreflightDiagnostics } from '../core/cli/preflight.ts';

const mkProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase181-'));

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
    name: 'phase-181-site',
    runtime: { mode: 'production' },
    admin: { enabled: true }
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'config.json'), `${JSON.stringify({
    installed: false,
    version: '0.1.0',
    installedAt: null
  }, null, 2)}\n`);
};

test('phase 181: preflight returns success exit code when only pass/warn findings exist', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 0);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.findings.some((finding) => finding.severity === 'PASS'), true);
});

test('phase 181: preflight marks non-directory required path as failure', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'data', 'content'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'data', 'content'), 'not a directory\n');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 1);
  assert.equal(report.findings.some((finding) => finding.code === 'required-directory-shape' && finding.severity === 'FAIL'), true);
});

test('phase 182: preflight fails when configured admin staticDir is missing', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase-182-site',
    runtime: { mode: 'production' },
    admin: { enabled: true, staticDir: './admin-custom' }
  }, null, 2)}\n`);

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 1);
  assert.equal(report.findings.some((finding) => finding.code === 'admin-static-configured-missing' && finding.severity === 'FAIL'), true);
});

test('phase 182: preflight fails when persistence runtime JSON is invalid', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'runtime.json'), '{broken json');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 1);
  assert.equal(report.findings.some((finding) => finding.code === 'persistence-runtime-invalid-json' && finding.severity === 'FAIL'), true);
});

test('phase 182: preflight fails when startup port is unavailable', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const busyServer = net.createServer();
  await new Promise<void>((resolve, reject) => {
    busyServer.once('error', reject);
    busyServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = busyServer.address();
  assert.notEqual(address, null);
  const port = typeof address === 'string' ? 0 : address.port;

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms',
    env: { ...process.env, PORT: String(port) }
  });

  busyServer.close();

  assert.equal(report.exitCode, 1);
  assert.equal(report.findings.some((finding) => finding.code === 'startup-port-invalid-or-unavailable' && finding.severity === 'FAIL'), true);
});

test('phase 181: canonical preflight CLI command prints summary and uses failure exit code', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'logs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'logs'), 'not a directory\n');

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'preflight', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Nimb Deployment Preflight/);
  assert.match(result.stdout, /Change status: preflight is validation-only and does not auto-fix files or directories\./);
  assert.match(result.stdout, /Manual action required \(FAIL findings\):/);
  assert.match(result.stdout, /Project layout:/);
  assert.match(result.stdout, /operator next step: Fix path conflicts first/);
  assert.match(result.stdout, /Preflight result: FAIL/);
});

test('phase 201: preflight report groups WARN findings by remediation category with operator next steps', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'themes'), { recursive: true, force: true });

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  const formatted = formatPreflightReport(report);
  assert.match(formatted, /Warnings to review \(WARN findings\):/);
  assert.match(formatted, /Project layout:/);
  assert.match(formatted, /expected-directory-missing/);
  assert.match(formatted, /operator next step: Fix path conflicts first/);
});


test('phase 202: preflight report includes ordered retry summary with fix-first guidance', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'plugins'), { recursive: true, force: true });
  fs.rmSync(path.join(projectRoot, 'data'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'data'), 'not a directory\n');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  const formatted = formatPreflightReport(report);
  assert.match(formatted, /Retry summary:/);
  assert.match(formatted, /Fix first \(in order\):/);
  assert.match(formatted, /1\. Project layout \(1 blocker\)/);
  assert.match(formatted, /Warnings to schedule after blockers are cleared:/);
  assert.match(formatted, /- Project layout \(4 warnings\)/);
  assert.match(formatted, /Support handoff: npx nimb preflight --json > nimb-preflight-report\.json/);
});

test('phase 202: canonical preflight CLI supports --json support handoff output', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'logs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'logs'), 'not a directory\n');

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'preflight', '--json', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.result, 'FAIL');
  assert.equal(Array.isArray(parsed.retrySummary.blockingCategories), true);
  assert.equal(parsed.retrySummary.retryCommand, 'npx nimb preflight');
  assert.equal(parsed.retrySummary.blockingCategories[0].category, 'Project layout');
  assert.equal(parsed.retrySummary.blockingCategories[0].findings.some((finding: { code: string }) => finding.code === 'required-directory-shape' || finding.code === 'expected-directory-shape'), true);
});
