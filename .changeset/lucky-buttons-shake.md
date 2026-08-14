---
'@fakeware/core': minor
'@fakeware/cli': patch
---

Rename `RunOptions.debug` to `RunOptions.verbose`

The option that `runUp` and `runDown` accept is the same concept as the `--verbose` flag, so it now carries the same name. If you call `runUp` or `runDown` programmatically, rename the property:

```diff
 await runUp({
   loaded,
   sink,
-  debug: true,
+  verbose: true,
 })
```

The CLI is unaffected: `fakeware up --verbose` and `fakeware down --verbose` behave exactly as before. Plugin log levels are unchanged, `PluginLogger.debug()` and `LogSink.debug` still mean "debug level" and keep their names.
