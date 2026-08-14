<div align="center">

<img src="https://raw.githubusercontent.com/fakeware-sh/fakeware/main/docs/public/logo.png" alt="Fakeware" height="72" />

# @fakeware/cli

Seed Shopware 6 demo data from typed TypeScript.

[![npm](https://img.shields.io/npm/v/@fakeware/cli?color=%230ea5e9)](https://www.npmjs.com/package/@fakeware/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-fakeware.sh-0ea5e9)](https://fakeware.sh)

</div>

Describe products, categories and orders in typed TypeScript, then apply and remove them with a single command. Fakeware never touches data it did not create.

## Get started

```bash
npm create fakeware@latest
```

That scaffolds a project and points it at your shop. To add the CLI to an existing project:

```bash
npm install --save-dev @fakeware/cli
```

## Example

```ts
import { define, many, ref, shop } from '@fakeware/core'

define('tax', { $key: 'standard', name: 'Standard rate', taxRate: 19 })

define(
  'product',
  many(10, (ctx) => ({
    name: `Demo product ${ctx.index + 1}`,
    productNumber: `SW-${10000 + ctx.index}`,
    stock: 100,
    taxId: ref('tax').key('standard'),
    price: [{ currencyId: shop.defaultCurrency, gross: 19.99, net: 16.8, linked: true }],
  })),
)
```

```bash
fakeware up --dry-run   # preview the changes
fakeware up             # apply them (re-run = nothing changes)
fakeware down           # remove exactly what fakeware created
```

## Commands

| Command             | What it does                                                      |
|---------------------|-------------------------------------------------------------------|
| `fakeware init`     | Scaffold a project (package.json, typed config, .env) or a plugin |
| `fakeware up`       | Apply your data definitions to the shop                           |
| `fakeware down`     | Delete the demo data fakeware created, per its manifest           |
| `fakeware status`   | Show what fakeware has applied, from the local manifest           |
| `fakeware validate` | Check your config and data files for errors                       |

Full flag reference: [CLI reference](https://fakeware.sh/docs/usage/reference/cli).

## Plugins

Plugins teach Fakeware about entities that ship with Shopware extensions rather than the core.

```bash
fakeware init --plugins pickware
```

[`@fakeware/plugin-pickware`](https://www.npmjs.com/package/@fakeware/plugin-pickware) covers Pickware ERP: warehouses, bin locations, stock and return orders. Writing your own is a first-class workflow, see the [plugin development guide](https://fakeware.sh/docs/development/plugins/overview).

## Documentation

Guides, concepts and the full API reference live at [fakeware.sh](https://fakeware.sh).

## License

[MIT](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE) © Sebastian Stepper
