---
'@fakeware/cli': patch
---

Honor the root `--verbose` flag in every command

`fakeware --verbose up` set the root option, but `up` and `down` read only their own `--verbose`, which defaulted to `false`, so plugin debug logs were silently dropped when the flag came before the subcommand. Error reporting had the opposite problem: it scanned `process.argv` directly instead of reading the parsed value.

Both now resolve the flag through Commander, so `--verbose` behaves the same before or after the subcommand, and works on `status` and `validate` too.
