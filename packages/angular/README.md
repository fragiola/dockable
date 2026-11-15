# @fragiola/dockable-angular

Angular directives for **Dockable**, a headless layout manager for dockable panels: tabs grouped
in tabsets, rows and columns with splitters between them, borders, drag and drop to rearrange
everything, and popout windows.

Dockable is **headless**. It ships the behaviour, the accessibility and the primitives
(`[dockableRoot]`, `[dockableRow]`, `[dockableTabSet]`, `[dockableTabList]`, `[dockableTab]`,
`[dockablePanel]`, `[dockableSplitter]`, …), and **no CSS, no icons, no rendered menus and no
text**. Each primitive is a standalone attribute directive on an element you write: it adds the
ARIA, the `data-*` state, the structural style and the listeners, and you style the element with
`class`, `style` and the `data-*` attributes. Every visible word and accessible name comes from
you.

Documentation, guides and live examples: **<https://fragiola.com/dockable>**.

## Install

```sh
pnpm add @fragiola/dockable-angular
```

This one package is all an Angular app installs: it re-exports the whole core
([`@fragiola/dockable`](https://www.npmjs.com/package/@fragiola/dockable): the model, its types,
the commands), so everything is imported from `@fragiola/dockable-angular`. It depends on the core
at the exact same version. `@angular/core` **^22** is its peer dependency. Standalone, signals,
zoneless; ESM only (Angular Package Format).

## A minimal layout

```ts title="app.ts"
import { Component } from "@angular/core";
import { createModel, DOCKABLE, type LayoutJson } from "@fragiola/dockable-angular";

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

@Component({
    selector: "app-root",
    imports: [DOCKABLE],
    template: `
        <div [dockableRoot]="model" style="height: 100vh">
            <!-- you own the recursion: a row's child is a tabset or a nested row -->
            <div dockableRow>
                <ng-template [dockableRowChild]="model" let-node>
                    @if (node.type === "tabset") {
                        <div [dockableTabSet]="node">
                            <div dockableTabList aria-label="Notes">
                                <ng-template dockableTabListItem let-tab>
                                    <div [dockableTab]="tab">{{ tab.label }}</div>
                                </ng-template>
                            </div>
                            <div dockableTabSetContent></div>
                        </div>
                    }
                </ng-template>
            </div>
            <ng-template [dockablePanels]="model" let-tab>
                <div [dockablePanel]="tab">
                    <textarea [attr.aria-label]="tab.label" [value]="tab.data.text"></textarea>
                </div>
            </ng-template>
        </div>
    `,
})
export class App {
    // the model is the source of truth: create it once
    readonly model = createModel<Types>(json);
}
```

The splitters, the drag and drop and the keyboard work as is; the look is all yours. Giving a
template directive the model (`[dockableRowChild]="model"`, `[dockablePanels]="model"`) types its
context by the model's registry: `tab.data` narrows on `tab.component`.

## From the React API

The parts and their behaviour are the React package's; the API is written the Angular way:

- an attribute directive on your element instead of a component with `render`
  (`<section [dockableTabSet]="node">`); your `class`, `style` and listeners stay yours, and the
  structural style keys win;
- template directives instead of children functions (`<ng-template dockableRowChild let-node>`,
  `dockableTabListItem`, `dockablePanels`, `dockablePopout`), and
  `<ng-template dockableRowSplitter>` instead of `renderSplitter`;
- signal inputs and outputs (`(popoutOpen)`, `(transfer)`, `(dropped)`) instead of callback props;
- each part's state as a signal, through `exportAs` (`#tab="dockableTab"`, `tab.state().selected`)
  or an injection function (`injectDockable()`, `injectModelState()`, `injectTabSet()`, …).

[Angular directives](https://fragiola.com/dockable/docs/api/angular) maps every React prop.

## Stability

Dockable is `0.x`: until `1.0`, the API may break between minor versions (`0.1` to `0.2`), and the
changelog says what changed and how to update.

## Credits

Dockable is derived from [FlexLayout](https://github.com/caplin/FlexLayout) by Caplin Systems Ltd
(MIT). See [LICENSE](./LICENSE).
