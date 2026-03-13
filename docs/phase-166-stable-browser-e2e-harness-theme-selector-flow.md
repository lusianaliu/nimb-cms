# Phase 166 — Stable Browser E2E Harness for Theme Selector Flow

Phase 166 focuses on making runtime verification for `/admin/settings` more repeatable, especially for keyboard-driven theme save behavior.

## Fragility audit findings

Phase 165 instability came from harness conditions, not a newly detected product-path redesign need:

- Direct startup from repository root (`node bin/nimb.js`) is not suitable for this verification path because startup expects `public/admin` in the startup root.
- Browser/session setup was partially ad-hoc across checks (temporary project scaffolding, auth setup, and target theme precondition selection).
- The actionable Enter-save branch needs deterministic preconditions (selected theme differs from currently configured theme) to avoid false no-op coverage.

## Harness improvements in this phase

Added a focused reusable helper for runtime verification setup:

- `test/helpers/theme-selector-flow-harness.ts`
  - creates a temporary installed project root with minimal config,
  - starts a server using the canonical bootstrap/runtime test path,
  - performs deterministic admin login,
  - exposes authenticated request helpers,
  - exposes canonical theme read/write helpers,
  - exposes helper to choose an alternate (actionable) theme id.

This keeps setup, auth, and actionable-state preconditions consistent for runtime verification.

## Stable verification coverage now in place

Added `test/phase166-stable-theme-selector-harness.integration.test.ts` to verify a reliable sequence:

1. `/admin/settings` still wires only canonical theme read/write endpoints.
2. Keyboard Enter-save guarded wiring remains present for actionable state.
3. Deterministic actionable update path succeeds through canonical `PUT /admin-api/system/themes`.
4. No-op repeat save path remains distinct and non-erroring.
5. Invalid theme id path remains explicit (`400` + `UNKNOWN_THEME_ID`).
6. Focus/status code-path markers for success and invalid branches remain wired.

## Enter-save and focus confidence

- Runtime wiring for Enter-triggered save remains explicitly guarded by save-button enabled state.
- The harness now deterministically selects an actionable theme id before save verification, reducing false no-op coverage.
- Success and invalid focus targets remain covered via the wired paths (`focusElement(saveThemeButton)` and `focusElement(themeSelect)`).

## Scope safety

No second theme engine was introduced.
No plugin conversion of themes was introduced.
No gallery/preview/install/marketplace behavior was added.
`settings.theme` remains the sole active-theme selector.
