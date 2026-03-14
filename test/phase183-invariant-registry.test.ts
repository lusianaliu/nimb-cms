import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_STARTUP_PREFLIGHT_INVARIANTS, getSharedInvariant } from '../core/invariants/startup-preflight-invariants.ts';
import { runPreflightDiagnostics } from '../core/cli/preflight.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mkProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase183-'));

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
    name: 'phase-183-site',
    runtime: { mode: 'production' },
    admin: { enabled: true }
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'config.json'), `${JSON.stringify({
    installed: false,
    version: '0.1.0',
    installedAt: null
  }, null, 2)}\n`);
};

test('phase 183: shared invariant registry exposes canonical metadata for aligned startup/preflight checks', () => {
  const adminStaticDir = getSharedInvariant('adminStaticDir');
  const persistenceRuntimeJson = getSharedInvariant('persistenceRuntimeJson');
  const startupPort = getSharedInvariant('startupPort');

  assert.equal(adminStaticDir.id, 'admin-static-dir');
  assert.equal(adminStaticDir.title, 'Admin static directory');
  assert.equal(adminStaticDir.severityIntent.preflight.fail, 'FAIL');
  assert.equal(adminStaticDir.severityIntent.preflight.warn, 'WARN');

  assert.equal(persistenceRuntimeJson.id, 'persistence-runtime-json');
  assert.equal(persistenceRuntimeJson.severityIntent.startup, 'FAIL');

  assert.equal(startupPort.id, 'startup-port');
  assert.equal(startupPort.severityIntent.preflight.fail, 'FAIL');

  assert.deepEqual(Object.keys(SHARED_STARTUP_PREFLIGHT_INVARIANTS).sort(), [
    'adminStaticDir',
    'persistenceRuntimeJson',
    'startupPort'
  ]);
});

test('phase 183: preflight uses shared invariant titles for aligned checks', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'runtime.json'), '{broken-json');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: '/workspace/nimb-cms'
  });

  const adminCheck = report.findings.find((finding) => finding.code.startsWith('admin-static-') || finding.code === 'admin-static-dir');
  assert.equal(adminCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir.title);

  const runtimeJsonCheck = report.findings.find((finding) => finding.code === 'persistence-runtime-invalid-json');
  assert.equal(runtimeJsonCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson.title);
  assert.equal(runtimeJsonCheck?.why, SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson.why);

  const portCheck = report.findings.find((finding) => finding.code === 'startup-port-available');
  assert.equal(portCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.startupPort.title);
});
