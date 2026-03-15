import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_STARTUP_PREFLIGHT_INVARIANTS, getSharedInvariant } from '../core/invariants/startup-preflight-invariants.ts';
import { runPreflightDiagnostics } from '../core/cli/preflight.ts';
import { validateAdminStaticDir, validateDataDirectoryWritable } from '../core/bootstrap/startup-invariants.ts';
import { assertValidStartupPort, formatStartupPortInvariantFailure } from '../core/invariants/startup-port.ts';
import { formatPersistenceRuntimeJsonInvariantFailure } from '../core/invariants/persistence-runtime-json.ts';
import {
  formatDirectoryMissingWithWritableParentDetail,
  formatDirectoryParentNotWritableInvariantFailure,
  formatDirectoryShapeInvariantFailure,
  formatDirectoryUnresolvedParentInvariantFailure,
  formatDirectoryWritabilityInvariantFailure
} from '../core/invariants/directory-writability.ts';
import { ADMIN_STATIC_DIR_INVARIANT, formatAdminStaticDirInvariantFailure } from '../core/invariants/admin-static-dir.ts';
import { formatWritableDirectoryRemediation } from '../core/invariants/remediation-fragments.ts';
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


test('phase 187: shared persistence-runtime helper enforces canonical invariant failure text', () => {
  assert.equal(
    formatPersistenceRuntimeJsonInvariantFailure('persistence file is invalid JSON: /tmp/runtime.json'),
    'Startup invariant failed [persistence-runtime-json]: persistence file is invalid JSON: /tmp/runtime.json'
  );
});

test('phase 187: preflight persistence-runtime invalid JSON detail reuses canonical invariant text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'runtime.json'), '{broken-json');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const runtimeJsonCheck = report.findings.find((finding) => finding.code === 'persistence-runtime-invalid-json');
  assert.equal(runtimeJsonCheck?.severity, 'FAIL');
  assert.equal(
    runtimeJsonCheck?.detail,
    formatPersistenceRuntimeJsonInvariantFailure(
      `persistence file is invalid JSON: ${path.join(projectRoot, 'data', 'system', 'runtime.json')}`
    )
  );
});


test('phase 188: shared writable-directory helper enforces canonical invariant failure text', () => {
  assert.equal(
    formatDirectoryWritabilityInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      'logs directory is not writable: /tmp/logs'
    ),
    'Startup invariant failed [logs-directory-writable]: logs directory is not writable: /tmp/logs'
  );
});

test('phase 188: startup data-directory writability failure detail reuses canonical helper text', () => {
  const projectRoot = mkProjectRoot();
  fs.mkdirSync(path.join(projectRoot, 'data'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'data', 'content'), 'not-a-directory\n');

  const expectedMessage = formatDirectoryWritabilityInvariantFailure(
    SHARED_STARTUP_PREFLIGHT_INVARIANTS.dataDirectoryWritable,
    `data directory is not writable: ${path.join(projectRoot, 'data')}`
  );

  try {
    validateDataDirectoryWritable({
      dataDir: path.join(projectRoot, 'data'),
      dataSystemDir: path.join(projectRoot, 'data', 'system'),
      dataContentDir: path.join(projectRoot, 'data', 'content'),
      dataUploadsDir: path.join(projectRoot, 'data', 'uploads')
    });
    assert.fail('Expected startup data-directory writability check to throw');
  } catch (error) {
    assert.equal(error instanceof Error ? error.message : String(error), expectedMessage);
  }
});


test('phase 188: preflight required-directory writable failure detail uses canonical helper text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const logsPath = path.join(projectRoot, 'logs');
  fs.rmSync(logsPath, { recursive: true, force: true });
  fs.symlinkSync('/proc', logsPath, 'dir');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const logsWritableFinding = report.findings.find(
    (finding) => finding.code === 'required-directory-writable' && finding.check === 'logs writable'
  );

  assert.equal(logsWritableFinding?.severity, 'FAIL');
  assert.equal(
    logsWritableFinding?.detail,
    formatDirectoryWritabilityInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      `logs directory is not writable: ${logsPath}`
    )
  );
});


test('phase 189: shared admin-static-dir helper enforces canonical invariant failure text', () => {
  assert.equal(ADMIN_STATIC_DIR_INVARIANT.id, 'admin-static-dir');
  assert.equal(
    formatAdminStaticDirInvariantFailure('admin staticDir does not exist: /tmp/ui/admin'),
    'Startup invariant failed [admin-static-dir]: admin staticDir does not exist: /tmp/ui/admin'
  );
});

test('phase 189: startup admin staticDir failure detail reuses canonical helper text', () => {
  const projectRoot = mkProjectRoot();

  const expectedMessage = formatAdminStaticDirInvariantFailure(
    `admin staticDir does not exist: ${path.join(projectRoot, 'ui', 'custom-admin')}`
  );

  try {
    validateAdminStaticDir(
      {
        admin: {
          enabled: true,
          staticDir: './ui/custom-admin'
        }
      },
      projectRoot
    );
    assert.fail('Expected startup admin staticDir check to throw');
  } catch (error) {
    assert.equal(error instanceof Error ? error.message : String(error), expectedMessage);
  }
});

