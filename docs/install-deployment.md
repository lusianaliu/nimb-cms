# Nimb Install & Deployment (Canonical Operator Path)

This is the practical path for running Nimb as an installed CMS project.

## 1) Create a real project install

```bash
npx nimb init my-site
cd my-site
npm install
```

Run Nimb from this generated project directory. Do **not** treat the Nimb source repository root as your deployed CMS project.

## 2) Required project layout and writable paths

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

## 3) Run preflight before startup

```bash
npx nimb preflight
```

Resolve every `FAIL` finding before startup.

## 4) Start Nimb

```bash
npx nimb
```

Then open `/admin` for admin/setup flows.

## 5) Optional runtime root override

If a process manager starts Nimb outside project root, explicitly set project root:

```bash
npx nimb --project-root /path/to/my-site
```

or environment variable:

```bash
NIMB_PROJECT_ROOT=/path/to/my-site npx nimb
```

## 6) Built-in operator guide command

Nimb includes a CLI help path for operators:

```bash
npx nimb guide
```

It prints the same canonical install/deployment expectations with project-root context.
