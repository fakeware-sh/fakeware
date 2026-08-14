---
'@fakeware/core': patch
---

Let `process.env` take precedence over `.env`

`.env` was merged on top of `process.env`, so a stale local file silently overrode credentials exported in the shell or injected by CI. The precedence is now the other way round, matching dotenv and the rest of the ecosystem: `.env` fills in what the environment does not already provide, and the real environment always wins.

If you relied on a local `.env` overriding an exported variable, unset the variable in your shell or change the value in `.env` to match.
