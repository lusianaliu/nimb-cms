# Phase 164 — Keyboard Interaction & Focus Management Polish for Theme Save Flow

Phase 164 refines the existing `/admin/settings` public theme save interaction for keyboard and assistive-technology comfort.

This remains a narrow polish pass:

- no new theme capabilities
- no second theme engine
- no plugin conversion of themes
- no API boundary expansion beyond canonical theme endpoints

## What changed

`core/admin/admin-settings-page.ts` now adds small, predictable interaction behavior around existing save flow outcomes.

- Added a local `focusElement` helper and applied it only at key recovery moments:
  - validation/save errors focus the selector
  - successful save/no-op confirmation keeps user anchored on the save button
- Added `updateSaveThemeButtonState` to keep save affordance predictable:
  - disabled while theme details are loading (`aria-busy="true"`)
  - disabled when no theme is selected
  - disabled when selected theme already matches configured theme
- Added keyboard shortcut support for selector-driven save:
  - pressing `Enter` on the theme selector triggers save only when the save button is currently enabled

## Success, no-op, and error behavior

- **Success:** existing status announcements remain, and focus returns to the nearby save button so keyboard users stay in context.
- **No-op/already active:** messaging remains explicit and focus remains anchored at save action context.
- **Validation/error:** assertive alerts remain in place, and focus is returned to the selector so correction can happen immediately.

## Announcement and focus coherence

Phase 164 keeps the Phase 163 dual-channel status model:

- `theme-status` for polite updates
- `theme-alert` for assertive outcomes

Focus movement is minimal and local, so live region announcements still carry the primary outcome while focus aids the next action.

## Canonical API coherence

The flow still uses only:

- `GET /admin-api/system/themes`
- `PUT /admin-api/system/themes`
- `settings.theme` as the single active-theme selector

No alternate state source or parallel interpretation path was introduced.

## Validation scope and limits

Added integration coverage checks for keyboard/focus management script markers and ordering in rendered admin settings HTML.

Full browser + screen-reader runtime behavior is still limited in this environment; validation focuses on deterministic structure and scripted interaction intent.