test('phase 189: preflight configured admin staticDir missing/detail shape reuse canonical helper text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase-189-site',
    runtime: { mode: 'production' },
    admin: { enabled: true, staticDir: './ui/custom-admin' }
  }, null, 2)}\n`);

  const missingReport = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const missingFinding = missingReport.findings.find((finding) => finding.code === 'admin-static-configured-missing');
  assert.equal(
    missingFinding?.detail,
    formatAdminStaticDirInvariantFailure(`admin staticDir does not exist: ${path.join(projectRoot, 'ui', 'custom-admin')}`)
  );

  fs.mkdirSync(path.join(projectRoot, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'ui', 'custom-admin'), 'not-a-directory\n');

  const shapeReport = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const shapeFinding = shapeReport.findings.find((finding) => finding.code === 'admin-static-dir-shape');
  assert.equal(
    shapeFinding?.detail,
    formatAdminStaticDirInvariantFailure(`admin staticDir is not a directory: ${path.join(projectRoot, 'ui', 'custom-admin')}`)
  );
});


test('phase 190: shared directory-shape helper enforces canonical invariant failure text', () => {
  assert.equal(
    formatDirectoryShapeInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      'logs',
      '/tmp/logs'
    ),
    'Startup invariant failed [logs-directory-writable]: logs path is not a directory: /tmp/logs'
  );
});

test('phase 190: preflight required-directory shape detail reuses canonical helper text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const logsPath = path.join(projectRoot, 'logs');
  fs.rmSync(logsPath, { recursive: true, force: true });
  fs.writeFileSync(logsPath, 'not-a-directory\n');

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const logsShapeFinding = report.findings.find(
    (finding) => finding.code === 'required-directory-shape' && finding.check === 'logs path shape'
  );

  assert.equal(logsShapeFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable.severityIntent.preflight.fail);
  assert.equal(
    logsShapeFinding?.detail,
    formatDirectoryShapeInvariantFailure(SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable, 'logs', logsPath)
  );
});


test('phase 191: shared parent-not-writable helper enforces canonical invariant failure text', () => {
  assert.equal(
    formatDirectoryParentNotWritableInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      '/tmp/site/logs',
      '/tmp/site'
    ),
    'Startup invariant failed [logs-directory-writable]: /tmp/site/logs is missing and parent path /tmp/site is not writable.'
  );
});

test('phase 191: preflight required-directory parent-path writable failure detail reuses canonical helper text', async () => {
  const projectRoot = '/sys';

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const logsPath = path.join(projectRoot, 'logs');

  const logsParentFinding = report.findings.find(
    (finding) => finding.code === 'required-directory-parent' && finding.check === 'logs parent path writable'
  );

  assert.equal(logsParentFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable.severityIntent.preflight.fail);
  assert.equal(
    logsParentFinding?.detail,
    formatDirectoryParentNotWritableInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      logsPath,
      projectRoot
    )
  );
});

test('phase 192: shared unresolved-parent helper enforces canonical invariant failure text', () => {
  assert.equal(
    formatDirectoryUnresolvedParentInvariantFailure(
      SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
      '/tmp/site/logs'
    ),
    'Startup invariant failed [logs-directory-writable]: Unable to resolve an existing parent path for /tmp/site/logs.'
  );
});

test('phase 192: preflight required-directory unresolved-parent detail reuses canonical helper text', async () => {
  const projectRoot = '/tmp/nimb-phase192-unresolved-parent';
  const originalExistsSync = fs.existsSync;

  fs.existsSync = () => false;

  try {
    const report = await runPreflightDiagnostics({
      projectRoot,
      runtimeRoot: projectRoot
    });

    const logsPath = path.join(projectRoot, 'logs');

    const logsParentFinding = report.findings.find(
      (finding) => finding.code === 'required-directory-parent' && finding.check === 'logs parent path'
    );

    assert.equal(logsParentFinding?.severity, SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable.severityIntent.preflight.fail);
    assert.equal(
      logsParentFinding?.detail,
      formatDirectoryUnresolvedParentInvariantFailure(
        SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable,
        logsPath
      )
    );
  } finally {
    fs.existsSync = originalExistsSync;
  }
});



test('phase 193: shared missing-directory helper enforces canonical writable-parent detail text', () => {
  assert.equal(
    formatDirectoryMissingWithWritableParentDetail(
      '/tmp/site/logs',
      '/tmp/site'
    ),
    '/tmp/site/logs is missing, but parent path /tmp/site appears writable so startup can create it.'
  );
});

test('phase 193: preflight required-directory missing detail reuses shared writable-parent helper text', async () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const logsPath = path.join(projectRoot, 'logs');
  fs.rmSync(logsPath, { recursive: true, force: true });

  const report = await runPreflightDiagnostics({
    projectRoot,
    runtimeRoot: projectRoot
  });

  const logsMissingFinding = report.findings.find(
    (finding) => finding.code === 'required-directory-missing' && finding.check === 'logs exists'
  );

  assert.equal(logsMissingFinding?.severity, 'WARN');
  assert.equal(
    logsMissingFinding?.detail,
    formatDirectoryMissingWithWritableParentDetail(logsPath, projectRoot)
  );
});

test('phase 194: shared writable-directory remediation fragment keeps project-root fallback wording aligned', () => {
  assert.equal(
    formatWritableDirectoryRemediation('logs/'),
    'Grant write permissions for logs/, or choose a writable project root.'
  );
});

test('phase 194: writable-directory invariants reuse shared remediation fragment wording', () => {
  assert.equal(
    SHARED_STARTUP_PREFLIGHT_INVARIANTS.dataDirectoryWritable.remediation,
    formatWritableDirectoryRemediation('data/, data/system, data/content, and data/uploads')
  );
  assert.equal(
    SHARED_STARTUP_PREFLIGHT_INVARIANTS.persistenceDirectoryWritable.remediation,
    formatWritableDirectoryRemediation('the persistence directory (canonical path: data/system)')
  );
  assert.equal(
    SHARED_STARTUP_PREFLIGHT_INVARIANTS.logsDirectoryWritable.remediation,
    formatWritableDirectoryRemediation('logs/')
  );
});
