import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase200-'));

const initProject = (cwd, projectName = 'phase200-site') => {
  const projectRoot = path.join(cwd, projectName);
  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'init', projectName], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  return projectRoot;
};

test('phase 200: setup command creates missing canonical directories and runs preflight handoff', () => {
  const cwd = mkdtemp();
  const projectRoot = initProject(cwd);

  fs.rmSync(path.join(projectRoot, 'themes'), { recursive: true, force: true });
  fs.rmSync(path.join(projectRoot, 'public'), { recursive: true, force: true });
  fs.rmSync(path.join(projectRoot, 'data', 'uploads'), { recursive: true, force: true });

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'setup', '--project-root', projectRoot], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Nimb Guided Setup/);
  assert.match(result.stdout, /Created directories:/);
  assert.match(result.stdout, /- themes/);
  assert.match(result.stdout, /- public/);
  assert.match(result.stdout, /- data\/uploads/);
  assert.match(result.stdout, /Running deployment preflight/);
  assert.match(result.stdout, /Nimb Deployment Preflight/);
  assert.match(result.stdout, /Setup next step:/);

  assert.equal(fs.statSync(path.join(projectRoot, 'themes')).isDirectory(), true);
  assert.equal(fs.statSync(path.join(projectRoot, 'public')).isDirectory(), true);
  assert.equal(fs.statSync(path.join(projectRoot, 'data', 'uploads')).isDirectory(), true);
});

test('phase 200: setup command reports manual action for non-directory path conflicts and exits non-zero', () => {
  const cwd = mkdtemp();
  const projectRoot = initProject(cwd, 'phase200-conflict-site');

  fs.rmSync(path.join(projectRoot, 'logs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(projectRoot, 'logs'), 'not-a-directory\n', 'utf8');

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'setup', '--project-root', projectRoot], {
    cwd,
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /Manual action required:/);
  assert.match(result.stdout, /- logs exists as a non-directory path or could not be created safely\./);
  assert.match(result.stdout, /\[FAIL\] logs path shape/);
  assert.match(result.stdout, /Resolve FAIL findings and any manual-action paths listed above/);
});
