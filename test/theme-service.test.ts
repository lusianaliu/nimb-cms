import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeService } from '../core/theme/theme-service.ts';

test('theme service lists registered themes with safe metadata only', () => {
  const runtime = {
    settings: {
      getSettings: () => ({ theme: 'default' })
    }
  };

  const themes = createThemeService(runtime).list();

  assert.deepEqual(themes.map((theme) => theme.id), ['default', 'sunrise']);
  assert.equal(themes[0].title, 'Default');
  assert.equal(themes[0].source, 'builtin');
  assert.equal(themes[0].isDefault, true);
  assert.deepEqual(themes[0].templates, ['homepage', 'page', 'post-list', 'post-page', 'not-found']);
  assert.equal((themes[0] as { templates?: unknown }).templates instanceof Array, true);
});

test('theme service exposes configured and resolved active theme ids', () => {
  const runtime = {
    settings: {
      getSettings: () => ({ theme: 'missing-theme' })
    }
  };

  const service = createThemeService(runtime);
  const active = service.getActive();

  assert.equal(service.getConfiguredThemeId(), 'missing-theme');
  assert.equal(service.getResolvedThemeId(), 'default');
  assert.equal(active.configuredThemeId, 'missing-theme');
  assert.equal(active.resolvedThemeId, 'default');
  assert.equal(active.defaultThemeId, 'default');
  assert.equal(active.fallbackApplied, true);

  const status = service.getStatus();
  assert.equal(status.fallbackApplied, true);
  assert.equal(status.themes.length >= 2, true);
});
