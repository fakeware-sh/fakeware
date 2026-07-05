---
seo:
  title: 'Fakeware: demo data for Shopware 6'
  description: Fill your Shopware shop with realistic demo data from typed, deterministic definitions. Declare products, categories and orders in TypeScript, then apply and revert them with a single command.
---

::u-page-hero
---
orientation: horizontal
headline: Open source · MIT licensed
ui:
  container: 'lg:items-center'
links:
  - label: Get started
    to: /docs/usage/guide/introduction
    trailingIcon: i-lucide-arrow-right
    size: xl
  - label: Star on GitHub
    to: https://github.com/fakeware-sh/fakeware
    target: _blank
    color: neutral
    variant: subtle
    icon: i-simple-icons-github
    size: xl
---
#title
:::span{class="inline-flex items-center gap-3"}
:u-color-mode-image{light="/logo.png" dark="/logo.png" alt="Fakeware" class="h-12 w-auto shrink-0"}
Fakeware
:::

#description
Like database migrations, but for demo data. Fill your Shopware shop by describing products, categories and orders in TypeScript, then apply and remove them with a single command.

#default
:::code-group{class="hero-code-group"}
  ::::fake-terminal
  ---
  label: Terminal
  icon: i-lucide-terminal
  commandPause: 1800
  sessions:
    - command: fakeware up
      banner: cyan
      intro: fakeware up
      spinner:
        active: Applying…
        done: Applied
        doneCount: 3 entities
        entities:
          - tax
          - category
          - product
      rows:
        - segments:
            - { text: "tax ", color: cyan }
            - { text: "+2", color: green }
        - segments:
            - { text: "category ", color: cyan }
            - { text: "+8", color: green }
        - segments:
            - { text: "product ", color: cyan }
            - { text: "+20", color: green }
      outro:
        - { text: "Committed ", color: default }
        - { text: "30", color: green }
        - { text: " changes to ", color: default }
        - { text: "my-shop.example.com", color: cyan }
    - command: clear
    - command: fakeware down
      banner: yellow
      intro: fakeware down
      confirm:
        question:
          - { text: "Delete ", color: default }
          - { text: "30", color: red }
          - { text: " record(s) created by fakeware from ", color: default }
          - { text: "my-shop.example.com", color: cyan }
          - { text: "?", color: default }
        confirmLabel: Yes
        cancelLabel: No
        answer: confirm
      spinner:
        active: Removing…
        done: Removed
        doneCount: 3 entities
        entities:
          - product
          - category
          - tax
      rows:
        - segments:
            - { text: "product ", color: cyan }
            - { text: "-20", color: red }
        - segments:
            - { text: "category ", color: cyan }
            - { text: "-8", color: red }
        - segments:
            - { text: "tax ", color: cyan }
            - { text: "-2", color: red }
      outro:
        - { text: "Removed ", color: default }
        - { text: "30", color: green }
        - { text: " records from ", color: default }
        - { text: "my-shop.example.com", color: cyan }
    - command: clear
  ---
  ::::

```ts [products.ts]
import { define, many } from '@fakeware/core'

define(
  'product',
  many(20, (ctx) => ({
    name: `Demo product ${ctx.index + 1}`,
    productNumber: `SW-${10000 + ctx.index}`,
    stock: 100,
  })),
)
```

```ts [catalog.ts]
import { define, ref } from '@fakeware/core'

define('tax', { $key: 'standard', name: 'Standard rate', taxRate: 19 })

define('product', {
  name: 'Referenced product',
  taxId: ref('tax').key('standard'),
  categories: ref('category').pick(2),
})
```

```ts [pricing.ts]
import { define, shop } from '@fakeware/core'

define('product', {
  name: 'Priced product',
  price: [{
    currencyId: shop.defaultCurrency,
    gross: 19.99,
    net: 16.8,
    linked: true,
  }],
})
```
:::
::

::u-page-section
---
features:
  - title: Typed, declarative data
    description: Describe entities as plain objects with a tiny define / ref / shop language. Full TypeScript inference, no boilerplate.
    icon: i-lucide-file-code
  - title: Deterministic by design
    description: Stable UUIDs and content hashing mean the same definitions always produce the same records. Re-running changes nothing.
    icon: i-lucide-fingerprint
  - title: Apply and revert
    description: fakeware up syncs only what changed. fakeware down removes exactly what it created, tracked in a per-shop manifest.
    icon: i-lucide-arrow-down-up
  - title: Shop-aware references
    description: Resolve currencies, taxes, countries, salutations and states from the live shop, so your data lands valid every time.
    icon: i-lucide-store
  - title: Relationships that just work
    description: Reference other entities by key, index or a seeded random pick, and Fakeware orders the writes for you.
    icon: i-lucide-workflow
  - title: Safe to re-run
    description: Idempotent syncs, crash-safe manifest writes and resilient teardown make Fakeware safe in scripts and CI.
    icon: i-lucide-shield-check
---
#title
Everything you need to seed a shop

#description
Fakeware is built for developers who want realistic, reproducible Shopware data without hand-crafting fixtures or clicking through the admin.
::

::u-page-section
  :::u-page-c-t-a
  ---
  links:
    - label: Read the guide
      to: /docs/usage/guide/introduction
      icon: i-lucide-book-open
      color: primary
    - label: Browse the reference
      to: /docs/usage/reference/cli
      color: neutral
      variant: subtle
      trailingIcon: i-lucide-arrow-right
  ---
  #title
  Seed your first shop in minutes

  #description
  Scaffold a project, point it at your Shopware store, and run `fakeware up`.
  :::
::
