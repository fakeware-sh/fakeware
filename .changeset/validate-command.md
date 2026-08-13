---
"@fakeware/core": minor
"@fakeware/cli": minor
---

Add `fakeware validate` and the `validateProject` API behind it.

`validateProject(loaded)` runs the whole pipeline offline: it discovers data files, evaluates them, and builds the write plan without contacting the shop. Failures are classified per check (`dataFiles`, `definitions`, `references`, `graph`) instead of surfacing as a raw throw.

Shop tokens resolve against a placeholder context, so `shop.tax(19)` and friends never fail validation for want of a live shop. This also means a shop lookup can no longer mask a real reference or graph error later in the same project.

Data files that read live shop values (`shop.context()`, `shop.extensions`) can still throw during planning. That is reported as `shopDependent` rather than as a failure: the CLI marks the reference and graph checks as needing the shop and exits 0, because those definitions are only checkable on `fakeware up`.

The CLI prints a per-check checklist and exits 1 with the offending message when something is genuinely broken.
