# Phase 183 — Startup/Preflight Invariant Registry

## Summary

Phase 183 introduces a small shared metadata registry for the startup/preflight invariants that have the highest drift risk on the canonical path.

The registry centralizes canonical invariant identity and operator-facing intent, while keeping startup execution and preflight execution models unchanged.

## Shared registry module

- Module: `core/invariants/startup-preflight-invariants.ts`
- Purpose: hold canonical invariant metadata used by both startup invariants and preflight diagnostics.
- Scope in this phase: only the most important invariants aligned in Phase 182.

Each covered invariant defines:

- canonical `id`
- canonical `title`
- severity intent (`startup` and `preflight`)
- shared `why`
- shared remediation guidance

## Invariants covered in Phase 183

1. `admin-static-dir` (`Admin static directory`)
2. `persistence-runtime-json` (`Persistence runtime file`)
3. `startup-port` (`Startup port availability`)

These are the highest-value invariants for reducing startup/preflight wording and severity drift without broad risky churn.

## Adoption in startup and preflight

### Startup (`core/bootstrap/startup-invariants.ts`)

- Startup error messages now include canonical invariant ids for:
  - admin static directory failures
  - persistence runtime JSON parsing failures
  - startup port validation/availability failures

Startup behavior is otherwise preserved (same checks, same ordering, same failure conditions).

### Preflight (`core/cli/preflight.ts`)

- Preflight now reads shared registry metadata for covered checks:
  - check titles
  - shared `why` text
  - key remediation guidance

Preflight output formatting and pass/warn/fail report mechanics remain unchanged.

## Intentional limits (what remains local)

This phase does **not** migrate every preflight/startup check into the registry.

Still local in this phase:

- project root checks
- config file existence/validity checks
- install-state source path checks
- required/expected directory layout checks
- logs/data writable path findings beyond the covered invariants

Why they remain local now:

- These checks have more local context-specific detail strings and broader coverage.
- Full migration would create higher churn risk than warranted for Phase 183.

Future phases can migrate additional invariants incrementally when behavior is stable and clear coverage/value exists.

## Drift-risk impact

By centralizing id/title/severity intent/why/remediation for the most critical shared invariants, Phase 183 reduces the chance that startup and preflight evolve inconsistent operator guidance for:

- admin static-dir policy
- persistence runtime JSON integrity
- startup port validity/availability

## Tests

- Added `test/phase183-invariant-registry.test.ts` to verify:
  - registry structure and canonical metadata coverage
  - preflight use of shared invariant titles/why text for covered checks
