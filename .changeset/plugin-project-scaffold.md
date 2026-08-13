---
"@fakeware/cli": patch
---

Scaffold plugin projects with `fakeware init`.

`ScaffoldValues` accepts `template: 'plugin'`, which writes a publishable plugin package instead of the project config and `.env`: a `package.json` with a bounded `@fakeware/core` peer range, a `tsconfig.json` wired to bun types so the generated test typechecks, `src/index.ts` with `definePlugin` and an example `ShopContextFetcher` built on `searchAll`/`unwrapRows`, `src/index.test.ts` using `createTestClient` and `createTestPluginContext`, and a README with a publishing checklist.
