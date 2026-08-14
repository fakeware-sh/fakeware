---
'@fakeware/plugin-pickware': minor
'@fakeware/core': minor
'@fakeware/cli': minor
---

Plugins can declare compatibility checks

A plugin can now ship a `checks` array next to its `fetchers`. Each check answers one question about the target shop and returns a `CheckOutcome` with a level of `error` (aborts the run) or `warn` (prints and continues). `up` and `down` run every check before they fetch the shop context, so a shop that is not set up for a plugin fails with that plugin's own message instead of an opaque fetcher error later on.

Core ships `fetchInstalledExtension` and `satisfiesMinVersion` so a check can look up an installed Shopware plugin or app by technical name without hand-rolling the search. Checks that read the shop mark themselves with `needsShop`; reading the client without it throws.

`fakeware validate` runs plugin checks too and renders them as a `Plugin checks` row. Checks that need the shop run by default, and are skipped either with `--no-shop-checks` or automatically when the config has no usable shop credentials.

The pickware plugin uses this to verify Pickware ERP is installed and activated, warning instead of failing when the API credentials lack the `plugin:read` privilege.
