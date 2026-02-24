import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProjectModel, isProjectInstalled, readInstallState } from '../core/project/index.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase52-'));

const createInstallState = (projectRoot, content) => {
  const nimbDir = path.join(projectRoot, '.nimb');
  fs.mkdirSync(nimbDir, { recursive: true });
  fs.writeFileSync(path.join(nimbDir, 'install.json'), content);
};

test('phase 52: no .nimb directory resolves not installed', () => {
  const projectRoot = mkdtemp();
  const project = createProjectModel({ projectRoot });

  assert.equal(readInstallState(project), null);
  assert.equal(isProjectInstalled(project), false);
});

test('phase 52: .nimb exists but no install.json resolves not installed', () => {
  const projectRoot = mkdtemp();
  fs.mkdirSync(path.join(projectRoot, '.nimb'), { recursive: true });
  const project = createProjectModel({ projectRoot });

  assert.equal(readInstallState(project), null);
  assert.equal(isProjectInstalled(project), false);
});

test('phase 52: valid install.json resolves installed', () => {
  const projectRoot = mkdtemp();
  createInstallState(projectRoot, `${JSON.stringify({ installed: true, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`);
  const project = createProjectModel({ projectRoot });

  assert.deepEqual(readInstallState(project), {
    installed: true,
    version: '1.0.0',
    installedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(isProjectInstalled(project), true);
});

test('phase 52: invalid install.json safely resolves not installed', () => {
  const projectRoot = mkdtemp();
  createInstallState(projectRoot, '{ invalid json }\n');
  const project = createProjectModel({ projectRoot });

  assert.equal(readInstallState(project), null);
  assert.equal(isProjectInstalled(project), false);
});

test('phase 52: install state resolution is rooted in project model path', () => {
  const firstProjectRoot = mkdtemp();
  const secondProjectRoot = mkdtemp();

  createInstallState(firstProjectRoot, `${JSON.stringify({ installed: true, version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' })}\n`);
  createInstallState(secondProjectRoot, `${JSON.stringify({ installed: true, version: '2.0.0', installedAt: '2026-02-01T00:00:00.000Z' })}\n`);

  const originalCwd = process.cwd();
  process.chdir(secondProjectRoot);

  try {
    const project = createProjectModel({ projectRoot: firstProjectRoot });
    const installState = readInstallState(project);
    assert.equal(installState?.version, '1.0.0');
    assert.equal(isProjectInstalled(project), true);
  } finally {
    process.chdir(originalCwd);
  }
});
