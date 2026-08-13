---
"@fakeware/plugin-pickware": major
---

Replace `PICKWARE_LIVE_VERSION` with `LIVE_VERSION_ID`, re-exported from `@fakeware/core/shopware`. Update imports to the new name. `returnOrder` accepts `state: false` to omit `stateId` entirely and let the state machine assign its initial state, and the record helpers no longer mutate their input objects when pruning undefined fields.
