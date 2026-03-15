import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_STARTUP_PREFLIGHT_INVARIANTS, getSharedInvariant } from '../core/invariants/startup-preflight-invariants.ts';
import { runPreflightDiagnostics } from '../core/cli/preflight.ts';
import { validateDataDirectoryWritable } from '../core/bootstrap/startup-invariants.ts';
import { assertValidStartupPort, formatStartupPortInvariantFailure } from '../core/invariants/startup-port.ts';
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

  const installStateConfigJson = getSharedInvariant('installStateConfigJson');
  assert.equal(installStateConfigJson.id, 'install-state-config-json');
  assert.equal(installStateConfigJson.severityIntent.preflight.warn, 'WARN');

  const dataDirectoryWritable = getSharedInvariant('dataDirectoryWritable');
  assert.equal(dataDirectoryWritable.id, 'data-directory-writable');
  assert.equal(dataDirectoryWritable.severityIntent.startup, 'FAIL');

  const persistenceDirectoryWritable = getSharedInvariant('persistenceDirectoryWritable');
  assert.equal(persistenceDirectoryWritable.id, 'persistence-directory-writable');

  const logsDirectoryWritable = getSharedInvariant('logsDirectoryWritable');
  assert.equal(logsDirectoryWritable.id, 'logs-directory-writable');

  assert.deepEqual(Object.keys(SHARED_STARTUP_PREFLIGHT_INVARIANTS).sort(), [
    'adminStaticDir',
    'dataDirectoryWritable',
    'installStateConfigJson',
    'logsDirectoryWritable',
    'persistenceDirectoryWritable',
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
    runtimeRoot: projectRoot
  });

  const adminCheck = report.findings.find((finding) => finding.code.startsWith('admin-static-') || finding.code === 'admin-static-dir');
  assert.equal(adminCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir.title);

  const runtimeJsonCheck = report.findings.find((finding) => finding.code === 'persistence-runtime-invalid-json');
  assert.equal(runtimeJsonCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson.title);
  assert.equal(runtimeJsonCheck?.why, SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceRuntimeJson.why);

  const portCheck = report.findings.find((finding) => finding.code === 'startup-port-available');
  assert.equal(portCheck?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.startupPort.title);
});


test('phase 184: preflight uses shared invariant metadata for install-state and writable directories', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.rmSync(path.join(projectRoot, 'data', 'system', 'config.json'), { force: true });

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const installStateFinding = report.findings.find((finding) => finding.code === 'install-state-missing');
  assert.equal(installStateFinding?.check, SHARED_STARTUP_PREFLIGHT_INVARIANTS.installStateConfigJson.title);
  assert.equal(installStateFinding?.why, SHARED_STARTUP_PREFLIGHT_INVARIANTS.installStateConfigJson.why);

  const logsWritableFinding = report.findings.find(
    (finding) => finding.code === 'required-directory-writable' && finding.check === 'logs writable'
  );
  assert.equal(logsWritableFinding?.why, SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable.why);
});


test('phase 184: startup data directory writability failure uses shared invariant id', () => {
  const projectRoot = mkProjectRoot();
  fs.mkdirSync(path.join(projectRoot, 'data'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'data', 'content'), 'not-a-directory\n');

  assert.throws(
    () => validateDataDirectoryWritable({
      dataDir: path.join(projectRoot, 'data'),
      dataSystemDir: path.join(projectRoot, 'data', 'system'),
      dataContentDir: path.join(projectRoot, 'data', 'content'),
      dataUploadsDir: path.join(projectRoot, 'data', 'uploads')
    }),
    /Startup invariant failed \[data-directory-writable\]/
  );
});

test('phase 185: preflight severity for shared admin/install-state checks follows registry intent', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const reportWithDefaultAdminFallback = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const adminFallbackFinding = reportWithDefaultAdminFallback.findings.find((finding) => finding.code === 'admin-static-fallback');
  assert.equal(adminFallbackFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir.severityIntent.preflight.warn);

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase-185-site',
    runtime: { mode: 'production' },
    admin: { enabled: true, staticDir: './ui/custom-admin' }
  }, null, 2)}\n`);

  const reportWithConfiguredAdminPath = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const adminConfiguredMissingFinding = reportWithConfiguredAdminPath.findings.find((finding) => finding.code === 'admin-static-configured-missing');
  assert.equal(adminConfiguredMissingFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.adminStaticDir.severityIntent.preflight.fail);

  fs.rmSync(path.join(projectRoot, 'data', 'system', 'config.json'), { force: true });

  const reportMissingInstallState = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const installStateMissingFinding = reportMissingInstallState.findings.find((finding) => finding.code === 'install-state-missing');
  assert.equal(installStateMissingFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.installStateConfigJson.severityIntent.preflight.warn);
});


test('phase 186: shared startup-port helper enforces canonical invariant failure text', () => {
  assert.equal(formatStartupPortInvariantFailure('port is unavailable: 3000'), 'Startup invariant failed [startup-port]: port is unavailable: 3000');

  assert.equal(assertValidStartupPort(3000, 'port'), 3000);

  assert.throws(
    () => assertValidStartupPort(-1, 'PORT environment variable'),
    /Startup invariant failed \[startup-port\]: invalid PORT environment variable: -1/
  );
});

test('phase 186: preflight startup-port finding detail reuses canonical invalid-port invariant text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot,
    env: { ...process.env, PORT: 'not-a-number' }
  });

  const portFinding = report.findings.find((finding) => finding.code === 'startup-port-invalid-or-unavailable');
  assert.equal(portFinding?.severity, 'FAIL');
  assert.match(portFinding?.detail ?? '', /Startup invariant failed \[startup-port\]: invalid PORT environment variable: NaN/);
});
