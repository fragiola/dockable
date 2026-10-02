# Dockable

A headless layout manager for dockable panels: tabs, tabsets, splitters and
popout windows. It ships behaviour, accessibility and composable primitives,
and no CSS, icons or text. You bring the styling.

Every change is a named command with a JSON Schema (`model.run("tab.close", { tabId: tab })`), run
through your middleware, and each tab's data is typed by your own registry (`createModel<Types>`):
the same commands drive the layout from code, from a test or from an AI assistant.

| package | what it is |
|---|---|
| [`@fragiola/dockable`](packages/core) | framework-agnostic core: typed model and command bus, layout engine, drag and drop, popout |
| [`@fragiola/dockable-react`](packages/react) | composable React 19 primitives over the core |

Derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin
Systems Ltd (MIT). See [LICENSE](LICENSE).

## Running it

Requires Node ≥ 24 and pnpm 11.

```sh
pnpm install
pnpm dev        # playground on http://localhost:5173: every example live
pnpm check      # lint + format, and the generated command reference is up to date
pnpm typecheck
pnpm test       # unit and component tests
pnpm build
pnpm check:package  # the packed packages: publint, attw and a smoke app
pnpm e2e        # Playwright
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first.
