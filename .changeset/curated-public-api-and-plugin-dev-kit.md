---
"@fakeware/core": minor
---

Curate the public API surface and add a plugin dev kit.

The root `@fakeware/core` barrel now exports only the authoring, engine and plugin-authoring surface. Internal token machinery (`PickToken`, `RefIndexToken`, `RefsToken`, `RefToken`, `ReferenceToken`), the unused `RefPath` type, and the sink types (`ShopwareSink`, `SinkRecord`, `MediaUploadRecord`) are no longer exported from the root. The sink types moved to `@fakeware/core/shopware`. `price` is promoted to the root alongside `media`, and `isShopToken`/`isShopValueToken` are exported so plugin authors can narrow tokens without hand-rolled guards. `setActiveShopContext` and `shop` are gone from `@fakeware/core/shopware`.

New in `@fakeware/core/shopware`: `invokeAdmin`, `searchAll`, `unwrapRows`, `unwrapTotal` and `SEARCH_LIMIT`. `invokeAdmin` is the single sanctioned home for the untyped casts against `@shopware/api-client`, and `searchAll` pages an admin search endpoint to completion, so plugin fetchers no longer need their own pagination loops or casts.

`@fakeware/core/testing` grows into a real plugin dev kit: `createTestClient` (canned admin responses matched by operation substring, with call recording), `fakeShopContext` and `createInMemorySink` now live here instead of shipping inside the production entrypoints.
