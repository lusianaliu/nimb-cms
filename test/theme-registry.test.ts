import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PUBLIC_THEME_ID,
  getBuiltinPublicThemeRecord,
  isRegisteredPublicThemeId,
  listBuiltinPublicThemes,
  resolvePublicThemeId
} from '../core/theme/theme-registry.ts';

test('theme registry exposes default and sunrise as builtin themes', () => {
  const themes = listBuiltinPublicThemes();

  assert.deepEqual(themes.map((theme) => theme.id), ['default', 'sunrise']);
  assert.equal(themes[0].isDefault, true);
  assert.equal(themes[0].source, 'builtin');
});

test('resolvePublicThemeId falls back to default when selected theme is not registered', () => {
  const themeRecord = getBuiltinPublicThemeRecord();

  assert.equal(resolvePublicThemeId('missing', themeRecord), DEFAULT_PUBLIC_THEME_ID);
  assert.equal(resolvePublicThemeId('sunrise', themeRecord), 'sunrise');
});

test('isRegisteredPublicThemeId checks registration against available themes', () => {
  const themeRecord = getBuiltinPublicThemeRecord();

  assert.equal(isRegisteredPublicThemeId('default', themeRecord), true);
  assert.equal(isRegisteredPublicThemeId('missing', themeRecord), false);
});
