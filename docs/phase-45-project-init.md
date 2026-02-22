# Phase 45 — Project Initialization CLI (`nimb init`)

Phase 45 introduces project scaffolding so new users can create a runnable Nimb CMS project without cloning this repository.

## Create a project

```bash
npx nimb init my-site
```

This command creates a new `my-site/` folder relative to your current working directory and writes a deterministic starter structure.

## Generated structure

```text
my-site/
  nimb.config.json
  content/
  data/
  plugins/
  public/
  package.json
  README.md
```

## Generated config

`nimb.config.json`:

```json
{
  "server": {
    "port": 3000
  },
  "admin": {
    "enabled": true,
    "basePath": "/admin"
  }
}
```

## Run locally

```bash
cd my-site
npm install
npm start
```

You can then open the CMS and admin UI using the configured server port and admin base path.

## Folder meanings

- `content/`: content structure and authored resources.
- `data/`: runtime and persistence data files.
- `plugins/`: local plugin capability units for project extension.
- `public/`: static assets served by the project.

## Notes

- `nimb init` fails if the target directory already exists.
- No interactive prompts are used in this phase.
- Output is deterministic for repeatable project setup.
