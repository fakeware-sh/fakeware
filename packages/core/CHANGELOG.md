# Changelog

## [0.0.3](https://github.com/fakeware-sh/fakeware/compare/core-v0.0.9...core-v0.0.3) (2026-07-01)


### Features

* add core as dev dependency in scaffold ([8917ec2](https://github.com/fakeware-sh/fakeware/commit/8917ec2265a751784f43134173c291bc2002d9b1))
* add plugin hooks, logging, and testing support ([0e5bb78](https://github.com/fakeware-sh/fakeware/commit/0e5bb78a59e773530099989448d380dd7d70f494))
* add plugin system ([42d6155](https://github.com/fakeware-sh/fakeware/commit/42d6155bab4c3aad6f3815dda09a85474a2a394e))
* **core:** add a request timeout to Shopware api calls ([f263c33](https://github.com/fakeware-sh/fakeware/commit/f263c33dea31646bcb4937acf5beeb7488ba1883))
* **core:** add deterministic order association builders ([7218a5f](https://github.com/fakeware-sh/fakeware/commit/7218a5fc80eb5d4c3710570df15ee0eef1f2550b))
* **core:** add dynamic Shopware shop context for id-free lookups ([b0fd5ac](https://github.com/fakeware-sh/fakeware/commit/b0fd5ac2fa5274b97deffe5b4a731dbea10cee37))
* **core:** add shopware api client ([b510716](https://github.com/fakeware-sh/fakeware/commit/b510716b6eef979a5246e72f588c7944d5d98071))
* **core:** add Shopware price helper for gross, calculated and cart prices ([1028e76](https://github.com/fakeware-sh/fakeware/commit/1028e76cacdf93556939908ed0c3c9919f338eaa))
* **core:** order self-referential records within an entity by keyed refs ([57516b2](https://github.com/fakeware-sh/fakeware/commit/57516b222fa9a41ccaef2435842ad501fe173205))
* **core:** unify ref selectors and add typed define key map with keyed helper ([635d77a](https://github.com/fakeware-sh/fakeware/commit/635d77ae05824448165766eb38af04d7f9fda51f))
* **core:** validate Shopware language response with zod ([b4bfd17](https://github.com/fakeware-sh/fakeware/commit/b4bfd172e98856e2f80cd272e24fc290756d14d3))
* init setup and init command ([5601fd0](https://github.com/fakeware-sh/fakeware/commit/5601fd07afc4514de24d8326e0c7ad8131c072bf))
* make shop connection optional and use ts config ([f0dcc6a](https://github.com/fakeware-sh/fakeware/commit/f0dcc6a4fe72e59fcac4168bffdd7fa71e0c4dfe))
* make up transactional and load user files via jiti ([d7694cd](https://github.com/fakeware-sh/fakeware/commit/d7694cdb2b954f90d96a112e1dddf667b3f5ed7a))
* report batch progress and format Shopware errors ([17d70f0](https://github.com/fakeware-sh/fakeware/commit/17d70f0948d9ca2452e79e5498c121240b1df7c0))
* up and down command and manifest system ([72a6c97](https://github.com/fakeware-sh/fakeware/commit/72a6c979f93b1abef34070e9d8c3a251acb15510))


### Bug Fixes

* add api error guard ([6b1790f](https://github.com/fakeware-sh/fakeware/commit/6b1790f3e8b40982fac92e5a9a2047e62fe081ec))
* add pagination for state machine states fetching ([d7e7d97](https://github.com/fakeware-sh/fakeware/commit/d7e7d9728f91b2e4f1eafecffc4809ab1eb88c49))
* core and cli version on scaffold ([2e7c1db](https://github.com/fakeware-sh/fakeware/commit/2e7c1db850ed1cec8eb845a80219ebcdc11ffced))
* **core:** move withRetry into a leaf retry module so test mocks can't clobber it ([#24](https://github.com/fakeware-sh/fakeware/issues/24)) ([d7627cc](https://github.com/fakeware-sh/fakeware/commit/d7627cca3da64ae5e09a3d83c0c16c824985675a))
* jiti virtual module for core ([a8d36f3](https://github.com/fakeware-sh/fakeware/commit/a8d36f31116f8a691a7a872f312f78b6c1e3971f))


### Code Refactoring

* rename fakeware-sh to fakeware ([1468e4e](https://github.com/fakeware-sh/fakeware/commit/1468e4e4bd28259d86abc81d472fed96f4230305))
* update descriptions ([c79e993](https://github.com/fakeware-sh/fakeware/commit/c79e993b05dab6f1b2b8e33a95214669735e08ce))


### Continuous Integration

* switch to npm registry ([2805db0](https://github.com/fakeware-sh/fakeware/commit/2805db0c0bb6cbbf20e394ae96651f907edddab5))

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
