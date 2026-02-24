import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createProjectModel, createProjectPaths } from '../core/project/index.ts';

test('phase 49: project model resolves canonical project boundaries from project root', () => {
  const projectRoot = '/tmp/nimb-example/site-a';
  const project = createProjectModel({ projectRoot });

  assert.equal(project.root, path.resolve(projectRoot));
  assert.equal(project.configFile, path.join(project.root, 'nimb.config.json'));
  assert.equal(project.contentDirectory, path.join(project.root, 'content'));
  assert.equal(project.dataDirectory, path.join(project.root, 'data'));
  assert.equal(project.pluginsDirectory, path.join(project.root, 'plugins'));
  assert.equal(project.themesDirectory, path.join(project.root, 'themes'));
  assert.equal(project.publicDirectory, path.join(project.root, 'public'));
  assert.equal(project.persistenceDirectory, path.join(project.root, '.nimb'));
  assert.equal(project.buildDirectory, path.join(project.root, '.nimb-build'));
});

test('phase 49: project paths resolve canonical absolute directories', () => {
  const projectRoot = '/tmp/nimb-example/site-a';
  const paths = createProjectPaths(projectRoot);

  assert.equal(paths.projectRoot, path.resolve(projectRoot));
  assert.equal(paths.configDir, path.join(paths.projectRoot, 'config'));
  assert.equal(paths.dataDir, path.join(paths.projectRoot, 'data'));
  assert.equal(paths.pluginsDir, path.join(paths.projectRoot, 'plugins'));
  assert.equal(paths.themesDir, path.join(paths.projectRoot, 'themes'));
  assert.equal(paths.persistenceDir, path.join(paths.projectRoot, '.nimb'));
  assert.equal(paths.publicDir, path.join(paths.projectRoot, 'public'));
  assert.equal(Object.isFrozen(paths), true);
});
