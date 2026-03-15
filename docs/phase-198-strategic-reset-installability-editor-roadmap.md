# Phase 198 — Strategic Reset Toward Installability, Editor Usability, and Deployment Confidence

## Why this phase exists

After Phase 197, the project should stop defaulting to micro-hardening tracks unless there is a real blocker.

This phase sets a product-first direction so planning consistently prioritizes outcomes that move Nimb toward a non-technical-user-ready CMS.

## Product north star

Nimb should become a CMS that:

1. can be installed by non-technical users through a clear flow,
2. is usable for a company profile website plus a blog,
3. provides a comfortable content editing experience,
4. supports scheduled publishing,
5. has a realistic deployment story that operators can understand.

## Priority order for upcoming work

### Priority 1 — Installability and deployment clarity (default now)

Focus on work with direct install/start payoff:

- clear installation flow and state transitions,
- deployment/operator UX that explains expectations,
- explicit packaging/runtime assumptions,
- reduced friction for non-technical users,
- validation against realistic hosting/runtime constraints.

### Priority 2 — Editor and publishing usability

Once installability is clearer, prioritize:

- practical content editor improvements,
- draft/autosave ergonomics when justified,
- straightforward publish workflows,
- scheduled publishing path,
- minimum viable blog authoring experience.

### Priority 3 — Operational confidence

Then prioritize:

- diagnostics that materially help runtime operators,
- end-to-end confidence from install to publish,
- upgrade/maintenance clarity when relevant.

## Explicit de-prioritization

The following are not default priorities now unless they block a major milestone:

- tiny wording hardening,
- micro consistency alignment,
- helper extraction with low user impact,
- refactors done only for neatness,
- diagnostic text polish without milestone movement.

## Phase selection guardrails

When multiple tasks are possible, choose the one that best:

1. moves Nimb toward “a non-technical user can install and use it”,
2. improves product usability in visible ways,
3. offers strong payoff relative to risk,
4. advances a major milestone instead of local polish.

## Recommended planning style after Phase 197

- Bundle related milestone work where safe; avoid over-fragmenting into micro-phases.
- Name the milestone explicitly in each phase proposal.
- Explain non-technical-user impact and why the phase outranks smaller polish work.
- Return to tiny hardening only when it directly unblocks a major milestone.

## Immediate planning implication

The next implementation phases should target meaningful milestone movement (for example installer/deployment flow, editor/publishing ergonomics, scheduled publishing path, and end-to-end publish confidence) rather than continuing wording-only hardening tracks.
