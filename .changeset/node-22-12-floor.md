---
'@fakeware/plugin-pickware': minor
'create-fakeware': minor
'@fakeware/core': minor
'@fakeware/cli': minor
---

Require Node.js 22.12 or newer

The CLI now depends on Commander 15, which is ESM only and needs Node 22.12. The declared engine range moves from 22.6 to 22.12 across every published package so the requirement is visible at install time instead of surfacing as a runtime failure. Bun users are unaffected.
