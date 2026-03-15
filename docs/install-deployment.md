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

## 6) Start Nimb

```bash
npx nimb
```

Then open `/admin` for admin/setup flows.

## 7) Optional runtime root override

If a process manager starts Nimb outside project root, explicitly set project root:

```bash
npx nimb --project-root /path/to/my-site
```

or environment variable:

```bash
NIMB_PROJECT_ROOT=/path/to/my-site npx nimb
```
