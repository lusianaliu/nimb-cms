# Phase 211 — Editor & Publishing Usability Milestone

## What changed

This phase improves the admin authoring workflow for pages and posts by making draft vs publish intent explicit at submit time.

Before this phase, authors had a single submit action and a status dropdown. That forced users to keep form status and submit intent in sync manually.

After this phase:

- Page and post forms now provide two explicit submit actions:
  - **Save as draft / Save draft changes**
  - **Publish now / Publish changes**
- The selected button controls final status (`draft` or `published`) even if the status select currently shows something else.
- Redirect notices are now workflow-specific so authors get clearer confirmation:
  - `created-draft`, `created-published`
  - `updated-draft`, `updated-published`
- Admin list pages surface matching messages such as **Draft saved** and **Post published**.

## Why this improves usability

This removes a common authoring footgun where a user intends to save draft but accidentally publishes (or vice versa) due to status/select mismatch.

The new flow aligns with common CMS ergonomics:

- intent-first actions,
- clearer post-submit confirmation,
- safer drafting confidence.

## Scope and constraints

- No runtime architecture redesign.
- No deployment workflow changes.
- Existing canonical bootstrap/runtime/install-state paths unchanged.
- Improvement is bounded to admin page/post author workflow and related tests.
