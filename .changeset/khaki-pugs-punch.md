---
'@fakeware/core': minor
---

Split large entity payloads into batches instead of failing

Shopware accepts at most 5 MB per sync request. Fakeware used to check the payload up front and throw a `ShopwareApiError` telling you to reduce the number of records, which is an odd thing to ask of a tool whose job is generating many records: a few thousand products with rich descriptions was enough to hit it, with no recourse other than splitting your data files by hand.

An entity over the limit is now split into sequential batches that each fit. Write order is preserved, so intra-entity dependencies still hold, and every batch goes through the existing retry policy on its own. The manifest is unchanged: an entity is confirmed only once all of its batches have landed, so an interrupted run still leaves it `pending` and a repeated `up` converges.

Deletes chunk the same way, which lifts the same ceiling from `down` on large manifests.

A single record over the limit still fails, since there is nothing to split. That error now names the entity and suggests uploading large content as media rather than inlining it.
