# @fragiola/dockable-react

Composable React 19 primitives for **Dockable**, a headless layout manager for dockable panels:
tabs grouped in tabsets, rows and columns with splitters between them, borders, drag and drop to
rearrange everything, and popout windows.

Dockable is **headless**. It ships the behaviour, the accessibility and the primitives
(`Dockable.Root`, `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, …), and **no CSS, no
icons, no rendered menus and no text**: you style every part with `className`, `style` and the
`data-*` attributes it exposes, and every visible word and accessible name comes from you.

Documentation, guides and live examples: **<https://fragiola.com/dockable>**.

## Install

```sh
pnpm add @fragiola/dockable @fragiola/dockable-react
```

`react` and `react-dom` **^19** are peer dependencies. Both packages are ESM only.

## A minimal layout

```tsx
import { createModel, type LayoutJson, type RowNode, type TabsetNode } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { type ReactNode, useState } from "react";

// what each tab holds: its component and its data
type Types = { tabs: { note: { text: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            { type: "tabset", children: [{ component: "note", label: "One", data: { text: "" } }] },
            { type: "tabset", children: [{ component: "note", label: "Two", data: { text: "" } }] },
        ],
    },
};

// you own the recursion: a row's child is a tabset or a nested row
function renderNode(child: TabsetNode<Types> | RowNode<Types>): ReactNode {
    if (child.type === "row") {
        return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
    }
    return (
        <Dockable.TabSet node={child}>
            <Dockable.TabList<Types> aria-label="Notes">
                {(tab) => <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>}
            </Dockable.TabList>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

export function App() {
    // the model is the source of truth: create it once
    const [model] = useState(() => createModel<Types>(json));
    return (
        <Dockable.Root model={model} style={{ height: "100vh" }}>
            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            <Dockable.Panels<Types>>
                {(tab) => (
                    <Dockable.Panel node={tab}>
                        <textarea aria-label={tab.label} defaultValue={tab.data.text} />
                    </Dockable.Panel>
                )}
            </Dockable.Panels>
        </Dockable.Root>
    );
}
```

The splitters, the drag and drop and the keyboard work as is; the look is all yours.
[Your first layout](https://fragiola.com/dockable/docs/getting-started/first-layout) walks through
it step by step.

## Stability

Dockable is `0.x`: until `1.0`, the API may break between minor versions (`0.1` to `0.2`), and the
changelog says what changed and how to update.

## Credits

Dockable is derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin Systems Ltd
(MIT). See [LICENSE](./LICENSE).
