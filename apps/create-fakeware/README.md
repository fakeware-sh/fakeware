<div align="center">

<img src="https://raw.githubusercontent.com/fakeware-sh/fakeware/main/docs/public/logo.png" alt="Fakeware" height="72" />

# create-fakeware

Scaffold a Fakeware project.

[![npm](https://img.shields.io/npm/v/create-fakeware?color=%230ea5e9)](https://www.npmjs.com/package/create-fakeware)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-fakeware.sh-0ea5e9)](https://fakeware.sh)

</div>

Creates a typed `fakeware.config.ts`, an `.env` for your credentials, and a validated connection to your Shopware 6 shop, so you can seed demo data right away.

## Usage

```bash
npm create fakeware@latest
```

```bash
pnpm create fakeware
```

```bash
yarn create fakeware
```

```bash
bun create fakeware
```

## What it does

The scaffolder is interactive. It asks where to create the project, which package manager to use, which official plugins to add, and optionally walks you through connecting to your shop, validating the credentials before it writes anything.

You end up with a `package.json`, a typed `fakeware.config.ts`, and an `.env` holding your secrets, with the config types installed and ready.

Then:

```bash
fakeware up --dry-run   # preview the changes
fakeware up             # apply them
```

## Non-interactive

For CI or repeatable setups, pass everything up front so nothing prompts:

```bash
fakeware init \
  --url https://my-shop.example.com \
  --client-id "$SHOPWARE_CLIENT_ID" \
  --client-secret "$SHOPWARE_CLIENT_SECRET" \
  --secrets env \
  --yes
```

## Documentation

Guides, concepts and the full API reference live at [fakeware.sh](https://fakeware.sh). Start with the [installation guide](https://fakeware.sh/docs/usage/guide/installation).

## License

[MIT](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE) © Sebastian Stepper
