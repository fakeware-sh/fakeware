---
"@fakeware/cli": minor
---

Add `fakeware status` — an offline view of what fakeware has applied to a shop.

It reads the local manifest without touching the network: shop URL, config path, active plugins, when the data was applied and by which fakeware version, plus a per-entity record-count table. Entities left unconfirmed by an interrupted run are flagged as pending, with a note that the next `fakeware up` re-applies them.

`--json` prints the same report as machine-readable JSON on stdout with no decoration, so it pipes into `jq`. A missing manifest is reported as `null` rather than being omitted, and exits 0; a corrupt manifest exits 1.
