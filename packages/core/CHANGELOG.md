# Changelog

## 0.2.1

### Patch Changes

- [`2b10592`](https://github.com/fakeware-sh/fakeware/commit/2b10592020b1b08261fda6547600cb45ec872342) Thanks [@aiomayo](https://github.com/aiomayo)! - Improve the npm package pages
  
  Every published package now ships a README, so the npm page shows what the package does instead of rendering empty. Each one also declares the fakeware.sh homepage, an issues URL, and keywords, and the thin descriptions on the core, cli and scaffolder packages are replaced with ones that say what they actually do.

## 0.2.0

### Minor Changes

- [`0cd0657`](https://github.com/fakeware-sh/fakeware/commit/0cd065785c31fdfe15292dc374abfeee4382de1c) Thanks [@aiomayo](https://github.com/aiomayo)! - Require Node.js 22.12 or newer
  
  The CLI now depends on Commander 15, which is ESM only and needs Node 22.12. The declared engine range moves from 22.6 to 22.12 across every published package so the requirement is visible at install time instead of surfacing as a runtime failure. Bun users are unaffected.

- [`3c80f29`](https://github.com/fakeware-sh/fakeware/commit/3c80f2935652e8d2ea37d1b715afb60f064a8c54) Thanks [@aiomayo](https://github.com/aiomayo)! - Plugins can declare compatibility checks
  
  A plugin can now ship a `checks` array next to its `fetchers`. Each check answers one question about the target shop and returns a `CheckOutcome` with a level of `error` (aborts the run) or `warn` (prints and continues). `up` and `down` run every check before they fetch the shop context, so a shop that is not set up for a plugin fails with that plugin's own message instead of an opaque fetcher error later on.
  
  Core ships `fetchInstalledExtension` and `satisfiesMinVersion` so a check can look up an installed Shopware plugin or app by technical name without hand-rolling the search. Checks that read the shop mark themselves with `needsShop`; reading the client without it throws.
  
  `fakeware validate` runs plugin checks too and renders them as a `Plugin checks` row. Checks that need the shop run by default, and are skipped either with `--no-shop-checks` or automatically when the config has no usable shop credentials.
  
  The pickware plugin uses this to verify Pickware ERP is installed and activated, warning instead of failing when the API credentials lack the `plugin:read` privilege.

## 0.1.0

### Minor Changes

- [`226d96d`](https://github.com/fakeware-sh/fakeware/commit/226d96db6dbb73c4e3fd6348551dad70a96972d4) Thanks [@aiomayo](https://github.com/aiomayo)! - Harden the core sync engine and shrink its internals: shop-context fetchers now paginate past 500 rows with retry and bounded concurrency, rate-limit `Retry-After` headers are honored, plugin `onError` hooks fire on real sync failures, `plugins` are validated by the config schema, media byte uploads get a request timeout plus a one-shot token refresh on 401, manifests are shape-validated with clear errors and failed writes clean up their temp files, `$VAR`/`${VAR}` interpolation works inside strings, the `.env` parser accepts `export` prefixes and reports malformed lines, and non-ENOENT filesystem errors surface instead of being swallowed. Order builders now resolve their default tax rate from the shop context instead of a hardcoded 19%. Orders that relied on the implicit German default and run against a shop whose highest tax rate differs will now use the shop's rate; pass an explicit `tax` to keep the old value. New exports: `LIVE_VERSION_ID` and `adminBaseUrl` from `@fakeware/core/shopware`, `DEFAULT_MODE` from `@fakeware/core/config`.

- [`f7376db`](https://github.com/fakeware-sh/fakeware/commit/f7376db00e77c3ef1206e1bae91174e4ccc954a0) Thanks [@aiomayo](https://github.com/aiomayo)! - Curate the public API surface and add a plugin dev kit.
  
  The root `@fakeware/core` barrel now exports only the authoring, engine and plugin-authoring surface. Internal token machinery (`PickToken`, `RefIndexToken`, `RefsToken`, `RefToken`, `ReferenceToken`), the unused `RefPath` type, and the sink types (`ShopwareSink`, `SinkRecord`, `MediaUploadRecord`) are no longer exported from the root. The sink types moved to `@fakeware/core/shopware`. `price` is promoted to the root alongside `media`, and `isShopToken`/`isShopValueToken` are exported so plugin authors can narrow tokens without hand-rolled guards. `setActiveShopContext` and `shop` are gone from `@fakeware/core/shopware`.
  
  New in `@fakeware/core/shopware`: `invokeAdmin`, `searchAll`, `unwrapRows`, `unwrapTotal` and `SEARCH_LIMIT`. `invokeAdmin` is the single sanctioned home for the untyped casts against `@shopware/api-client`, and `searchAll` pages an admin search endpoint to completion, so plugin fetchers no longer need their own pagination loops or casts.
  
  `@fakeware/core/testing` grows into a real plugin dev kit: `createTestClient` (canned admin responses matched by operation substring, with call recording), `fakeShopContext` and `createInMemorySink` now live here instead of shipping inside the production entrypoints.

- [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064) Thanks [@aiomayo](https://github.com/aiomayo)! - Add `fakeware validate` and the `validateProject` API behind it.
  
  `validateProject(loaded)` runs the whole pipeline offline: it discovers data files, evaluates them, and builds the write plan without contacting the shop. Failures are classified per check (`dataFiles`, `definitions`, `references`, `graph`) instead of surfacing as a raw throw.
  
  Shop tokens resolve against a placeholder context, so `shop.tax(19)` and friends never fail validation for want of a live shop. This also means a shop lookup can no longer mask a real reference or graph error later in the same project.
  
  Data files that read live shop values (`shop.context()`, `shop.extensions`) can still throw during planning. That is reported as `shopDependent` rather than as a failure: the CLI marks the reference and graph checks as needing the shop and exits 0, because those definitions are only checkable on `fakeware up`.
  
  The CLI prints a per-check checklist and exits 1 with the offending message when something is genuinely broken.

### Patch Changes

- [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb) Thanks [@aiomayo](https://github.com/aiomayo)! - Raise the Node.js floor to 22.6, build for the node22 target, and move @fakeware/plugin-pickware into the fakeware monorepo

- [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064) Thanks [@aiomayo](https://github.com/aiomayo)! - Reword CLI and error messages to drop em dashes in favour of plain sentences.
  
  Affects `up`, `down`, `init`, the shop prompts, the scaffolded plugin README and the `ref(...)` out-of-range error. Wording only, no behaviour change.

## [0.0.11](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.10...core-v0.0.11) (2026-07-05)


### Features

* add media upload and cover/gallery support ([4b9b119](https://github.com/fakeware-sh/fakeware/commit/4b9b1196942412cc0aace75a1e97edb1883d386a))
* add RecordExtensions support and tests ([ff51f1c](https://github.com/fakeware-sh/fakeware/commit/ff51f1ce7e1ebce39eaf805313f8d7ab84eae583))
* add ShopValueToken and deferred tax support ([ebb6672](https://github.com/fakeware-sh/fakeware/commit/ebb66729572f0b9cea51ec8c45aef2dde07d88b4))

## [0.0.10](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.9...core-v0.0.10) (2026-07-01)


### Features

* add plugin hooks, logging, and testing support ([0e5bb78](https://github.com/fakeware-sh/fakeware/commit/0e5bb78a59e773530099989448d380dd7d70f494))
* **core:** add deterministic order association builders ([7218a5f](https://github.com/fakeware-sh/fakeware/commit/7218a5fc80eb5d4c3710570df15ee0eef1f2550b))
* **core:** add Shopware price helper for gross, calculated and cart prices ([1028e76](https://github.com/fakeware-sh/fakeware/commit/1028e76cacdf93556939908ed0c3c9919f338eaa))
* **core:** order self-referential records within an entity by keyed refs ([57516b2](https://github.com/fakeware-sh/fakeware/commit/57516b222fa9a41ccaef2435842ad501fe173205))
* **core:** unify ref selectors and add typed define key map with keyed helper ([635d77a](https://github.com/fakeware-sh/fakeware/commit/635d77ae05824448165766eb38af04d7f9fda51f))


### Bug Fixes

* add api error guard ([6b1790f](https://github.com/fakeware-sh/fakeware/commit/6b1790f3e8b40982fac92e5a9a2047e62fe081ec))
* add pagination for state machine states fetching ([d7e7d97](https://github.com/fakeware-sh/fakeware/commit/d7e7d9728f91b2e4f1eafecffc4809ab1eb88c49))
* **core:** move withRetry into a leaf retry module so test mocks can't clobber it ([#24](https://github.com/fakeware-sh/fakeware/issues/24)) ([d7627cc](https://github.com/fakeware-sh/fakeware/commit/d7627cca3da64ae5e09a3d83c0c16c824985675a))

## [0.0.9](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.8...core-v0.0.9) (2026-06-09)


### Features

* add plugin system ([d878014](https://github.com/fakeware-sh/fakeware/commit/d8780149af6f40543a54e541fe9babbb37cff5ea))
* **core:** add dynamic Shopware shop context for id-free lookups ([c6a5e97](https://github.com/fakeware-sh/fakeware/commit/c6a5e97a8431e35fcb0a51adccee518bc0c368f0))

## [0.0.8](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.7...core-v0.0.8) (2026-06-08)


### Bug Fixes

* jiti virtual module for core ([2f96d85](https://github.com/fakeware-sh/fakeware/commit/2f96d85265699e8c06af012c93b7c69980b3b714))

## [0.0.7](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.6...core-v0.0.7) (2026-06-08)


### Features

* make up transactional and load user files via jiti ([0ce23cd](https://github.com/fakeware-sh/fakeware/commit/0ce23cd03dfcb6057ed03c4bc112bc2b0a9e32f5))
* report batch progress and format Shopware errors ([3994caa](https://github.com/fakeware-sh/fakeware/commit/3994caa3111bf023930eeb3a06950859e65d4aa2))


### Bug Fixes

* core and cli version on scaffold ([78b6a21](https://github.com/fakeware-sh/fakeware/commit/78b6a212a509f4aeb35b48bc096250563ab39f99))

## [0.0.6](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.5...core-v0.0.6) (2026-05-31)


### Features

* add core as dev dependency in scaffold ([da7ec29](https://github.com/fakeware-sh/fakeware/commit/da7ec29fd069799c7c58aaf1082bde440875a1af))
* **core:** add a request timeout to Shopware api calls ([9933039](https://github.com/fakeware-sh/fakeware/commit/993303994c8da6beb40ef9762127b4b07b931394))
* **core:** validate Shopware language response with zod ([384a4c6](https://github.com/fakeware-sh/fakeware/commit/384a4c69bbedb6609663c5c2a6846afb37c4664f))
* up and down command and manifest system ([9139d63](https://github.com/fakeware-sh/fakeware/commit/9139d63bde59fca543e1dffaaffd618ead4fa403))

## [0.0.5](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.4...core-v0.0.5) (2026-05-28)


### Features

* make shop connection optional and use ts config ([412b5bb](https://github.com/fakeware-sh/fakeware/commit/412b5bbcd3282fb7f02f461751747e88e478cd72))

## [0.0.4](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.3...core-v0.0.4) (2026-05-28)


### Features

* **core:** add shopware api client ([f8b5c2f](https://github.com/fakeware-sh/fakeware/commit/f8b5c2f408c0e001c5fbc89178f2add4dc2c06cd))

## [0.0.3](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.2...core-v0.0.3) (2026-05-28)


### Code Refactoring

* update descriptions ([29a6120](https://github.com/fakeware-sh/fakeware/commit/29a6120c0ce036bd2e413df4e75c090683005738))

## [0.0.2](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.1...core-v0.0.2) (2026-05-28)


### Code Refactoring

* rename fakeware-sh to fakeware ([e6c0459](https://github.com/fakeware-sh/fakeware/commit/e6c04598f005b812091221faf2c73c88f73707ba))

## 0.0.1 (2026-05-28)


### Features

* init setup and init command ([5601fd0](https://github.com/fakeware-sh/fakeware/commit/5601fd07afc4514de24d8326e0c7ad8131c072bf))


### Continuous Integration

* switch to npm registry ([3dd72be](https://github.com/fakeware-sh/fakeware/commit/3dd72be2e8083fdea6591422e68ea049b563e85d))
