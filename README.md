# Dockable

A headless layout manager for dockable panels: tabs, tabsets, splitters and
popout windows. It ships behaviour, accessibility and composable primitives,
and no CSS, icons or text. You bring the styling.

| package | what it is |
|---|---|
| [`@fragiola/dockable`](packages/core) | framework-agnostic core: model, actions, layout engine, drag and drop, popout |
| [`@fragiola/dockable-react`](packages/react) | composable React 19 primitives over the core |

Derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin
Systems Ltd (MIT). See [LICENSE](LICENSE).

## Running it

Requires Node ≥ 24 and pnpm 11.

```sh
pnpm install
pnpm dev        # playground on http://localhost:5173
pnpm check      # lint + format
pnpm typecheck
pnpm test       # unit and component tests
pnpm build
pnpm e2e        # Playwright
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first.
