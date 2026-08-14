---
'@fakeware/cli': minor
---

Add `--json` to `up`, `down` and `validate`, with one shared error shape

`status` was the only command that could be scripted. Now all four print a single JSON document to stdout under `--json`, with no spinner, colors or prompts. Success payloads are the command result itself, unwrapped, so the existing `status --json` shape is unchanged.

Failures now emit the same envelope everywhere, `{ "ok": false, "error": { "kind", "message" } }`, where `kind` is a stable tag such as `config`, `pluginCheck` or `shopwareApi`. Shop API errors also carry `entity`, `status` and per-record `details`, and `--verbose` adds a `stack`. This also fixes `status --json`, which previously printed human-readable prose on error and broke any script parsing its output.

Since `down` cannot ask for confirmation in this mode, `--json` requires `--yes` or `--dry-run` and otherwise refuses to delete anything.
