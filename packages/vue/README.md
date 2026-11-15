# @fragiola/dockable-vue

Composable Vue 3 primitives for **Dockable**, a headless layout manager for dockable panels: tabs
grouped in tabsets, rows and columns with splitters between them, borders, drag and drop to
rearrange everything, and popout windows.

Dockable is **headless**. It ships the behaviour, the accessibility and the primitives
(`Dockable.Root`, `Row`, `TabSet`, `TabList`, `Tab`, `Panel`, `Splitter`, …), and **no CSS, no
icons, no rendered menus and no text**: you style every part with `class`, `style` and the
`data-*` attributes it exposes, and every visible word and accessible name comes from you.

Documentation, guides and live examples: **<https://fragiola.com/dockable>**.

## Install

```sh
pnpm add @fragiola/dockable-vue
```

This one package is all a Vue app installs: it re-exports the whole core
([`@fragiola/dockable`](https://www.npmjs.com/package/@fragiola/dockable): the model, its types,
the commands), so everything is imported from `@fragiola/dockable-vue`. It depends on the core at
the exact same version. `vue` **^3.5** is its peer dependency. ESM only.

## A minimal layout

```ts title="dockable.ts"
import { typedDockable } from "@fragiola/dockable-vue";

// what each tab holds: its component and its data
export type Types = { tabs: { note: { text: string } } };

// the primitives typed by your registry (a template cannot pass a type argument)
export const Dockable = typedDockable<Types>();
```

```vue title="App.vue"
<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";

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

// the model is the source of truth: create it once, never in ref() or reactive()
const model = createModel<Types>(json);
</script>

<template>
    <Dockable.Root :model="model" :style="{ height: '100vh' }">
        <!-- you own the recursion: a row's child is a tabset or a nested row -->
        <Dockable.Row v-slot="{ node }">
            <Dockable.TabSet v-if="node.type === 'tabset'" :node="node">
                <Dockable.TabList v-slot="{ tab }" aria-label="Notes">
                    <Dockable.Tab :node="tab">{{ tab.label }}</Dockable.Tab>
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        </Dockable.Row>
        <Dockable.Panels v-slot="{ tab }">
            <Dockable.Panel :node="tab">
                <textarea :aria-label="tab.label" :value="tab.data.text" />
            </Dockable.Panel>
        </Dockable.Panels>
    </Dockable.Root>
</template>
```

The splitters, the drag and drop and the keyboard work as is; the look is all yours.

## From the React API

The parts and their behaviour are the React package's; the API is written the Vue way:

- `as` (a tag or a component) and the `render` scoped slot (`{ props, state, children }`) instead
  of React's `render` prop;
- scoped slots instead of children functions (`v-slot="{ node }"`, `v-slot="{ tab }"`), and
  `#splitter="{ props }"` instead of `renderSplitter`;
- `class` and `style` as fallthrough attributes, merged under the structural style; listeners run
  after the part's own;
- composables (`useDockable`, `useModelState`, `useTabSet`, …) returning `{ state, props }` as
  computed refs.

[Vue primitives](https://fragiola.com/dockable/docs/api/vue) maps every React prop.

## Stability

Dockable is `0.x`: until `1.0`, the API may break between minor versions (`0.1` to `0.2`), and the
changelog says what changed and how to update.

## Credits

Dockable is derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin Systems Ltd
(MIT). See [LICENSE](./LICENSE).
