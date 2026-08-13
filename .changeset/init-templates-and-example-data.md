---
"@fakeware/cli": minor
---

Add `fakeware init --template project|plugin` and an opt-out example data file.

The plugin scaffold was implemented but unreachable — no flag wired to it. `--template plugin` now scaffolds a plugin package; `--template project` (the default) scaffolds a data project.

Project scaffolds now include an example `data/products.ts` so the first `fakeware up` does something instead of reporting an empty plan. Opt out with `--no-example-data`, or answer the new "Include an example data file?" prompt.

`init` is split into `commands/init/{index,flags,gather,execute,outro}.ts`. Cancels and failures now use the shared exit codes, an implicit non-interactive run warns instead of being silent, a non-interactive run with no plugin flag says so, `--dry-run` warns when the target directory is not empty, and a failed scaffold rolls back the files it already wrote.
