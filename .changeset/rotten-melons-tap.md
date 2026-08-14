---
'@fakeware/cli': patch
---

Git-ignore the config file and warn when `init --secrets inline` writes real credentials

`--secrets inline` embeds the client id and secret directly in `fakeware.config.ts`, but the `.gitignore` entry was tied to using `.env`, so nothing ignored the config and nothing warned about it. Scaffolding with `--secrets inline` now adds `fakeware.config.ts` to `.gitignore` and prints a warning pointing at `--secrets env`.

The default `--secrets env` path is unchanged: `.env` is ignored and `fakeware.config.ts` stays tracked, since it only holds `$NAME` references.
