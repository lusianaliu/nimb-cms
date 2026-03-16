import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mkProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase209-'));

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
    name: 'phase-209-site',
    runtime: { mode: 'production' },
    admin: { enabled: true }
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'config.json'), `${JSON.stringify({
    installed: false,
    version: '0.1.0',
    installedAt: null
  }, null, 2)}\n`);
};

test('phase 209: verify output includes bounded post-startup reachability triage block', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'verify', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Post-startup reachability triage \(bounded\):/);
  assert.match(result.stdout, /First separate startup from reachability/i);
  assert.match(result.stdout, /cannot be universally verified by this command/i);
  assert.match(result.stdout, /proxy\/panel\/container/i);
});

test('phase 209: guide output includes startup-vs-reachability split and escalation cue', () => {
  const projectRoot = mkProjectRoot();

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'guide', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /If startup looks successful but site\/admin is unreachable/);
  assert.match(result.stdout, /If process exits\/crashes: treat as startup failure/i);
  assert.match(result.stdout, /local host\/port first/i);
  assert.match(result.stdout, /npx nimb doctor reachability/);
  assert.match(result.stdout, /npx nimb preflight --json > nimb-preflight-report.json/);
});
