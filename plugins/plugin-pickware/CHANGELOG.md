# Changelog

## 2.1.0

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

## 2.0.0

### Major Changes

- [`226d96d`](https://github.com/fakeware-sh/fakeware/commit/226d96db6dbb73c4e3fd6348551dad70a96972d4) Thanks [@aiomayo](https://github.com/aiomayo)! - Replace `PICKWARE_LIVE_VERSION` with `LIVE_VERSION_ID`, re-exported from `@fakeware/core/shopware`. Update imports to the new name. `returnOrder` accepts `state: false` to omit `stateId` entirely and let the state machine assign its initial state, and the record helpers no longer mutate their input objects when pruning undefined fields.

### Patch Changes

- [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb) Thanks [@aiomayo](https://github.com/aiomayo)! - Raise the Node.js floor to 22.6, build for the node22 target, and move @fakeware/plugin-pickware into the fakeware monorepo
- Updated dependencies [[`226d96d`](https://github.com/fakeware-sh/fakeware/commit/226d96db6dbb73c4e3fd6348551dad70a96972d4), [`f7376db`](https://github.com/fakeware-sh/fakeware/commit/f7376db00e77c3ef1206e1bae91174e4ccc954a0), [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064)]:
  - @fakeware/core@0.1.0

## [1.1.0](https://github.com/fakeware-sh/plugin-pickware/compare/plugin-pickware-v1.0.0...plugin-pickware-v1.1.0) (2026-07-01)


### Features

* add suppliers, return orders & warehouse pagination ([3920605](https://github.com/fakeware-sh/plugin-pickware/commit/3920605cb03b3edf2c291d23c5e5b5bea2309b63))


### Bug Fixes

* handle nested search response and update fetch path ([76b2fb6](https://github.com/fakeware-sh/plugin-pickware/commit/76b2fb683ce20494f728f306a1167cdbf67507d1))

## 1.0.0 (2026-06-09)


### Features

* add readme ([9e741cc](https://github.com/fakeware-sh/plugin-pickware/commit/9e741cce53fb1725c3ecca2d794636571ff87d0e))
