import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase199-'));

test('phase 199: guide command explains canonical install and deployment path', () => {
  const projectRoot = mkdtemp();
  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'guide'], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Nimb Install & Deployment Guide/);
  assert.match(result.stdout, /npx nimb init my-site/);
  assert.match(result.stdout, /source repository root is a development environment/);
  assert.match(result.stdout, /install-state source: data\/system\/config\.json/);
  assert.match(result.stdout, /npx nimb preflight/);
  assert.match(result.stdout, /Open \/admin after startup/);
});
