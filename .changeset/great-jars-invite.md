---
'@fakeware/core': minor
'@fakeware/cli': minor
---

**Breaking:** data files are now declared with a required `include` glob list

Fakeware used to walk a hardcoded `data/` directory. The directory name was invisible in your config, could not be renamed, and could not be split. It is now an explicit list of globs:

```ts
export default defineConfig({
  include: ['./data/**/*.ts'],
  shopware: { /* … */ },
})
```

**To migrate,** add that one line to your `fakeware.config.ts`. It reproduces the previous behavior exactly. Projects scaffolded by `fakeware init` already include it.

`include` is required and must list at least one pattern. Leaving it out fails with a message naming your config file and the snippet to add, rather than silently applying nothing. Patterns resolve relative to the project root, may negate (`'!./data/drafts/**'`), and are confined to the project root. `node_modules`, `*.test.ts` and `*.d.ts` stay ignored, and matched files are deduplicated and sorted so evaluation order is stable.

`up` and `validate` now name your own patterns when nothing matches, instead of reporting a `./data` directory you may not have.
