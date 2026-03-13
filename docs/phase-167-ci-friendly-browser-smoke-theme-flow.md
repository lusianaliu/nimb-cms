# Phase 167 — CI-Friendly Browser Smoke Verification for Theme Flow

Phase 167 adds a small browser-smoke layer for the canonical `/admin/settings` theme selector path.

## Audit summary

From prior phases and current runtime behavior:

- Phase 166 made startup/auth/actionable-precondition setup deterministic through a reusable installed-runtime harness.
- What was still missing was a browser-driven assertion path that actually exercises keyboard Enter-save, post-save focus target, and visible status transition in one repeatable sequence.
- The smallest stable scenario is one authenticated admin flow that:
  1. loads `/admin/settings`,
  2. waits for theme data load completion,
  3. switches to an alternate valid theme,
  4. presses Enter on the selector,
  5. confirms success status + focus target,
  6. confirms persisted configured theme via canonical API.

## What was added

- New browser smoke integration test:
  - `test/phase167-theme-selector-browser-smoke.integration.test.ts`
- Small harness helper extension:
  - `test/helpers/theme-selector-flow-harness.ts` now exposes parsed auth-cookie parts for browser context setup.

## Smoke proof now covered

The Phase 167 smoke test verifies, in browser runtime:

1. **No-op/actionability coherence**
   - Save button is disabled before any actionable change.
   - Save button becomes enabled after selecting a different valid theme.

2. **Actionable Enter-save behavior**
   - Focused selector + Enter triggers the save flow (without clicking the button directly).
   - Save status updates to a visible “Theme saved…” outcome.

3. **Post-save focus behavior**
   - Focus lands on `#save-theme-button` after successful save.

4. **Canonical persistence confirmation**
   - After browser save, `GET /admin-api/system/themes` reports the newly configured `settings.theme` value.

## Scope and boundary safety

This phase keeps canonical boundaries intact:

- page path: `/admin/settings`
- read endpoint: `GET /admin-api/system/themes`
- write endpoint: `PUT /admin-api/system/themes`
- no new product API/test-only product route added

No second theme engine was introduced.
No theme-as-plugin conversion was introduced.
No gallery/preview/install/marketplace behavior was added.

## Known environment assumption

The smoke test requires `playwright` to be present in the execution environment.

- If `playwright` is unavailable, the test is skipped intentionally.
- This preserves deterministic CI behavior across mixed environments while still enabling a true browser smoke check in Playwright-enabled pipelines.

## What this does not prove

- It is not full cross-browser certification.
- It is not exhaustive accessibility certification.
- It does not verify every warning/edge-state variant.

It is intentionally a narrow, repeatable smoke layer for the highest-value keyboard theme-save path.
