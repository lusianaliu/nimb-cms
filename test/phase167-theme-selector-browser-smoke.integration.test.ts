import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeSelectorFlowHarness } from './helpers/theme-selector-flow-harness.ts';

type PlaywrightModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<{
      newContext: () => Promise<{
        addCookies: (cookies: Array<{ name: string, value: string, url: string }>) => Promise<void>,
        newPage: () => Promise<{
          goto: (url: string, options?: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle' }) => Promise<void>,
          waitForFunction: (fn: () => unknown, options?: { timeout?: number }) => Promise<void>,
          waitForSelector: (selector: string, options?: { state?: 'attached' | 'visible' }) => Promise<void>,
          textContent: (selector: string) => Promise<string | null>,
          selectOption: (selector: string, value: string) => Promise<void>,
          focus: (selector: string) => Promise<void>,
          keyboard: { press: (key: string) => Promise<void> },
          evaluate: <T>(fn: () => T) => Promise<T>
        }>,
        close: () => Promise<void>
      }>,
      close: () => Promise<void>
    }>
  }
};

const loadPlaywright = async (): Promise<PlaywrightModule | null> => {
  try {
    return await import('playwright') as PlaywrightModule;
  } catch {
    return null;
  }
};

test('phase 167: browser smoke verifies actionable Enter-save flow, focus target, and visible status coherence', async (t) => {
  const playwright = await loadPlaywright();
  if (!playwright) {
    t.skip('playwright dependency is not installed in this environment');
    return;
  }

  const harness = await createThemeSelectorFlowHarness('phase167-browser-smoke');
  const before = await harness.getThemeStatus();
  const actionableThemeId = harness.getAlternateThemeId(before);
  assert.notEqual(actionableThemeId, null);

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const { name: cookieName, value: cookieValue } = harness.getAuthCookieParts();
    assert.notEqual(cookieName, '');

    await context.addCookies([{ name: cookieName, value: cookieValue, url: `http://127.0.0.1:${harness.port}` }]);
    const page = await context.newPage();

    await page.goto(`http://127.0.0.1:${harness.port}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const select = document.getElementById('activeThemeId') as { options?: { length?: number } } | null;
      const section = document.getElementById('public-theme-section');
      return !!select && !!section && section.getAttribute('aria-busy') === 'false' && select.options.length > 1;
    }, { timeout: 10000 });

    await page.waitForSelector('#save-theme-button', { state: 'visible' });

    const beforeSaveDisabled = await page.evaluate(() => {
      const saveButton = document.getElementById('save-theme-button') as { disabled?: boolean } | null;
      return saveButton?.disabled ?? false;
    });
    assert.equal(beforeSaveDisabled, true);

    await page.selectOption('#activeThemeId', actionableThemeId!);

    const afterSelectDisabled = await page.evaluate(() => {
      const saveButton = document.getElementById('save-theme-button') as { disabled?: boolean } | null;
      return saveButton?.disabled ?? true;
    });
    assert.equal(afterSelectDisabled, false);

    await page.focus('#activeThemeId');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => {
      const status = document.getElementById('theme-status')?.textContent ?? '';
      return status.includes('Theme saved');
    }, { timeout: 10000 });

    const themeStatusText = (await page.textContent('#theme-status')) ?? '';
    assert.equal(themeStatusText.includes('Theme saved'), true);

    const activeElementId = await page.evaluate(() => (document.activeElement as { id?: string } | null)?.id ?? '');
    assert.equal(activeElementId, 'save-theme-button');

    const finalDisabled = await page.evaluate(() => {
      const saveButton = document.getElementById('save-theme-button') as { disabled?: boolean } | null;
      return saveButton?.disabled ?? false;
    });
    assert.equal(finalDisabled, true);

    const after = await harness.getThemeStatus();
    assert.equal(after.configuredThemeId, actionableThemeId);

    await context.close();
  } finally {
    await browser.close();
    await harness.stop();
  }
});
