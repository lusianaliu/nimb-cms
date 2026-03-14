import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveProjectRootFromArgs } from '../core/cli/project-root-resolver.ts';

test('phase 180: --project-root overrides invocation cwd', () => {
  const invocationCwd = path.join(path.sep, 'srv', 'site');
  const resolved = resolveProjectRootFromArgs({
    argv: ['--project-root', 'tenant-a', 'bridge'],
    invocationCwd,
    env: {}
  });

  assert.equal(resolved.projectRoot, path.resolve(invocationCwd, 'tenant-a'));
  assert.deepEqual(resolved.args, ['bridge']);
});

test('phase 180: environment project root is used when no argument override is provided', () => {
  const invocationCwd = path.join(path.sep, 'srv', 'site');
  const resolved = resolveProjectRootFromArgs({
    argv: ['build'],
    invocationCwd,
    env: { NIMB_PROJECT_ROOT: 'tenant-b' }
  });

  assert.equal(resolved.projectRoot, path.resolve(invocationCwd, 'tenant-b'));
  assert.deepEqual(resolved.args, ['build']);
});

test('phase 180: blank project root values fall back to invocation cwd', () => {
  const invocationCwd = path.join(path.sep, 'srv', 'site');
  const resolved = resolveProjectRootFromArgs({
    argv: ['--project-root', '   ', 'build'],
    invocationCwd,
    env: { NIMB_ROOT: '   ' }
  });

  assert.equal(resolved.projectRoot, invocationCwd);
  assert.deepEqual(resolved.args, ['build']);
});
