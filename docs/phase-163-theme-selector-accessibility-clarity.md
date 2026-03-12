# Phase 163 — Accessibility & Clarity Pass for Theme Selector Flow

Phase 163 refines the existing `/admin/settings` theme selector flow for accessibility, legibility, and predictable status communication.

This phase is intentionally a refinement pass only:

- no new theme capabilities
- no second theme engine
- no theme gallery/preview/install flows
- no changes to canonical theme APIs or selection source of truth

## What changed

The Public theme section in `core/admin/admin-settings-page.ts` now has clearer semantic boundaries and dynamic announcement channels:

- Added a section landmark id and heading association for the theme area (`aria-labelledby`).
- Added `aria-busy` on the theme section while theme status is loading, then cleared after success/failure completion.
- Added explicit selector description wiring (`aria-describedby`) so helper text and immediate state lines are associated with the theme selector.
- Split dynamic announcement channels into:
  - `theme-status`: polite status updates (`role="status"`, `aria-live="polite"`)
  - `theme-alert`: assertive alert updates (`role="alert"`, `aria-live="assertive"`) for urgent/error outcomes.
- Updated `setThemeStatus` to route messaging by tone (`polite` or `assertive`) so non-urgent updates do not compete with urgent alerts.

## Clarity and flow refinements

The theme section keeps the minimal visual design but improves scan order and message intent:

1. Label + selector
2. Helper text
3. Coverage hint
4. Current state line / warning
5. Diagnostics details
6. Save action
7. Save/load announcement region

This preserves existing diagnostics and hint behavior while making it clearer which text is contextual guidance versus dynamic outcome feedback.

## Canonical API coherence

Phase 163 keeps the same canonical flow:

- Read: `GET /admin-api/system/themes`
- Write: `PUT /admin-api/system/themes`
- Selection source-of-truth: `settings.theme`

No alternate theme state interpretation path was introduced.

## Validation scope and limits

Integration coverage was added for semantic/accessibility markers and order checks in rendered admin settings HTML.

Browser/screen-reader behavior is not fully verifiable in this environment, so this phase validates structural semantics and message-channel intent rather than full assistive-technology runtime behavior.
