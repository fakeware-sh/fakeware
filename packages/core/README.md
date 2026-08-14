<div align="center">

<img src="https://raw.githubusercontent.com/fakeware-sh/fakeware/main/docs/public/logo.png" alt="Fakeware" height="72" />

# @fakeware/core

The engine behind Fakeware.

[![npm](https://img.shields.io/npm/v/@fakeware/core?color=%230ea5e9)](https://www.npmjs.com/package/@fakeware/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-fakeware.sh-0ea5e9)](https://fakeware.sh)

</div>

This package holds the authoring language, the sync engine and the Shopware Admin API client. Most people install [`@fakeware/cli`](https://www.npmjs.com/package/@fakeware/cli) instead and never depend on core directly. Reach for it when you are writing a plugin or driving the engine from your own code.

## Install

```bash
npm install @fakeware/core
```

## Usage

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

## Entry points

| Import                    | Contents                                                            |
|---------------------------|---------------------------------------------------------------------|
| `@fakeware/core`          | `define`, `many`, `ref`, `refs`, `shop`, the engine and plugin APIs |
| `@fakeware/core/config`   | `defineConfig` for `fakeware.config.ts`                             |
| `@fakeware/core/shopware` | Admin API client, `ShopwareApiError`, shop context helpers          |
| `@fakeware/core/testing`  | Test doubles for plugin authors                                     |

## Documentation

Guides, concepts and the full API reference live at [fakeware.sh](https://fakeware.sh).

- [Authoring API](https://fakeware.sh/docs/usage/reference/authoring-api)
- [Writing a plugin](https://fakeware.sh/docs/development/plugins/overview)

## License

[MIT](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE) © Sebastian Stepper
