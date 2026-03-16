# Phase 207 — Known-Good Baseline Project Verification Milestone

## Summary

Phase 207 adds a bounded operator-facing `verify` command to classify whether a project is baseline-ready before first startup/deployment.

- Canonical command: `npx nimb verify`
- Optional machine-readable output: `npx nimb verify --json`
- Readiness classes:
  - `READY_TO_TRY_RUN`
  - `STOP_AND_FIX_FIRST`
  - `ESCALATE_NOW`

## Problem targeted

After setup + preflight improvements from prior phases, operators still had to infer a final go/no-go decision from many findings. The highest-payoff gap was a single explicit checkpoint that answers: “ready enough to try run now, or stop/escalate first?”

## What changed

- Added `core/cli/verify.ts` as a bounded baseline verification layer built on existing preflight assumptions.
- Added `verify` command handling in `bin/nimb.js`.
- Added text and JSON formatting for verification output, including:
  - what was checked,
  - what was not checked,
  - escalation boundaries,
  - recommendation text.
- Updated operator guide output and generated project README text to include baseline verification before startup.
- Updated install/deployment docs with the canonical verify flow and interpretation guidance.
- Added integration tests for readiness classification and CLI JSON output.

## Safety and honesty boundaries

`verify` intentionally does not promise full runtime correctness. It only classifies whether deploy-critical baseline assumptions (already enforced in preflight) are currently satisfied.

It explicitly preserves escalation boundaries for shared-host/container/platform-managed environments.
