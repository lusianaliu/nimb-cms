# Nimb Install & Deployment (Canonical Operator Path)

This is the practical path for running Nimb as an installed CMS project.

## 1) Create a real project install

```bash
npx nimb init my-site
cd my-site
npm install
```

Run Nimb from this generated project directory. Do **not** treat the Nimb source repository root as your deployed CMS project.

## 2) Read the operator guide

```bash
npx nimb guide
```

Use this when you want the canonical setup/deployment expectations printed in the current terminal with project-root context.

## 3) Run guided setup (recommended before first startup)

```bash
npx nimb setup
```

What `setup` does:

- verifies the resolved project root exists and is a directory,
- creates missing canonical directories when safe (`content`, `config`, `data/*`, `plugins`, `themes`, `public`, `logs`),
- reports what it created versus what already existed,
- reports paths it could not safely fix,
- runs `preflight` automatically and prints the full report,
- gives a clear next-step message.

How to read `setup` output quickly:

- **Created directories** = safe auto-fixes completed by Nimb.
- **Already present** = no change needed for those paths.
- **Manual action required** = setup could not safely repair these paths; you must fix them before retrying.
- **Deployment preflight report** = validation pass that explains remaining FAIL/WARN findings by category.

What `setup` does **not** do:

- it does not delete/replace conflicting non-directory paths,
- it does not change file ownership/permissions for you,
- it does not guarantee full runtime behavior (preflight still has limits).

## 4) Required project layout and writable paths

Nimb expects this layout in the project root:

- `config/nimb.config.json`
- `data/system/config.json` (canonical install-state source)
- `data/content/`
- `data/uploads/`
- `logs/`

Before deployment, ensure these directories are writable by the runtime process:

- `data/`
- `data/system/`
- `data/content/`
- `data/uploads/`
- `logs/`

## 5) Run preflight directly when needed

```bash
npx nimb preflight
```

Use `preflight` when you want validation-only checks (no setup actions). Resolve every `FAIL` finding before startup.

How to interpret preflight remediation blocks:

- `Manual action required (FAIL findings)` means startup is blocked.
- `Warnings to review (WARN findings)` means startup may continue but you still have risk/debt to resolve.
- Findings are grouped by remediation category so operators can work one problem type at a time (for example: project layout, filesystem permissions, configuration, network/port binding).
- `Retry summary` gives a concise fix-first checklist: blocking counts, warning counts, and an ordered category list for what to fix first.
- `Decision path` gives explicit branching for the immediate next move:
  - **Re-run setup now** only when blockers are missing required directories setup can safely create.
  - **Re-run preflight after manual fixes** when blockers are shape/permission/config/install-state/port issues that setup cannot safely auto-fix.
  - **Ask support now** when blocker type commonly needs technical help (for example invalid JSON in config/install-state/runtime data, or persistent startup port conflicts).
- `Support handoff` in the summary shows a copy-paste command to export machine-readable output for a helper.
- Preflight is explicit about limits: it validates path/layout/writability assumptions and does **not** prove full runtime behavior.

Common manual fixes before retrying:

- **Path shape conflicts**: replace a conflicting file with the required directory path.
- **Permissions**: grant runtime write access to `data/`, `data/system/`, `data/content/`, `data/uploads/`, and `logs/`.
- **Port conflicts**: change `PORT` / `config.server.port`, or stop the process that is currently using the port.
- **Config errors**: fix invalid JSON or invalid values in `config/nimb.config.json`.

Environment fix playbooks in preflight output:

- When preflight sees blocking findings that match known environment failure patterns, it now prints an **Environment fix playbooks** section.
- These playbooks bridge from finding category/code to practical action with:
  - typical causes,
  - bounded command examples,
  - explicit retry step,
  - escalation guidance.
- Playbooks are intentionally labeled as **common examples, not universal guarantees**.
- Commands shown are illustrative Linux-style operator examples and must be reviewed before running in your own host/container/panel context.

Current high-payoff playbook focus:

