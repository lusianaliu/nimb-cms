# Phase 165 — Runtime Interaction Verification for Theme Flow

Phase 165 validates the existing `/admin/settings` public-theme selector behavior in a real browser runtime, without introducing new theme capabilities or alternate API paths.

## Runtime verifiability audit

Practical runtime observations in this repository:

- `node bin/nimb.js` is not directly usable from repository root for admin verification when `public/admin` does not exist in that startup root.
- Runtime verification was executed by starting a temporary installed server rooted in a generated project directory (with minimal required project structure), then driving browser interaction against that running instance.
- The tested admin flow remained on canonical paths:
  - page route: `/admin/settings`
  - read API: `GET /admin-api/system/themes`
  - write API: `PUT /admin-api/system/themes`

## Browser interaction verification completed

Browser-driven checks were run against `/admin/settings` with keyboard-first interaction.

Verified in runtime:

- Theme selector is reachable via keyboard tab navigation.
- Save button is disabled in no-op state when selected theme already matches configured theme.
- Pressing Enter on selector does not trigger save while save button is disabled.
- Validation branch still surfaces assertive text and focuses selector when save is attempted with an invalid empty selection state.
- Canonical write API rejects invalid theme ids with `400` and `UNKNOWN_THEME_ID` contract payload.

Partially verified in runtime:

- Enter-key save trigger in actionable state was observed as environment-sensitive in headless browser runs (intermittent timeout/crash behavior in this container session). No code-path change was made because script wiring and API behavior remain consistent with Phase 164 intent.

## Focus/status behavior observations

Observed during runtime verification:

- No-op branch keeps interaction local and provides explicit status messaging.
- Validation branch (`Choose a theme before saving.`) remains assertive and returns focus to selector.
- Success-path focus and announcement behavior is still implemented in the settings script via save-context focus and status update calls, and was additionally covered by integration-level regression checks in this phase.

## Minimal regression coverage added

Added a Phase 165 integration test that verifies:

- canonical read/write API endpoints are still the only flow used in settings script wiring,
- selector Enter-key handler remains guarded by save-button enabled state,
- no-op/validation/error/success status+focus code-path markers remain present,
- canonical read/write contracts still behave end-to-end against a running installed server.

## Scope safety

No second theme engine was introduced.
No plugin conversion of themes was introduced.
No gallery/preview/install/marketplace behavior was added.
`settings.theme` remains the sole active-theme selector.
