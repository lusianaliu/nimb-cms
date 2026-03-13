import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeSelectorFlowHarness } from './helpers/theme-selector-flow-harness.ts';

test('phase 166: installed runtime harness verifies deterministic actionable/no-op/invalid theme selector outcomes', async () => {
  const harness = await createThemeSelectorFlowHarness('phase166');

  try {
    const settingsResponse = await harness.request('/admin/settings');
    assert.equal(settingsResponse.status, 200);
    const html = await settingsResponse.text();

    assert.equal(html.includes("fetch('/admin-api/system/themes')"), true);
    assert.equal(html.includes("fetch('/admin-api/system/themes', {"), true);
    assert.equal(html.includes("if (event.key === 'Enter' && !saveThemeButton?.disabled) {"), true);
    assert.equal(html.includes("setThemeStatus('Theme saved and active. Your public website now uses the selected theme.');"), true);
    assert.equal(html.includes("setThemeStatus('No changes were made. This theme is already active.');"), true);
    assert.equal(html.includes("setThemeStatus('Choose a theme before saving.', 'assertive');"), true);
    assert.equal(html.includes('focusElement(saveThemeButton);'), true);
    assert.equal(html.includes('focusElement(themeSelect);'), true);

    const before = await harness.getThemeStatus();
    assert.equal(typeof before.configuredThemeId, 'string');
    assert.equal(Array.isArray(before.themes), true);

    const actionableThemeId = harness.getAlternateThemeId(before);
    assert.notEqual(actionableThemeId, null);

    const actionableResponse = await harness.setTheme(actionableThemeId!);
    assert.equal(actionableResponse.status, 200);
    const actionablePayload = await actionableResponse.json();
    assert.equal(actionablePayload.configuredThemeId, actionableThemeId);
    assert.equal(actionablePayload.resolvedThemeId, actionableThemeId);

    const afterAction = await harness.getThemeStatus();
    assert.equal(afterAction.configuredThemeId, actionableThemeId);

    const noOpResponse = await harness.setTheme(actionableThemeId!);
    assert.equal(noOpResponse.status, 200);
    const noOpPayload = await noOpResponse.json();
    assert.equal(noOpPayload.configuredThemeId, actionableThemeId);

    const invalidResponse = await harness.setTheme('does-not-exist');
    assert.equal(invalidResponse.status, 400);
    const invalidPayload = await invalidResponse.json();
    assert.equal(invalidPayload?.error?.code, 'UNKNOWN_THEME_ID');
  } finally {
    await harness.stop();
  }
});