- **Filesystem permission/ownership blockers** (`required-directory-writable`, `required-directory-parent`) include a runtime write-access reset playbook for `data/*` and `logs`.
- **Network/port binding blockers** (`startup-port-invalid-or-unavailable`) include a bounded port-conflict triage playbook (check active port usage, verify effective configured port, retry with a known-free port).
- **Config/install-state JSON corruption blockers** (`config-invalid`, `install-state-invalid-json`) now include a bounded **safe recovery aid** with:
  - a backup-first validation checklist,
  - minimal JSON template examples for `config/nimb.config.json` and `data/system/config.json`,
  - explicit reminder that templates are examples, not universal guaranteed repairs.
- These playbooks target the highest-payoff diagnosis-to-action gaps after Phase 204: operators now get concrete, review-before-running examples for the most common next steps without pretending cross-host automation is universal.

Safety expectations for playbook command examples:

- Commands are illustrative examples for common Linux/container workflows, not host-agnostic guarantees.
- Stop before destructive edits: create backups of config/install-state JSON first.
- If you are unsure about expected keys/values in production JSON, escalate to technical support rather than repeatedly rewriting files.

JSON recovery checklist and templates (when `config-invalid` or `install-state-invalid-json` appears):

1. Back up both files before editing:
   - `config/nimb.config.json`
   - `data/system/config.json`
2. Repair one file at a time and keep strict JSON syntax (no comments/trailing commas).
3. Validate each edited file locally with `node -e "JSON.parse(...)"` before startup.
4. Use the preflight playbook's minimal templates only as bounded structure examples when no known-good backup is available.
5. Re-run `npx nimb preflight` before retrying startup.
6. Stop and ask technical support if values are still unclear after one careful attempt.

Support/debug handoff output:

```bash
npx nimb preflight --json > nimb-preflight-report.json
```

Use this JSON report when sharing blockers with a technical helper. It includes canonical findings, grouped blocking categories, grouped warning categories, and the retry command.
It also includes any matched `environmentFixPlaybooks` entries so support can see the same practical examples and escalation notes.

When to stop and fix before retrying:

- any `FAIL` finding remains unresolved,
- setup shows any `Manual action required` paths,
- preflight reports project-root/config/path-shape blockers.

Canonical retry decision path after setup/preflight failures:

1. Run `npx nimb setup` first (recommended baseline).
2. Read the preflight `Decision path` block in the output.
3. If it says **Re-run setup now**, run `npx nimb setup` again immediately.
4. If it says setup is not recommended, stop and fix blockers manually, then run `npx nimb preflight`.
5. If it says **Ask support now**, export JSON handoff and include it with your support request instead of retrying blindly.


## 6) Verify known-good baseline before first run/deploy

```bash
npx nimb verify
```

Use this bounded checkpoint after `setup`/`preflight` and before first startup or deployment handoff.

How to interpret baseline readiness:

- `READY_TO_TRY_RUN`: deploy-critical baseline assumptions are currently satisfied; you can try `npx nimb`.
- `STOP_AND_FIX_FIRST`: baseline assumptions are not yet satisfied; fix blockers first, then re-run `verify`.
- `ESCALATE_NOW`: blocker class is outside safe self-service assumptions (for example persistent JSON/state uncertainty or platform-controlled port/policy blockers); export preflight JSON and involve technical help.

What `verify` proves:

- project root resolves correctly,
- config/install-state/startup-port checks align with canonical preflight assumptions,
- required runtime writable paths (`data/*`, `logs`) pass bounded checks,
- operator gets a single baseline classification before first run.

What `verify` does **not** prove:

- full runtime correctness after startup,
- plugin/theme business logic correctness,
- host/container routing and proxy behavior under every platform policy.

When `verify` is not `READY_TO_TRY_RUN`, stop and fix/escalate first instead of repeatedly retrying startup.

## 7) Start Nimb

```bash
npx nimb
```

Then open `/admin` for admin/setup flows.

## 8) Optional runtime root override

If a process manager starts Nimb outside project root, explicitly set project root:

```bash
npx nimb --project-root /path/to/my-site
```

or environment variable:

```bash
NIMB_PROJECT_ROOT=/path/to/my-site npx nimb
```
