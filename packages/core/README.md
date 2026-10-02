# @fragiola/dockable

The framework-free core of **Dockable**, a headless layout manager for dockable panels: tabs
grouped in tabsets, rows and columns with splitters between them, borders, drag and drop to
rearrange everything, and popout windows.

**Building a React app? Install [`@fragiola/dockable-react`](https://www.npmjs.com/package/@fragiola/dockable-react)**:
its primitives render the layout on top of this core.

This package is everything that is not rendering, for any framework:

- a typed **model** of the layout (JSON v1 with its JSON Schemas), changed only through named
  **commands** that run through your middleware;
- the **layout engine**: measuring, positioning the panels, splitter math;
- **drag and drop** hit-testing and its state machine, and the **popout** window lifecycle.

It has **zero runtime dependencies** and never touches the global `document` or `window`. The
model loads in plain Node, for tests or server-side handling of layout JSON:

```ts
import { createModel } from "@fragiola/dockable";

const model = createModel({
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [{ component: "note", label: "Note" }] }],
    },
});

const [note] = model.get("all-tabs");
if (note && model.can("tab.close", { tabId: note.id })) {
    model.run("tab.close", { tabId: note.id });
}
const saved = model.get("layout-json"); // JSON v1, ready to store
```

The adapters for other frameworks build on this package. Documentation:
**<https://fragiola.com/dockable>**.

## Stability

Dockable is `0.x`: until `1.0`, the API may break between minor versions (`0.1` to `0.2`), and the
changelog says what changed and how to update.

## Credits

Dockable is derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin Systems Ltd
(MIT). See [LICENSE](./LICENSE).
