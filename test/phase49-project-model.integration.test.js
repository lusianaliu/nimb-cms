import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createProjectModel } from '../core/project/index.ts';

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
