# Changelog

## 1.1.0

### Minor Changes

- [`0cd0657`](https://github.com/fakeware-sh/fakeware/commit/0cd065785c31fdfe15292dc374abfeee4382de1c) Thanks [@aiomayo](https://github.com/aiomayo)! - Require Node.js 22.12 or newer
  
  The CLI now depends on Commander 15, which is ESM only and needs Node 22.12. The declared engine range moves from 22.6 to 22.12 across every published package so the requirement is visible at install time instead of surfacing as a runtime failure. Bun users are unaffected.

### Patch Changes

- Updated dependencies [[`0cd0657`](https://github.com/fakeware-sh/fakeware/commit/0cd065785c31fdfe15292dc374abfeee4382de1c), [`3c80f29`](https://github.com/fakeware-sh/fakeware/commit/3c80f2935652e8d2ea37d1b715afb60f064a8c54)]:
  - @fakeware/cli@0.2.0

## 1.0.7

### Patch Changes

- [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb) Thanks [@aiomayo](https://github.com/aiomayo)! - Raise the Node.js floor to 22.6, build for the node22 target, and move @fakeware/plugin-pickware into the fakeware monorepo
- Updated dependencies [[`f74b953`](https://github.com/fakeware-sh/fakeware/commit/f74b953d59c3fe40a0a2cae74c79a56895388381), [`fec04b8`](https://github.com/fakeware-sh/fakeware/commit/fec04b86c79177d6ba0f813adfb22bc3b05f3bf9), [`9e27c71`](https://github.com/fakeware-sh/fakeware/commit/9e27c714568694736b4e7a31d4bc355962a3cfdb), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064), [`f7376db`](https://github.com/fakeware-sh/fakeware/commit/f7376db00e77c3ef1206e1bae91174e4ccc954a0), [`e6b1520`](https://github.com/fakeware-sh/fakeware/commit/e6b15209d76fa54f97339db6bd599ba6665527b6), [`1eb139b`](https://github.com/fakeware-sh/fakeware/commit/1eb139b8b61a00c3af4109d2757dfde61ac22867), [`18dc845`](https://github.com/fakeware-sh/fakeware/commit/18dc845728d1e63f73340e87fe7ed4220ad05064)]:
  - @fakeware/cli@0.1.0

## [1.0.6](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.5...create-fakeware-v1.0.6) (2026-07-05)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.12

## [1.0.5](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.4...create-fakeware-v1.0.5) (2026-07-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.11

## [1.0.4](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.3...create-fakeware-v1.0.4) (2026-06-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.10

## [1.0.3](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.2...create-fakeware-v1.0.3) (2026-06-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.9

## [1.0.2](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.1...create-fakeware-v1.0.2) (2026-06-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.8

## [1.0.1](https://github.com/fakeware-sh/fakeware/compare/create-fakeware-v1.0.0...create-fakeware-v1.0.1) (2026-06-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.7

## 1.0.0 (2026-05-31)


### Features

* add create-fakeware ([371e72e](https://github.com/fakeware-sh/fakeware/commit/371e72ef4f604ae9493884240c020074ce7f6bc4))


### Bug Fixes

* remove test script ([6696c51](https://github.com/fakeware-sh/fakeware/commit/6696c51433ec3c1de2608d7dac8fe39257e8a5e9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @fakeware/cli bumped to 0.0.6
