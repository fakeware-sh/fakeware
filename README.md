<div align="center">

<img src="./docs/public/logo.png" alt="Fakeware" height="72" />

# Fakeware

**Like database migrations, but for Shopware 6 demo data.**

[![npm](https://img.shields.io/npm/v/create-fakeware?color=%230ea5e9&label=create-fakeware)](https://www.npmjs.com/package/create-fakeware)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
[![Docs](https://img.shields.io/badge/docs-fakeware.sh-0ea5e9)](https://fakeware.sh)

</div>

Fill your Shopware shop by describing products, categories and orders in typed TypeScript, then apply and remove them with a single command. You `define` your data, run `fakeware up` to sync only what changed, and `fakeware down` to remove exactly what it created. Fakeware never touches data it didn't create.

## Demo

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

## Features

| Feature | What it means |
|---------|---------------|
| **Typed, declarative data** | Describe entities as plain objects with a tiny `define` / `ref` / `shop` language, with full TypeScript inference and no boilerplate. |
| **Deterministic by design** | Stable UUIDs and content hashing mean the same definitions always produce the same records, so re-running changes nothing. |
| **Apply and revert** | `fakeware up` syncs only what changed. `fakeware down` removes exactly what it created, tracked in a per-shop manifest. |
| **Shop-aware references** | Resolve currencies, taxes, countries, salutations and states from the live shop, so your data lands valid every time. |
| **Relationships that just work** | Reference other entities by key, index or a seeded random pick, and Fakeware orders the writes for you. |
| **Safe to re-run** | Idempotent syncs, crash-safe manifest writes and resilient teardown make Fakeware safe in scripts and CI. |

## Get started

```bash
bun create fakeware my-seed
```

Then follow the [guide](https://fakeware.sh/docs/usage/guide/introduction) to point it at your Shopware shop and seed your first data.

## Documentation

Guides, concepts and the full API reference live at **[fakeware.sh](https://fakeware.sh)**.