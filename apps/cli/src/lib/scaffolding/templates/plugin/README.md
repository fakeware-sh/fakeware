<div align="center">

<img src="https://fakeware.sh/logo.png" alt="Fakeware" height="72" />

**A [fakeware](https://fakeware.sh) plugin.**

[Docs](https://fakeware.sh) · [Plugin authoring](https://fakeware.sh/docs/usage/plugins) · [GitHub](https://github.com/fakeware-sh/fakeware)

</div>

## Getting started

```sh
bun install
bun test
bun run typecheck
```

- `src/index.ts`: the plugin, a fetcher that loads rows into `shopContext.extensions`, plus a `contextReady` hook.
- `src/index.test.ts`: tests using `createTestClient` and `createTestPluginContext`.

## Publishing

Keep the `@fakeware/core` peer range in sync with the core versions you support, then `npm publish --access public`.
