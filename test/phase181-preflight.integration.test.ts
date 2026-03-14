import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runPreflightDiagnostics } from '../core/cli/preflight.ts';

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

test('phase 181: preflight returns success exit code when only pass/warn findings exist', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const report = runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 0);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.findings.some((finding) => finding.severity === 'PASS'), true);
});

test('phase 181: preflight marks non-directory required path as failure', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'data', 'content'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'data', 'content'), 'not a directory\n');

  const report = runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  assert.equal(report.exitCode, 1);
  assert.equal(report.findings.some((finding) => finding.code === 'required-directory-shape' && finding.severity === 'FAIL'), true);
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
  assert.match(result.stdout, /Preflight result: FAIL/);
});
