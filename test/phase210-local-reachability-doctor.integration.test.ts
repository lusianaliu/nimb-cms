import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mkProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase210-'));

const seedBasicProject = (projectRoot: string) => {
  fs.mkdirSync(path.join(projectRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'data', 'system'), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, 'config', 'nimb.config.json'), `${JSON.stringify({
    name: 'phase-210-site',
    runtime: { mode: 'production' },
    server: { port: 3100 },
    admin: { enabled: true, basePath: '/control' }
  }, null, 2)}\n`);

  fs.writeFileSync(path.join(projectRoot, 'data', 'system', 'config.json'), `${JSON.stringify({
    installed: true,
    version: '0.1.0',
    installedAt: '2026-01-01T00:00:00.000Z'
  }, null, 2)}\n`);
};

test('phase 210: doctor reachability prints local bind/port/url expectations and boundaries', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'doctor', 'reachability', '--project-root', projectRoot], {
    encoding: 'utf8',
    env: { ...process.env, PORT: '4567' }
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Nimb Local Reachability Doctor \(local-only\)/);
  assert.match(result.stdout, /host: all local interfaces/i);
  assert.match(result.stdout, /port: 4567 \(PORT environment variable\)/i);
  assert.match(result.stdout, /http:\/\/127\.0\.0\.1:4567\/control/i);
  assert.match(result.stdout, /does NOT prove/i);
  assert.match(result.stdout, /reverse proxy, shared-host panel routing, or container publish\/forward/i);
});

test('phase 210: doctor reachability supports json output for support handoff', () => {
  const projectRoot = mkProjectRoot();
  seedBasicProject(projectRoot);

  const result = spawnSync('node', ['/workspace/nimb-cms/bin/nimb.js', 'doctor', 'reachability', '--json', '--project-root', projectRoot], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout) as {
    startup: { expectedPort: number; expectedAdminBasePath: string };
    supportHandoff: { payload: { expectedPort: number; installed: boolean } };
    localUrlsToTryFirst: string[];
  };

  assert.equal(payload.startup.expectedPort, 3100);
  assert.equal(payload.startup.expectedAdminBasePath, '/control');
  assert.equal(payload.supportHandoff.payload.expectedPort, 3100);
  assert.equal(payload.supportHandoff.payload.installed, true);
  assert.ok(payload.localUrlsToTryFirst.some((entry) => entry.includes('127.0.0.1:3100/control')));
});
