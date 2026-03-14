# Phase 182 — Preflight-to-Startup Consistency Hardening

## Goal

Phase 182 tightens consistency between:

- `node bin/nimb.js preflight`
- canonical startup invariant checks used by boot/runtime

This phase keeps the existing startup architecture and focuses on low-risk alignment only.

## Gaps identified from startup vs preflight audit

1. **Configured admin static dir severity mismatch**
   - Startup invariant (`validateAdminStaticDir`) fails if `config.admin.staticDir` is explicitly configured and missing.
   - Preflight previously always emitted WARN for missing admin static directory.

2. **Persistence runtime JSON gap**
   - Startup invariant (`validatePersistenceStorage`) fails when `data/system/runtime.json` exists but is invalid JSON.
   - Preflight did not surface this startup blocker.

3. **Port invariant gap**
   - Startup invariant validates selected startup port shape/availability before boot.
   - Preflight did not check invalid or occupied startup ports.

4. **Async invariant parity**
   - Port availability checking requires async execution.
   - Preflight runner needed to support async diagnostics while preserving CLI behavior and PASS/WARN/FAIL reporting.

## Hardening implemented

1. **Preflight port parity with startup rules**
   - Preflight now resolves port using startup precedence (`PORT`, then `config.server.port`, then default `3000`).
   - It validates port availability via loopback bind probe and reports FAIL when invalid/unavailable.

2. **Admin static dir severity alignment**
   - If admin static dir path exists but is not a directory: FAIL.
   - If custom `config.admin.staticDir` is configured and missing: FAIL.
   - If default static path is missing: WARN (fallback intent preserved).

3. **Persistence runtime JSON parity**
   - If `data/system/runtime.json` exists and is invalid JSON: FAIL.
   - If present and valid JSON: PASS.
   - If absent: no finding (matching startup behavior, which tolerates absence).

4. **CLI integration preserved with async preflight**
   - `runPreflightDiagnostics` is now async.
   - `bin/nimb.js preflight` awaits report generation and retains existing exit-code semantics.

## Current preflight/startup consistency status

Preflight now mirrors the most important startup blockers that were previously unrepresented or severity-misaligned in the canonical path:

- writable runtime directories
- config validation
- admin static directory shape/availability (with startup-consistent strictness for configured paths)
- persistence runtime JSON validity
- startup port validity/availability

This reduces operator surprise where preflight could previously show WARN/clean status but startup would fail immediately.

## Intentional remaining differences

1. **Preflight still does not execute full bootstrap/runtime plugin loading**
   - Plugin/theme/runtime initialization failures can still occur only at real startup.

2. **Preflight remains diagnostic, not full behavioral proof**
   - PASS/WARN/FAIL reflects checked invariants and deployment assumptions, not exhaustive runtime correctness.

3. **Network/socket races remain possible**
   - A port can be free during preflight and become occupied before startup bind.
   - This is an unavoidable timing limitation and not a diagnostics correctness bug.
