<div align="center">

<img src="https://raw.githubusercontent.com/fakeware-sh/fakeware/main/docs/public/logo.png" alt="Fakeware" height="72" />

# @fakeware/plugin-pickware

Pickware ERP support for Fakeware.

[![npm](https://img.shields.io/npm/v/@fakeware/plugin-pickware?color=%230ea5e9)](https://www.npmjs.com/package/@fakeware/plugin-pickware)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-fakeware.sh-0ea5e9)](https://fakeware.sh)

</div>

Seed bin locations, suppliers, product supplier configurations and return orders into a Shopware 6 shop running Pickware ERP.

## Install

```bash
fakeware init --plugins pickware
```

Or add it to an existing project:

```bash
npm install --save-dev @fakeware/plugin-pickware
```

Requires `@fakeware/core` 0.2.0 or newer, and a Shopware 6 shop with Pickware ERP 3.0.0 or newer installed.

## Usage

Register the plugin in your `fakeware.config.ts`:

```ts
import { defineConfig } from '@fakeware/core/config'
import { pickware } from '@fakeware/plugin-pickware'

export default defineConfig({
  plugins: [pickware()],
})
```

Then define Pickware entities alongside your regular data:

```ts
import { define, ref } from '@fakeware/core'
import { binLocation, warehouseIdByCode } from '@fakeware/plugin-pickware'

define(
  'pickware_erp_bin_location',
  binLocation({ code: 'A-01-01', warehouseId: warehouseIdByCode('main') }),
)
```

## What it adds

| Entity                                        | Covers                                     |
|-----------------------------------------------|--------------------------------------------|
| `pickware_erp_bin_location`                   | Bin locations within a warehouse           |
| `pickware_erp_supplier`                       | Suppliers                                  |
| `pickware_erp_product_supplier_configuration` | Product to supplier links, purchase prices |
| `pickware_erp_return_order`                   | Return orders                              |
| `pickware_erp_return_order_line_item`         | Return order line items                    |

It also resolves warehouses from the live shop, so `warehouseIdByCode('main')` lands a valid id, and declares a compatibility check that fails fast with a clear message when Pickware is missing or too old.

## Documentation

See the [plugin guide](https://fakeware.sh/docs/development/plugins/overview) and the full reference at [fakeware.sh](https://fakeware.sh).

## License

[MIT](https://github.com/fakeware-sh/fakeware/blob/main/LICENSE) © Sebastian Stepper
