# Changelog

## 0.2.1

### Patch Changes

- [`2b10592`](https://github.com/fakeware-sh/fakeware/commit/2b10592020b1b08261fda6547600cb45ec872342) Thanks [@aiomayo](https://github.com/aiomayo)! - Improve the npm package pages
  
  Every published package now ships a README, so the npm page shows what the package does instead of rendering empty. Each one also declares the fakeware.sh homepage, an issues URL, and keywords, and the thin descriptions on the core, cli and scaffolder packages are replaced with ones that say what they actually do.
- Updated dependencies [[`2b10592`](https://github.com/fakeware-sh/fakeware/commit/2b10592020b1b08261fda6547600cb45ec872342)]:
  - @fakeware/core@0.2.1

## 0.2.0

### Minor Changes

- [`0cd0657`](https://github.com/fakeware-sh/fakeware/commit/0cd065785c31fdfe15292dc374abfeee4382de1c) Thanks [@aiomayo](https://github.com/aiomayo)! - Require Node.js 22.12 or newer
  
  The CLI now depends on Commander 15, which is ESM only and needs Node 22.12. The declared engine range moves from 22.6 to 22.12 across every published package so the requirement is visible at install time instead of surfacing as a runtime failure. Bun users are unaffected.

- [`3c80f29`](https://github.com/fakeware-sh/fakeware/commit/3c80f2935652e8d2ea37d1b715afb60f064a8c54) Thanks [@aiomayo](https://github.com/aiomayo)! - Plugins can declare compatibility checks
  
  A plugin can now ship a `checks` array next to its `fetchers`. Each check answers one question about the target shop and returns a `CheckOutcome` with a level of `error` (aborts the run) or `warn` (prints and continues). `up` and `down` run every check before they fetch the shop context, so a shop that is not set up for a plugin fails with that plugin's own message instead of an opaque fetcher error later on.
  
  Core ships `fetchInstalledExtension` and `satisfiesMinVersion` so a check can look up an installed Shopware plugin or app by technical name without hand-rolling the search. Checks that read the shop mark themselves with `needsShop`; reading the client without it throws.
  
  `fakeware validate` runs plugin checks too and renders them as a `Plugin checks` row. Checks that need the shop run by default, and are skipped either with `--no-shop-checks` or automatically when the config has no usable shop credentials.
  
  The pickware plugin uses this to verify Pickware ERP is installed and activated, warning instead of failing when the API credentials lack the `plugin:read` privilege.

### Patch Changes

- Updated dependencies [[`0cd0657`](https://github.com/fakeware-sh/fakeware/commit/0cd065785c31fdfe15292dc374abfeee4382de1c), [`3c80f29`](https://github.com/fakeware-sh/fakeware/commit/3c80f2935652e8d2ea37d1b715afb60f064a8c54)]:
  - @fakeware/core@0.2.0

## 0.1.0

### Minor Changes

- [`fec04b8`](https://github.com/fakeware-sh/fakeware/commit/fec04b86c79177d6ba0f813adfb22bc3b05f3bf9) Thanks [@aiomayo](https://github.com/aiomayo)! - Add `fakeware init --template project|plugin` and an opt-out example data file.
  
  The plugin scaffold was implemented but unreachable, with no flag wired to it. `--template plugin` now scaffolds a plugin package; `--template project` (the default) scaffolds a data project.
  
  Project scaffolds now include an example `data/products.ts` so the first `fakeware up` does something instead of reporting an empty plan. Opt out with `--no-example-data`, or answer the new "Include an example data file?" prompt.
  
  `init` is split into `commands/init/{index,flags,gather,execute,outro}.ts`. Cancels and failures now use the shared exit codes, an implicit non-interactive run warns instead of being silent, a non-interactive run with no plugin flag says so, `--dry-run` warns when the target directory is not empty, and a failed scaffold rolls back the files it already wrote.

- [`1eb139b`](https://github.com/fakeware-sh/fakeware/commit/1eb139b8b61a00c3af4109d2757dfde61ac22867) Thanks [@aiomayo](https://github.com/aiomayo)! - Add `fakeware status`, an offline view of what fakeware has applied to a shop.
  
  It reads the local manifest without touching the network: shop URL, config path, active plugins, when the data was applied and by which fakeware version, plus a per-entity record-count table. Entities left unconfirmed by an interrupted run are flagged as pending, with a note that the next `fakeware up` re-applies them.
  
  `--json` prints the same report as machine-readable JSON on stdout with no decoration, so it pipes into `jq`. A missing manifest is reported as `null` rather than being omitted, and exits 0; a corrupt manifest exits 1.

- [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064) Thanks [@aiomayo](https://github.com/aiomayo)! - Add `fakeware validate` and the `validateProject` API behind it.
  
  `validateProject(loaded)` runs the whole pipeline offline: it discovers data files, evaluates them, and builds the write plan without contacting the shop. Failures are classified per check (`dataFiles`, `definitions`, `references`, `graph`) instead of surfacing as a raw throw.
  
  Shop tokens resolve against a placeholder context, so `shop.tax(19)` and friends never fail validation for want of a live shop. This also means a shop lookup can no longer mask a real reference or graph error later in the same project.
  
  Data files that read live shop values (`shop.context()`, `shop.extensions`) can still throw during planning. That is reported as `shopDependent` rather than as a failure: the CLI marks the reference and graph checks as needing the shop and exits 0, because those definitions are only checkable on `fakeware up`.
  
  The CLI prints a per-check checklist and exits 1 with the offending message when something is genuinely broken.

### Patch Changes

- [`f74b953`](https://github.com/fakeware-sh/fakeware/commit/f74b953d59c3fe40a0a2cae74c79a56895388381) Thanks [@aiomayo](https://github.com/aiomayo)! - Normalise scaffolded config imports to match the rest of the generated file, share a single package manager list, and drop the unused `withSpinner` helper.

- [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb) Thanks [@aiomayo](https://github.com/aiomayo)! - Raise the Node.js floor to 22.6, build for the node22 target, and move @fakeware/plugin-pickware into the fakeware monorepo

- [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064) Thanks [@aiomayo](https://github.com/aiomayo)! - Reword CLI and error messages to drop em dashes in favour of plain sentences.
  
  Affects `up`, `down`, `init`, the shop prompts, the scaffolded plugin README and the `ref(...)` out-of-range error. Wording only, no behaviour change.

- [`f7376db`](https://github.com/fakeware-sh/fakeware/commit/f7376db00e77c3ef1206e1bae91174e4ccc954a0) Thanks [@aiomayo](https://github.com/aiomayo)! - Scaffold plugin projects with `fakeware init`.
  
  `ScaffoldValues` accepts `template: 'plugin'`, which writes a publishable plugin package instead of the project config and `.env`: a `package.json` with a bounded `@fakeware/core` peer range, a `tsconfig.json` wired to bun types so the generated test typechecks, `src/index.ts` with `definePlugin` and an example `ShopContextFetcher` built on `searchAll`/`unwrapRows`, `src/index.test.ts` using `createTestClient` and `createTestPluginContext`, and a README with a publishing checklist.

- [`e6b1520`](https://github.com/fakeware-sh/fakeware/commit/e6b15209d76fa54f97339db6bd599ba6665527b6) Thanks [@aiomayo](https://github.com/aiomayo)! - Derive the official plugin registry version from the plugin's own package.json so a scaffolded project can never pin a version that was never published.
- Updated dependencies [[`226d96d`](https://github.com/fakeware-sh/fakeware/commit/226d96db6dbb73c4e3fd6348551dad70a96972d4), [`f7376db`](https://github.com/fakeware-sh/fakeware/commit/f7376db00e77c3ef1206e1bae91174e4ccc954a0), [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064)]:
  - @fakeware/core@0.1.0

## [0.0.12](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.11...cli-v0.0.12) (2026-07-05)


### Features

* add official plugin support to init scaffolding ([62a194f](https://github.com/fakeware-sh/fakeware/commit/62a194fac8e8cfb6937b08a2043f5568b6877038))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.11

## [0.0.11](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.10...cli-v0.0.11) (2026-07-01)


### Features

* add plugin hooks, logging, and testing support ([0e5bb78](https://github.com/fakeware-sh/fakeware/commit/0e5bb78a59e773530099989448d380dd7d70f494))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.10

## [0.0.10](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.9...cli-v0.0.10) (2026-06-09)


### Features

* **core:** add dynamic Shopware shop context for id-free lookups ([c6a5e97](https://github.com/fakeware-sh/fakeware/commit/c6a5e97a8431e35fcb0a51adccee518bc0c368f0))


### Bug Fixes

* node types in tsconfig scaffold ([2080273](https://github.com/fakeware-sh/fakeware/commit/2080273472827b51e338a37d83001ca2993eb608))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.9

## [0.0.9](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.8...cli-v0.0.9) (2026-06-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.8

## [0.0.8](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.7...cli-v0.0.8) (2026-06-08)


### Features

* make up transactional and load user files via jiti ([0ce23cd](https://github.com/fakeware-sh/fakeware/commit/0ce23cd03dfcb6057ed03c4bc112bc2b0a9e32f5))
* report batch progress and format Shopware errors ([3994caa](https://github.com/fakeware-sh/fakeware/commit/3994caa3111bf023930eeb3a06950859e65d4aa2))


### Bug Fixes

* core and cli version on scaffold ([78b6a21](https://github.com/fakeware-sh/fakeware/commit/78b6a212a509f4aeb35b48bc096250563ab39f99))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.7

## [0.0.7](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.6...cli-v0.0.7) (2026-06-01)


### Features

* add tsconfig to scaffold ([9ed3e62](https://github.com/fakeware-sh/fakeware/commit/9ed3e625eb2ce472ec0894c7256e72089c1f0d9b))

## [0.0.6](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.5...cli-v0.0.6) (2026-05-31)


### Features

* add core as dev dependency in scaffold ([da7ec29](https://github.com/fakeware-sh/fakeware/commit/da7ec29fd069799c7c58aaf1082bde440875a1af))
* add create-fakeware ([371e72e](https://github.com/fakeware-sh/fakeware/commit/371e72ef4f604ae9493884240c020074ce7f6bc4))
* add init review step and consistent run phase progress ([0b59b24](https://github.com/fakeware-sh/fakeware/commit/0b59b242ac2439d2f0a39690a97688e7b84ab6d7))
* **cli:** give a clear error when the package manager is missing ([6e0af8a](https://github.com/fakeware-sh/fakeware/commit/6e0af8a056afe1a00e2bbcd5b228810d2fc5c728))
* fail fast when init target directory is not empty ([5ca2c44](https://github.com/fakeware-sh/fakeware/commit/5ca2c444b8d1dd5b35b91f9de4abc68515bca4e3))
* up and down command and manifest system ([9139d63](https://github.com/fakeware-sh/fakeware/commit/9139d63bde59fca543e1dffaaffd618ead4fa403))


### Bug Fixes

* **cli:** remove unimplemented --secrets keychain option ([10ed70d](https://github.com/fakeware-sh/fakeware/commit/10ed70d4e74ba6913c6c513efd05f2b5cc9d19fc))
* **cli:** write .gitignore before .env when scaffolding ([6637167](https://github.com/fakeware-sh/fakeware/commit/6637167ec6c8019dc950f18cb45b9f70584e45da))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.6

## [0.0.5](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.4...cli-v0.0.5) (2026-05-28)


### Features

* make shop connection optional and use ts config ([412b5bb](https://github.com/fakeware-sh/fakeware/commit/412b5bbcd3282fb7f02f461751747e88e478cd72))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.5

## [0.0.4](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.3...cli-v0.0.4) (2026-05-28)


### Features

* **core:** add shopware api client ([f8b5c2f](https://github.com/fakeware-sh/fakeware/commit/f8b5c2f408c0e001c5fbc89178f2add4dc2c06cd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/core bumped to 0.0.4

## [0.0.3](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.2...cli-v0.0.3) (2026-05-28)


### Code Refactoring

* update descriptions ([29a6120](https://github.com/fakeware-sh/fakeware/commit/29a6120c0ce036bd2e413df4e75c090683005738))

## [0.0.2](https://github.com/fakeware-sh/fakeware/compare/cli-v0.0.1...cli-v0.0.2) (2026-05-28)


### Code Refactoring

* rename fakeware-sh to fakeware ([e6c0459](https://github.com/fakeware-sh/fakeware/commit/e6c04598f005b812091221faf2c73c88f73707ba))

## 0.0.1 (2026-05-28)


### Features

* init setup and init command ([5601fd0](https://github.com/fakeware-sh/fakeware/commit/5601fd07afc4514de24d8326e0c7ad8131c072bf))


### Continuous Integration

* switch to npm registry ([3dd72be](https://github.com/fakeware-sh/fakeware/commit/3dd72be2e8083fdea6591422e68ea049b563e85d))
