# Contributing to fakeware

## Prerequisites

- **[Bun](https://bun.sh)** *
- **Node** *
- **Docker**

## Project structure

```
fakeware/
├── apps/
│   ├── cli/                  # @fakeware/cli - the 'fakeware' command
│   └── create-fakeware/      # npm create fakeware
├── packages/
│   └── core/                 # @fakeware/core - library used by the CLI
├── plugins/
│   └── plugin-pickware/      # @fakeware/plugin-pickware
├── docs/                     # documentation site (fakeware.sh)
├── scripts/                  # dev + release tooling
├── .changeset/               # pending release notes
├── package.json              # workspace root + scripts
└── biome.json                # lint + format config
```

## Getting started

```bash
git clone https://github.com/fakeware-sh/fakeware.git
cd fakeware
bun install
```

## Development workflow

All commands run from the repo root:

| Command             | Description                                    |
|---------------------|------------------------------------------------|
| `bun run dev`       | Build all packages in watch mode.              |
| `bun run build`     | Build all packages once.                       |
| `bun run test`      | Run tests across all packages.                 |
| `bun run typecheck` | Type-check all packages.                       |
| `bun run check`     | Biome lint/format check + typecheck.           |
| `bun run fix`       | Auto-fix with Biome, then typecheck.           |
| `bun run clean`     | Remove all build artifacts and `node_modules`. |

Please do `bun run check` or `bun run fix` before pushing. CI runs the same checks.

## Working on the CLI (`apps/cli`)

Run the whole repo in dev watch mode to auto build all packages and apps on code update.

```bash
bun run dev
fakeware --help
```

The published binary is `fakeware` -> `apps/cli/dist/index.mjs`. On install the repo links the `fakeware` bin locally for development, so you can also invoke `fakeware` directly after building.

## Local Shopware test shop (Docker)

For a throwaway shop to develop against, run the official Shopware image from [dockware](https://dockware.io). No compose file or Dockerfile is needed.

Boot a full Shopware 6 stack:

```bash
docker run --rm -d -p 80:80 --name shopware dockware/shopware:latest
```

- Storefront: <http://localhost>
- Admin: <http://localhost/admin> (default login `admin` / `shopware`)


To get admin api credentials, create an integration in the admin under **Settings / System / Integrations**. That yields a **client ID** and **client secret**, which you pass to fakeware.

## Testing

Tests use Bun's built-in runner:

```bash
bun run test
```

Place tests next to the source they cover as `*.test.ts`.

### Manual end-to-end runs

To exercise the CLI against a real shop, scaffold a throwaway project somewhere outside the repo and point it at a disposable shop (the Docker one above works). Copy `.env.example` for the variables it needs:

```
SHOPWARE_URL=
SHOPWARE_CLIENT_ID=
SHOPWARE_CLIENT_SECRET=
```

Then, after `bun run build`:

```bash
fakeware validate
fakeware status
fakeware up --dry-run --verbose
fakeware down --dry-run
```

Never point this at a shop whose data you care about. `up` writes and `down` deletes.

## Commits and pull requests

Releases run on [Changesets](https://github.com/changesets/changesets). Add one in any PR that changes published behavior:

```bash
bun run changeset
```

Pick the affected packages and bump levels, then commit the generated `.changeset/*.md` file alongside your change. Docs-only or internal changes that ship nothing to npm don't need a changeset.

Merging to `main` opens a **Version PR** that applies the pending changesets, bumping versions, rewriting changelogs, and syncing the lockfile. Merging that PR publishes to npm and pushes tags. Never bump a version or edit a `CHANGELOG.md` by hand.

Version PRs are created by `GITHUB_TOKEN`, which does not trigger CI. Close and reopen one if you need checks to run on it.

Write commit messages with [Conventional Commits](https://www.conventionalcommits.org/) prefixes. Versioning comes from changesets, not from the commit type.
