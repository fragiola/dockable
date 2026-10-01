# Engine v2 design record

This record fixes the names, types and rules of Dockable's own engine (Epic #43). Items #45 to #49
implement it and cite it by section. It replaces the FlexLayout model port (`packages/core/src/model`)
with a plain state tree, a command bus and typed data. The survey behind it is in
[`flexlayout-issues.md`](./flexlayout-issues.md).

What does not change: AGENTS.md rules 1–6 and 8–12, the `data-layout-path` scheme for the nodes that
remain, and the primitive, drag and drop and popout contracts. The only amendments are the three the
Epic lists: rule 7, Provenance, and the popout close policy (§11.3).

> **Update, 2026-10-01 (Epic #67).** The public surface named in §6, §7, §8 and §10 has since moved
> to one pattern on the model and the engine: `run`, `can` (now a boolean), `check` (the old `can`),
> `get` and `is`, each taking a key and a payload. The queries of §7 are `model.get`/`model.is`
> keys (`src/state/queries.ts`); the engine's app-facing methods are `engine.run`/`get`/`is` keys
> (`src/engine/verbs.ts`), everything else is under `engine.adapter`, `engine.run` is no longer an
> alias of `model.run`, and `useDockable()` returns `{ model, engine, layoutId }`. The names below
> are the record's, not the current API: see `site/docs/concepts/model-and-engine.mdx`.

## Contents

1. [Types](#1-types)
2. [The attribute table](#2-the-attribute-table)
3. [The defaults rule](#3-the-defaults-rule)
4. [JSON v1](#4-json-v1)
5. [The command catalogue](#5-the-command-catalogue)
6. [Bus semantics](#6-bus-semantics)
7. [Queries](#7-queries)
8. [The view engine](#8-the-view-engine)
9. [Tidy and selection rules](#9-tidy-and-selection-rules)
10. [The React surface](#10-the-react-surface)
11. [The migration table](#11-the-migration-table)

## 1. Types

All node types are readonly plain objects. There are no classes, getters or methods, so `instanceof`
never applies: a node is told apart by its `type` field.

### 1.1 The type registry

```ts
/** What an app declares: each tab component's data type, and optionally the data of the other kinds. */
export interface DockableTypes {
    tabs: object; // { [component: string]: DataType }
    tabset?: unknown;
    border?: unknown;
    row?: unknown;
}

/** The registry used when an app declares none: any component, `unknown` data. */
export interface AnyTypes {
    tabs: Record<string, unknown>;
}

export type ComponentOf<T extends DockableTypes> = Extract<keyof T["tabs"], string>;
export type TabDataOf<T extends DockableTypes, K extends string> =
    K extends keyof T["tabs"] ? T["tabs"][K] : never;
export type TabsetDataOf<T extends DockableTypes> = T extends { tabset: infer D } ? D : unknown;
export type BorderDataOf<T extends DockableTypes> = T extends { border: infer D } ? D : unknown;
export type RowDataOf<T extends DockableTypes> = T extends { row: infer D } ? D : unknown;
```

`tabs` is `object` rather than `Record<string, unknown>` so that an `interface` (which has no
implicit index signature) is accepted as well as a type literal.

### 1.2 Node types

```ts
export type Orientation = "horizontal" | "vertical";
export type BorderLocation = "top" | "bottom" | "left" | "right";
export type DockLocation = "center" | BorderLocation;
export type BorderMode = "docked" | "overlay";

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

/** Size limits shared by tabs and tabsets, in px. */
export interface SizeLimits {
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
}

export interface TabNode<K extends string = string, D = unknown> extends SizeLimits {
    readonly type: "tab";
    readonly id: string;
    readonly component: K;
    readonly data: D;
    readonly pinned?: boolean;
    readonly enableClose?: boolean;
    readonly enableDrag?: boolean;
    readonly enablePopout?: boolean;
    /** the tab's own panel width in a left or right border (the border's `size` otherwise) */
    readonly borderWidth?: number;
    /** the tab's own panel height in a top or bottom border */
    readonly borderHeight?: number;
}

/** A tab of the registry `T`: a union discriminated by `component`, so `data` narrows. */
export type TabOf<T extends DockableTypes> = {
    [K in ComponentOf<T>]: TabNode<K, TabDataOf<T, K>>;
}[ComponentOf<T>];

export interface TabsetNode<T extends DockableTypes = AnyTypes> extends SizeLimits {
    readonly type: "tabset";
    readonly id: string;
    readonly weight: number;
    /** index of the selected tab in `children`; -1 when none */
    readonly selected: number;
    readonly children: readonly TabOf<T>[];
    readonly data?: TabsetDataOf<T>;
    readonly enableDrop?: boolean;
    readonly enableDrag?: boolean;
    readonly enableDivide?: boolean;
    readonly enableMaximize?: boolean;
    readonly enableClose?: boolean;
    readonly deleteWhenEmpty?: boolean;
    readonly autoSelectTab?: boolean;
}

export interface RowNode<T extends DockableTypes = AnyTypes> {
    readonly type: "row";
    readonly id: string;
    readonly weight: number;
    readonly children: readonly (RowNode<T> | TabsetNode<T>)[];
    readonly data?: RowDataOf<T>;
}

export interface BorderNode<T extends DockableTypes = AnyTypes> {
    readonly type: "border";
    readonly id: string;
    readonly location: BorderLocation;
    /** index of the selected tab; -1 when the border's panel is closed */
    readonly selected: number;
    readonly children: readonly TabOf<T>[];
    readonly data?: BorderDataOf<T>;
    readonly size?: number;
    readonly minSize?: number;
    readonly maxSize?: number;
    readonly mode?: BorderMode;
    /** false hides the border entirely */
    readonly show?: boolean;
    /** hide the strip while the border has no tabs (a drag near its edge reveals it) */
    readonly autoHide?: boolean;
    readonly enableDrop?: boolean;
    readonly autoSelectTabWhenOpen?: boolean;
    readonly autoSelectTabWhenClosed?: boolean;
}

/** A popout window's layout: a native window with its own root row. */
export interface WindowLayout<T extends DockableTypes = AnyTypes> {
    readonly id: string;
    /** the window's screen rect */
    readonly rect: Rect;
    readonly root: RowNode<T>;
    readonly active?: string;
    readonly maximized?: string;
}

export type Node<T extends DockableTypes = AnyTypes> = RowNode<T> | TabsetNode<T> | TabOf<T> | BorderNode<T>;
export type NodeKind = Node["type"]; // "row" | "tabset" | "tab" | "border"
export type TabContainer<T> = TabsetNode<T> | BorderNode<T>;
export type ParentNode<T> = RowNode<T> | TabsetNode<T> | BorderNode<T>;

export interface LayoutState<T extends DockableTypes = AnyTypes> {
    readonly defaults: LayoutDefaults;
    /** the main layout's root row */
    readonly root: RowNode<T>;
    /** the main layout's active tabset */
    readonly active?: string;
    /** the main layout's maximized tabset */
    readonly maximized?: string;
    readonly borders: readonly BorderNode<T>[];
    readonly windows: readonly WindowLayout<T>[];
}

/** The id of the main layout (a window layout's id is its window's id). */
export const MAIN_LAYOUT = "main";
```

- A layout is the main layout (`MAIN_LAYOUT`: the state's `root`, `active`, `maximized` and the
  borders) or a window (`windows[i]`). Every node belongs to exactly one layout.
- A row's orientation is not stored. The root row of every layout takes
  `defaults.layout.rootOrientation` (horizontal by default) and each nested row flips its parent's.
- `selected` is an index, as in FlexLayout, so the selection math (§9) is a direct port.
- `data` is required on a tab (its type is the component's) and optional on the other kinds.
- The state holds no DOM, no rects, no visibility, no scroll and no "rendered" flag (§8.2).

### 1.3 How `T` flows

- `createModel<T extends DockableTypes = AnyTypes>(json?, options?)` returns `Model<T>`.
- `Model<T>` exposes `state: LayoutState<T>`, typed queries (§7) and the bus typed by
  `CommandMap<T>` (§5.1).
- `CommandMap<T>` types every payload with `T`: `tab.add` and `tab.update` take a union over the
  registry's components, so `data` is checked against `component`.
- The React package is generic over the same `T`: `Dockable.Root` takes `model: Model<T>`, and the
  parts that hand nodes to a children function take a type argument
  (`<Dockable.Panels<Types>>{(tab) => …}</Dockable.Panels>`, `useDockable<Types>()`), because a
  child cannot infer the root's `T` through context. Without the argument they use `AnyTypes`.

### 1.4 A worked example

```ts
type Types = {
    tabs: {
        editor: { name: string; path: string; dirty: boolean };
        chart: { name: string; series: string[] };
    };
    tabset: { name?: string };
};

const model = createModel<Types>({
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "main",
                children: [{ component: "editor", data: { name: "a.ts", path: "/a.ts", dirty: false } }],
            },
        ],
    },
});

function title(tab: TabOf<Types>): string {
    switch (tab.component) {
        case "editor":
            return tab.data.dirty ? `${tab.data.name} •` : tab.data.name; // data: editor's type
        case "chart":
            return `${tab.data.name} (${tab.data.series.length})`; // data: chart's type
    }
}

model.run("tab.add", { component: "chart", data: { name: "Sales", series: [] }, to: "main" });
// @ts-expect-error: `path` is not in the chart's data
model.run("tab.add", { component: "chart", data: { name: "x", path: "x" }, to: "main" });
```

## 2. The attribute table

One row for every attribute of `packages/core/src/model/IJsonModel.ts`. Decisions: **keep**,
**rename**, **move to data** (the app's typed `data`), **move to prop** (a primitive or engine
option), **delete**. "Enforced today" cites the code that reads the attribute; "never read" means
no code outside its own getter reads it (checked with a search over `packages/`, `apps/` and
`examples/`).

The cosmetic and UI-only attributes leave the model. A tab's `name` moves to `data`: every tab strip
renders it, and it is the app's text (rule 8). Every permission flag that stays is enforced by its
commands (§5), including the two FlexLayout ignores (`enableClose` in `DELETE_TAB`,
`enableMaximize` in `MAXIMIZE_TOGGLE`).

### 2.1 Global attributes (`IGlobalAttributes`)

The FlexLayout globals mirror node attributes (`tabEnableClose` for `enableClose`). They all become
entries of `defaults` (§3) under the node's own name, or leave with the node attribute.

| attribute | decision | new name | reason / enforced today |
|---|---|---|---|
| `borderAutoSelectTabWhenClosed` | rename | `defaults.border.autoSelectTabWhenClosed` | selection on insert, `BorderNode.ts:239-247` |
| `borderAutoSelectTabWhenOpen` | rename | `defaults.border.autoSelectTabWhenOpen` | selection on insert, `BorderNode.ts:239-247` |
| `borderClassName` | delete | — | never read; rule 9 |
| `borderEnableAutoHide` | rename | `defaults.border.autoHide` | which borders show and the drag reveal, `Borders.tsx:62-63`, `DragDropManager.ts:843-844` |
| `borderEnableDrop` | rename | `defaults.border.enableDrop` | drop permission, `Node.ts:322` |
| `borderEnableTabScrollbar` | delete | — | never read |
| `borderLeftTabDirection` | move to prop | `Dockable.Border` `tabDirection` | only sets `data-tab-direction`, `hooks.ts:220-225`; styling |
| `borderMaxSize` | rename | `defaults.border.maxSize` | split math, `BorderNode.ts:426` |
| `borderMinSize` | rename | `defaults.border.minSize` | split math, `BorderNode.ts:425` |
| `borderSize` | rename | `defaults.border.size` | the border panel's size, `BorderNode.ts:101-114` |
| `edgeDockLength` | rename | `defaults.layout.edgeDockLength` | edge bands, `RowNode.ts:462-467`, `Model.ts:1113` |
| `edgeDockMargin` | rename | `defaults.layout.edgeDockMargin` | edge bands, `RowNode.ts:461` |
| `enableEdgeDock` | rename | `defaults.layout.edgeDock` | edge docking, `RowNode.ts:479` |
| `enableEdgeDockIndicators` | move to prop | render `Dockable.EdgeIndicator` or not | only gates the indicators and the band length (`EdgeIndicator.tsx:50`); bands always use `edgeDockLength` now, a large value gives the whole edge |
| `enableRotateBorderIcons` | delete | — | never read |
| `rootOrientationVertical` | rename | `defaults.layout.rootOrientation: "horizontal" \| "vertical"` | row orientation, `Node.ts:102` |
| `tabBorderHeight` | delete | — | per-tab only (the tab's `borderHeight`); a global per-tab size duplicates `defaults.border.size` |
| `tabBorderWidth` | delete | — | as `tabBorderHeight` |
| `tabClassName` | delete | — | never read; rule 9 |
| `tabCloseType` | delete | — | never read (close button visibility is styling) |
| `tabContentClassName` | delete | — | never read; rule 9 |
| `tabEnableClose` | rename | `defaults.tab.enableClose` | close permission, `TabNode.ts:155-168` |
| `tabEnableDrag` | rename | `defaults.tab.enableDrag` | drag permission, `hooks.ts:357-360` |
| `tabEnableFloat` | delete | — | floats are removed |
| `tabEnableFloatIcon` | delete | — | never read; floats are removed |
| `tabEnablePin` | move to data | the app's tab `data` | only the examples' menus read it; `Model.ts:686` ignored the pin action, the new `tab.pin` does not |
| `tabEnablePopout` | rename | `defaults.tab.enablePopout` | popout permission, `TabNode.ts:170-180`, `ModelLayout.ts:105` |
| `tabEnablePopoutIcon` | delete | — | never read |
| `tabEnablePopoutOverlay` | delete | — | never read |
| `tabEnableRename` | move to data | the app's tab `data` | only the examples read it; renaming edits `data` |
| `tabEnableRenderOnDemand` | move to prop | `Dockable.Panels` `renderOnDemand` | a view option, `Panels.tsx:36` |
| `tabEnableScrollbars` | move to prop | `Dockable.Panel` `scrollable` | a view option, `LayoutEngine.ts:1160` |
| `tabGroupType` | delete | — | tab groups are removed |
| `tabIcon` | move to data | the app's tab `data` | never read |
| `tabMaxHeight` | rename | `defaults.tab.maxHeight` | split math, `TabSetNode.ts:340-342` |
| `tabMaxWidth` | rename | `defaults.tab.maxWidth` | split math, `TabSetNode.ts:336-338` |
| `tabMinHeight` | rename | `defaults.tab.minHeight` | split math, `TabSetNode.ts:332-334` |
| `tabMinWidth` | rename | `defaults.tab.minWidth` | split math, `TabSetNode.ts:328-330` |
| `tabSetAutoSelectTab` | rename | `defaults.tabset.autoSelectTab` | selection on insert, `Utils.ts:190` |
| `tabSetClassNameTabStrip` | delete | — | never read; rule 9 |
| `tabSetEnableActiveIcon` | delete | — | never read |
| `tabSetEnableClose` | rename | `defaults.tabset.enableClose` | `RowNode.ts:408`, `Node.ts:331`, `DragDropManager.ts:326` |
| `tabSetEnableCloseButton` | delete | — | never read |
| `tabSetEnableDeleteWhenEmpty` | rename | `defaults.tabset.deleteWhenEmpty` | tidy, `RowNode.ts:408` |
| `tabSetEnableDivide` | rename | `defaults.tabset.enableDivide` | `TabSetNode.ts:443`, `Node.ts:363` |
| `tabSetEnableDrag` | rename | `defaults.tabset.enableDrag` | dragging a whole tabset, `hooks.ts:357` |
| `tabSetEnableDrop` | rename | `defaults.tabset.enableDrop` | `TabSetNode.ts:442`, `Node.ts:322` |
| `tabSetEnableMaximize` | rename | `defaults.tabset.enableMaximize` | `TabSetNode.ts:362` (ignored by `MAXIMIZE_TOGGLE`, enforced now) |
| `tabSetEnableSingleTabStretch` | delete | — | never read |
| `tabSetEnableTabGroups` | delete | — | tab groups are removed |
| `tabSetEnableTabScrollbar` | delete | — | never read |
| `tabSetEnableTabStrip` | delete | — | never read (a strip is rendered or not by the app) |
| `tabSetEnableTabWrap` | delete | — | never read (wrapping is styling) |
| `tabSetMaxHeight` | rename | `defaults.tabset.maxHeight` | split math, `TabSetNode.ts:322-358` |
| `tabSetMaxWidth` | rename | `defaults.tabset.maxWidth` | split math, `TabSetNode.ts:322-358` |
| `tabSetMinHeight` | rename | `defaults.tabset.minHeight` | split math, `TabSetNode.ts:322-358` |
| `tabSetMinWidth` | rename | `defaults.tabset.minWidth` | split math, `TabSetNode.ts:322-358` |
| `tabSetTabLocation` | delete | — | never read (the strip's position is the app's markup) |

### 2.2 Row (`IRowAttributes`)

| attribute | decision | new name | reason / enforced today |
|---|---|---|---|
| `type` | keep | `type: "row"` | the discriminant |
| `id` | keep | `id` | explicit, generated when missing (§4.2) |
| `weight` | keep | `weight` | flex sizing (rule 1), `Row.tsx:94` |
| — | new | `data` | the app's row data (`T["row"]`) |

### 2.3 Tabset (`ITabSetAttributes`, `IJsonTabSetNode`)

| attribute | decision | new name | reason / enforced today |
|---|---|---|---|
| `type` | keep | `type: "tabset"` | the discriminant |
| `id` | keep | `id` | explicit (§4.2) |
| `weight` | keep | `weight` | flex sizing, `TabSet.tsx:76` |
| `selected` | keep | `selected` | selection (§9) |
| `name` | move to data | the app's tabset `data` | only used as the tab list's accessible name; that is the app's text (rule 8) |
| `config` | rename | `data` | typed by `T["tabset"]` |
| `autoSelectTab` | keep | `autoSelectTab` | selection on insert, `Utils.ts:190` |
| `classNameTabStrip` | delete | — | never read; rule 9 |
| `enableActiveIcon` | delete | — | never read |
| `enableClose` | keep | `enableClose` | `tabset.close`, tidy, merge refusal (§5) |
| `enableCloseButton` | delete | — | never read |
| `enableDeleteWhenEmpty` | rename | `deleteWhenEmpty` | tidy, `RowNode.ts:408` |
| `enableDivide` | keep | `enableDivide` | edge drops, `TabSetNode.ts:443`, `Node.ts:363` |
| `enableDrag` | keep | `enableDrag` | `tabset.move` (§5) |
| `enableDrop` | keep | `enableDrop` | center drops, `TabSetNode.ts:442`, `Node.ts:322` |
| `enableMaximize` | keep | `enableMaximize` | `tabset.maximize` |
| `enableSingleTabStretch` | delete | — | never read |
| `enableTabGroups` | delete | — | tab groups are removed |
| `enableTabScrollbar` | delete | — | never read |
| `enableTabStrip` | delete | — | never read |
| `enableTabWrap` | delete | — | never read |
| `maxHeight` | keep | `maxHeight` | split math |
| `maxWidth` | keep | `maxWidth` | split math |
| `minHeight` | keep | `minHeight` | split math |
| `minWidth` | keep | `minWidth` | split math |
| `tabLocation` | delete | — | never read |
| `active` (JSON only) | move | the layout's `active` | one per layout; stored on the layout, not the node (§4.1) |
| `maximized` (JSON only) | move | the layout's `maximized` | as `active` |
| `children` | keep | `children` | tabs only (no groups) |

### 2.4 Tab (`ITabAttributes`)

| attribute | decision | new name | reason / enforced today |
|---|---|---|---|
| `type` | keep | `type: "tab"` | the discriminant (optional in JSON) |
| `id` | keep | `id` | explicit (§4.2) |
| `name` | move to data | the app's tab `data` | text; every strip renders it from `data` |
| `component` | keep | `component` | the registry key that types `data` |
| `config` | rename | `data` | typed by the registry |
| `altName` | move to data | the app's tab `data` | text for the overflow menu |
| `borderHeight` | keep | `borderHeight` (optional, no `-1`) | a tab's own size in a border, `BorderNode.ts:101-114`, `:288-311` |
| `borderWidth` | keep | `borderWidth` (optional, no `-1`) | as `borderHeight` |
| `className` | delete | — | never read; rule 9 |
| `closeType` | delete | — | never read |
| `contentClassName` | delete | — | never read; rule 9 |
| `enableClose` | keep | `enableClose` | `tab.close` (enforced now) |
| `enableDrag` | keep | `enableDrag` | `tab.move`, the drag source |
| `enableFloat` | delete | — | floats are removed |
| `enableFloatIcon` | delete | — | never read |
| `enablePin` | move to data | the app's tab `data` | UI permission of a menu item; `tab.pin` always applies to a tabset tab |
| `enablePopout` | keep | `enablePopout` | `tab.popout`, moves into a window |
| `enablePopoutIcon` | delete | — | never read |
| `enablePopoutOverlay` | delete | — | never read |
| `enableRename` | move to data | the app's tab `data` | UI permission; renaming edits `data` |
| `enableRenderOnDemand` | move to prop | `Dockable.Panels` `renderOnDemand` | a view option, `Panels.tsx:36` |
| `enableScrollbars` | move to prop | `Dockable.Panel` `scrollable` | a view option, `LayoutEngine.ts:1160` |
| `enableWindowReMount` | move to prop | `Dockable.Panel` `remountInWindow` | a view option, `LayoutEngine.ts:1196`, `Panel.tsx:200` |
| `helpText` | move to data | the app's tab `data` | never read |
| `icon` | move to data | the app's tab `data` | never read |
| `maxHeight` | keep | `maxHeight` | split math |
| `maxWidth` | keep | `maxWidth` | split math |
| `minHeight` | keep | `minHeight` | split math |
| `minWidth` | keep | `minWidth` | split math |
| `pinned` | keep | `pinned` | ordering, no close, no drag out of the tabset (§9.4) |
| `subLayoutId` | delete | — | `"tab"` sub-layouts are removed |
| `tabsetClassName` | delete | — | never read; rule 9 |

### 2.5 Border (`IBorderAttributes`, `IJsonBorderNode`)

| attribute | decision | new name | reason / enforced today |
|---|---|---|---|
| `type` | keep | `type: "border"` | the discriminant (optional in JSON) |
| `location` | keep | `location` | one border per side |
| `selected` | keep | `selected` | the open tab; -1 closed |
| `borderType` | rename | `mode: "docked" \| "overlay"` | `isOverlay()`, `LayoutEngine.ts:1080`, `BorderContent.tsx:132` |
| `show` | keep | `show` | `Borders.tsx:62`, `BorderSet.ts:85` |
| `config` | rename | `data` | typed by `T["border"]` |
| `autoSelectTabWhenOpen` | keep | `autoSelectTabWhenOpen` | selection on insert |
| `autoSelectTabWhenClosed` | keep | `autoSelectTabWhenClosed` | selection on insert |
| `className` | delete | — | never read; rule 9 |
| `enableAutoHide` | rename | `autoHide` | the drag reveal and which strips render |
| `enableDrop` | keep | `enableDrop` | drop permission |
| `enableTabScrollbar` | delete | — | never read |
| `maxSize` | keep | `maxSize` | split math |
| `minSize` | keep | `minSize` | split math |
| `size` | keep | `size` | panel size |
| `children` | keep | `children` | tabs only |
| — (id) | new | `id` | explicit; `border_<location>` when missing (§4.2) |

### 2.6 Tab group (`ITabGroupAttributes`)

Tab groups are removed from the model (they come back in the follow-up support Epic).

| attribute | decision | reason |
|---|---|---|
| `type`, `id`, `name`, `color`, `config`, `enableDrag`, `opened` | delete | tab groups are removed; no primitive renders them |

### 2.7 Sub-layout (`ISubLayoutAttributes`, `IJsonSubLayout`)

| attribute | decision | new name | reason |
|---|---|---|---|
| `name` | delete | — | never read |
| `type` | delete | — | only `"window"` remains; `"float"` and `"tab"` are removed |
| `layout` | rename | `root` | the window's root row |
| `rect` | keep | `rect` | the window's screen rect |
| `subLayouts` / `popouts` (model) | rename | `windows` | an array of window layouts, each with an `id` |

## 3. The defaults rule

A behaviour field resolves as:

```
node.x ?? state.defaults[kind].x ?? BUILT_IN[kind].x
```

There is no other inheritance: no global mirrors, no aliases, no parent lookups.

```ts
export interface LayoutDefaults {
    tab?: TabDefaults;
    tabset?: TabsetDefaults;
    border?: BorderDefaults;
    layout?: LayoutSettings;
}
export interface TabDefaults extends SizeLimits {
    enableClose?: boolean;
    enableDrag?: boolean;
    enablePopout?: boolean;
}
export interface TabsetDefaults extends SizeLimits {
    enableDrop?: boolean;
    enableDrag?: boolean;
    enableDivide?: boolean;
    enableMaximize?: boolean;
    enableClose?: boolean;
    deleteWhenEmpty?: boolean;
    autoSelectTab?: boolean;
}
export interface BorderDefaults {
    size?: number;
    minSize?: number;
    maxSize?: number;
    mode?: BorderMode;
    autoHide?: boolean;
    enableDrop?: boolean;
    autoSelectTabWhenOpen?: boolean;
    autoSelectTabWhenClosed?: boolean;
}
export interface LayoutSettings {
    rootOrientation?: Orientation;
    edgeDock?: boolean;
    edgeDockMargin?: number;
    edgeDockLength?: number;
}
```

Built-in values (FlexLayout's defaults):

| kind | field | built-in |
|---|---|---|
| tab | `enableClose`, `enableDrag` | `true` |
| tab | `enablePopout` | `false` |
| tab, tabset | `minWidth`, `minHeight` | `1` |
| tab, tabset | `maxWidth`, `maxHeight` | `99999` |
| tabset | `enableDrop`, `enableDrag`, `enableDivide`, `enableMaximize`, `enableClose`, `deleteWhenEmpty`, `autoSelectTab` | `true` |
| border | `size` | `200` |
| border | `minSize` / `maxSize` | `1` / `99999` |
| border | `mode` | `"docked"` |
| border | `autoHide`, `autoSelectTabWhenClosed` | `false` |
| border | `enableDrop`, `autoSelectTabWhenOpen` | `true` |
| layout | `rootOrientation` | `"horizontal"` |
| layout | `edgeDock` | `true` |
| layout | `edgeDockMargin` / `edgeDockLength` | `10` / `100` |

`pinned`, `show`, `borderWidth`, `borderHeight` and `weight` are per node only. The resolver is one
function, `resolve(state, node)`, with an overload per kind returning every field resolved
(`ResolvedTab`, `ResolvedTabset`, `ResolvedBorder`), and `resolveLayout(state)` for
`LayoutSettings`. `model.resolve(node)` is the same bound to the current state.

## 4. JSON v1

### 4.1 Shape

```ts
export interface LayoutJson<T extends DockableTypes = AnyTypes> {
    version: 1;
    defaults?: LayoutDefaults;
    root: RowJson<T>;
    active?: string;
    maximized?: string;
    borders?: BorderJson<T>[];
    windows?: WindowJson<T>[];
}
export interface RowJson<T> { type: "row"; id?: string; weight?: number; data?: RowDataOf<T>; children?: (RowJson<T> | TabsetJson<T>)[]; }
export interface TabsetJson<T> extends TabsetDefaults { type: "tabset"; id?: string; weight?: number; selected?: number; data?: TabsetDataOf<T>; children?: TabJson<T>[]; }
export type TabJson<T> = { [K in ComponentOf<T>]: TabInit<K, TabDataOf<T, K>> & { type?: "tab" } }[ComponentOf<T>];
export type TabInit<K, D> = { id?: string; component: K; pinned?: boolean; enableClose?: boolean; enableDrag?: boolean; enablePopout?: boolean; borderWidth?: number; borderHeight?: number } & SizeLimits & DataField<D>;
export type DataField<D> = undefined extends D ? { data?: D } : { data: D };
export interface BorderJson<T> extends BorderDefaults { type?: "border"; id?: string; location: BorderLocation; selected?: number; show?: boolean; data?: BorderDataOf<T>; children?: TabJson<T>[]; }
export interface WindowJson<T> { id?: string; rect?: Rect; root: RowJson<T>; active?: string; maximized?: string; }
```

An example document:

```json
{
    "version": 1,
    "defaults": { "tab": { "enablePopout": true }, "border": { "size": 220 } },
    "root": {
        "type": "row",
        "id": "root",
        "children": [
            {
                "type": "tabset",
                "id": "editors",
                "weight": 70,
                "selected": 0,
                "children": [
                    { "id": "readme", "component": "editor", "data": { "name": "README.md", "path": "/README.md" } }
                ]
            },
            {
                "type": "tabset",
                "id": "tools",
                "weight": 30,
                "enableDrop": false,
                "children": [{ "id": "log", "component": "log", "data": { "name": "Log" }, "pinned": true }]
            }
        ]
    },
    "active": "editors",
    "borders": [{ "location": "left", "mode": "overlay", "children": [{ "component": "files", "data": { "name": "Files" } }] }],
    "windows": [
        {
            "id": "w1",
            "rect": { "x": 100, "y": 100, "width": 600, "height": 400 },
            "root": { "type": "row", "children": [{ "type": "tabset", "children": [{ "component": "chart", "data": { "name": "Sales", "series": [] } }] }] }
        }
    ]
}
```

Loading fills what JSON may omit: `weight` (100), `selected` (0, or -1 for an empty tabset; -1 for a
border), `children` (`[]`), `borders` and `windows` (`[]`), `defaults` (`{}`), and a window `rect`
(`{ x: 50 + 50n, y: 50 + 50n, width: 600, height: 400 }` for the n-th window). An out-of-range
`selected` is clamped (FlexLayout behaviour). Then the state is tidied (§9.1). `toJSON()` writes the
state back with `version: 1`; `createModel(model.toJSON()).state` deep-equals `model.state`.

### 4.2 Ids

- Every node and window has an explicit `id` in the state. Ids are never assigned lazily, and
  reading never mutates.
- A node without an id gets one when it is created (at load or by a command) from the injectable
  `createId(kind)` option. The default is deterministic and needs no `crypto`: `` `${kind}-${n}` ``
  with a per-model counter, skipping ids already in use.
- A border without an id gets `border_<location>` (it is unique per side).
- Ids are unique across all nodes and windows, and `"main"` is reserved for the main layout.

### 4.3 Validation

`layoutSchema` (exported) is the JSON Schema of `LayoutJson`. `createModel` and `layout.load`
validate against it, then check what a schema cannot:

- duplicate ids, and the reserved `"main"`;
- two borders on the same side, and a pinned tab in a border;
- `active` and `maximized` naming a tabset of the same layout.

Every problem is reported, each with a JSON path (RFC 6901 pointer):

```ts
export interface ValidationIssue { path: string; message: string; }
```

- `createModel(invalid)` throws `LayoutValidationError` (`error.issues: ValidationIssue[]`).
- `validateLayout(json)` returns `{ ok: true, value: LayoutJson } | { ok: false, issues }`, for
  code that must not throw.
- `layout.load` returns `{ ok: false, error: { code: "invalid_payload", path, message, issues } }`,
  its paths prefixed with `/layout`.

The `version` field is the migration hook: v1 accepts only `1`.

## 5. The command catalogue

Names are `<kind>.<verb>`. Payload keys name the kind they refer to (`tab`, `tabset`, `row`,
`border`, `window`) and `to` is a drop target. Every command returns `CommandResult<R>` (§6.1). The
error codes in each entry are the ones its preconditions return; every command can also return
`unknown_command`, `invalid_payload`, `vetoed` and `middleware_error` (§6.2).

The descriptions below are the ones `model.commands()` returns: they are written for an assistant
choosing a tool.

### 5.1 Shared definitions

```ts
export interface CommandMap<T extends DockableTypes = AnyTypes> {
    "tab.add": { payload: TabAddPayload<T>; result: { tab: string } };
    "tab.select": { payload: { tab: string }; result: { tab: string } };
    "tab.close": { payload: { tab: string }; result: { tab: string } };
    "tab.move": { payload: TabMovePayload; result: { tab: string } };
    "tab.update": { payload: TabUpdatePayload<T>; result: { tab: string } };
    "tab.pin": { payload: { tab: string; value: boolean }; result: { tab: string } };
    "tab.popout": { payload: { tab: string; rect?: Rect }; result: { window: string } };
    "tab.configure": { payload: TabConfigurePayload; result: { tab: string } };
    "tabset.activate": { payload: { tabset: string }; result: { tabset: string } };
    "tabset.maximize": { payload: { tabset: string; value: boolean }; result: { tabset: string } };
    "tabset.close": { payload: { tabset: string }; result: { closed: string[] } };
    "tabset.move": { payload: TabsetMovePayload; result: { tabset: string } };
    "tabset.popout": { payload: { tabset: string; rect?: Rect }; result: { window: string } };
    "tabset.configure": { payload: TabsetConfigurePayload<T>; result: { tabset: string } };
    "row.resize": { payload: { row: string; weights: number[] }; result: { row: string } };
    "row.configure": { payload: { row: string; data?: RowDataOf<T> | null }; result: { row: string } };
    "border.resize": { payload: { border: string; size: number }; result: { border: string; size: number } };
    "border.configure": { payload: BorderConfigurePayload<T>; result: { border: string } };
    "window.close": { payload: { window: string }; result: { tabs: string[] } };
    "window.configure": { payload: { window: string; rect: Rect }; result: { window: string } };
    "layout.configure": { payload: { defaults: LayoutDefaultsPatch }; result: Record<string, never> };
    "layout.load": { payload: { layout: LayoutJson<T> }; result: { added: string[]; removed: string[] } };
    batch: { payload: { commands: BatchEntry<T>[] }; result: { results: unknown[] } };
}
export type CommandName = keyof CommandMap;
export type PayloadOf<T, C extends CommandName> = CommandMap<T>[C]["payload"];
export type ResultOf<T, C extends CommandName> = CommandMap<T>[C]["result"];
export type BatchEntry<T> = { [C in CommandName]: { command: C; payload: PayloadOf<T, C> } }[CommandName];

/** Where a tab or tabset goes: a tabset, a row, a border, or a layout id (its root row). */
export interface Placement {
    to: string;
    /** default "center"; an edge of a tabset splits it; an edge of a root row docks to that edge */
    location?: DockLocation;
    /** for a center drop: the insertion index; -1 (default) appends */
    index?: number;
    /** select the tab in its new place; default: the target's auto-select rule */
    select?: boolean;
}
export type TabAddPayload<T> = { [K in ComponentOf<T>]: TabInit<K, TabDataOf<T, K>> & Placement }[ComponentOf<T>];
export type TabMovePayload = { tab: string } & Placement;
export type TabsetMovePayload = { tabset: string } & Omit<Placement, "select">;
export type TabUpdatePayload<T> = { [K in ComponentOf<T>]: { tab: string; component: K } & DataField<TabDataOf<T, K>> }[ComponentOf<T>];
/** `null` removes a field, so it falls back to the defaults (§3) */
export type Nullable<P> = { [K in keyof P]?: P[K] | null };
export type TabConfigurePayload = { tab: string } & Nullable<{ enableClose: boolean; enableDrag: boolean; enablePopout: boolean; borderWidth: number; borderHeight: number } & Required<SizeLimits>>;
export type TabsetConfigurePayload<T> = { tabset: string } & Nullable<Required<TabsetDefaults> & { data: TabsetDataOf<T> }>;
export type BorderConfigurePayload<T> = { border: string; open?: boolean } & Nullable<Required<BorderDefaults> & { show: boolean; data: BorderDataOf<T> }>;
export type LayoutDefaultsPatch = { [K in keyof LayoutDefaults]?: Nullable<NonNullable<LayoutDefaults[K]>> | null };
```

Shared schema fragments (the JSON Schema `$defs` the payload schemas reference):

```json
{
    "id": { "type": "string", "minLength": 1 },
    "location": { "enum": ["center", "top", "bottom", "left", "right"] },
    "rect": {
        "type": "object",
        "properties": { "x": { "type": "number" }, "y": { "type": "number" }, "width": { "type": "number", "minimum": 0 }, "height": { "type": "number", "minimum": 0 } },
        "required": ["x", "y", "width", "height"],
        "additionalProperties": false
    },
    "size": { "type": "number", "minimum": 0 },
    "placement": {
        "to": { "$ref": "#/$defs/id" },
        "location": { "$ref": "#/$defs/location" },
        "index": { "type": "integer", "minimum": -1 },
        "select": { "type": "boolean" }
    }
}
```

The validator (§6.5) supports local `$ref`s. In the schemas below, `"placement…"` means the four
`placement` properties are merged into `properties`.

### 5.2 Tabs

#### `tab.add`

- **Description:** "Add a new tab. `component` names what the tab shows and `data` holds its state
  (validated when the app registered a data schema). `to` is a tabset, a row, a border or a layout
  id; `location` center adds it to that tabset or border at `index` (-1 appends), an edge of a
  tabset splits it, an edge of a root row docks the tab to that side of the layout."
- **Payload:** `TabAddPayload<T>`. **Result:** `{ tab: string }` (the new tab's id).
- **Schema:** `{ type: object, properties: { id, component: { type: string, minLength: 1 }, data: {}, pinned, enableClose, enableDrag, enablePopout: boolean, minWidth…maxHeight, borderWidth, borderHeight: size, placement… }, required: ["component", "to"], additionalProperties: false }`.
- **Preconditions:**
  - `not_found` (path `/to`): `to` is not a tabset, row, border or layout.
  - `refused` (path `/id`): the id is already in use.
  - `refused` (path `/to`): the target refuses the drop (§5.8).
  - `invalid_payload` (path `/data`): `data` fails the component's registered data schema.
- **Transient:** no. **Replaces:** `Actions.addTab`, `Actions.addNode`.

#### `tab.select`

- **Description:** "Select a tab, making it visible. In a tabset the tabset also becomes the active
  one; in a border the border's panel opens. Selecting the selected tab changes nothing."
- **Payload:** `{ tab: string }`. **Result:** `{ tab: string }`.
- **Schema:** `{ type: object, properties: { tab: id }, required: ["tab"], additionalProperties: false }`.
- **Preconditions:** `not_found` (path `/tab`).
- **Transient:** no. **Replaces:** `Actions.selectTab` (its border toggle is `border.configure` with
  `open: false`).

#### `tab.close`

- **Description:** "Close a tab and remove it from the layout. Refused for a pinned tab or one whose
  enableClose is false."
- **Payload:** `{ tab: string }`. **Result:** `{ tab: string }`.
- **Schema:** as `tab.select`.
- **Preconditions:** `not_found` (path `/tab`); `refused` (path `/tab`): pinned, or `enableClose`
  resolves to false.
- **Transient:** no. **Replaces:** `Actions.deleteTab`.

#### `tab.move`

- **Description:** "Move a tab to another place: into a tabset or border at an index (location
  center), beside a tabset (an edge location splits it), or to an edge of a layout (`to` a root row or
  a layout id, with an edge location). Refused where the tab or the target does not allow it."
- **Payload:** `TabMovePayload`. **Result:** `{ tab: string }`.
- **Schema:** `{ type: object, properties: { tab: id, placement… }, required: ["tab", "to"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tab`, `/to`); `refused` (`/tab`): `enableDrag` resolves to false;
  `refused` (`/to`): the target refuses the drop (§5.8).
- **Transient:** no. **Replaces:** `Actions.moveNode` for tabs.

#### `tab.update`

- **Description:** "Replace a tab's data (and optionally switch its component). `data` is the whole
  new value, not a patch; it is validated when the app registered a schema for the component."
- **Payload:** `TabUpdatePayload<T>`. **Result:** `{ tab: string }`.
- **Schema:** `{ type: object, properties: { tab: id, component: { type: string, minLength: 1 }, data: {} }, required: ["tab", "component"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tab`); `invalid_payload` (`/data`): the registered data schema
  rejects `data`.
- **Transient:** no. **Replaces:** `Actions.renameTab`, `Actions.updateNodeAttributes` with
  `config` or `name` on a tab.

#### `tab.pin`

- **Description:** "Pin (value true) or unpin a tab of a tabset. Pinned tabs sit at the start of the
  strip, cannot be closed and cannot be dragged out of their tabset."
- **Payload:** `{ tab: string; value: boolean }`. **Result:** `{ tab: string }`.
- **Schema:** `{ type: object, properties: { tab: id, value: { type: boolean } }, required: ["tab", "value"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tab`); `refused` (`/tab`): the tab is in a border.
- **Transient:** no. **Replaces:** `Actions.setTabPinned`.

#### `tab.popout`

- **Description:** "Open a tab in a new browser window (a window layout). `rect` is the window's
  screen rect; a default is used without one. Refused when the tab does not allow popouts or is
  already in a window."
- **Payload:** `{ tab: string; rect?: Rect }`. **Result:** `{ window: string }`.
- **Schema:** `{ type: object, properties: { tab: id, rect }, required: ["tab"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tab`); `refused` (`/tab`): `enablePopout` resolves to false, the
  tab is in a window, or it is pinned.
- **Transient:** no. **Replaces:** `Actions.popoutTab` (`"window"` only).

#### `tab.configure`

- **Description:** "Change a tab's behaviour flags and size limits. A null value removes the tab's own
  value so the layout default applies."
- **Payload:** `TabConfigurePayload`. **Result:** `{ tab: string }`.
- **Schema:** `{ type: object, properties: { tab: id, enableClose, enableDrag, enablePopout: nullable boolean, minWidth…maxHeight, borderWidth, borderHeight: nullable size }, required: ["tab"], additionalProperties: false }`
  (nullable: `{ anyOf: [schema, { const: null }] }`).
- **Preconditions:** `not_found` (`/tab`).
- **Transient:** no. **Replaces:** `Actions.updateNodeAttributes` on a tab's behaviour attributes.

### 5.3 Tabsets

#### `tabset.activate`

- **Description:** "Make a tabset the active one of its layout."
- **Payload:** `{ tabset: string }`. **Result:** `{ tabset: string }`.
- **Schema:** `{ type: object, properties: { tabset: id }, required: ["tabset"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tabset`).
- **Transient:** no. **Replaces:** `Actions.setActiveTabset`.

#### `tabset.maximize`

- **Description:** "Maximize a tabset so it fills its layout (value true), or restore it (value
  false). Maximizing also makes it active. Refused when the tabset does not allow it or is the only
  tabset of its layout."
- **Payload:** `{ tabset: string; value: boolean }`. **Result:** `{ tabset: string }`.
- **Schema:** `{ type: object, properties: { tabset: id, value: { type: boolean } }, required: ["tabset", "value"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tabset`); `refused` (`/tabset`, value true only):
  `enableMaximize` resolves to false, or it is the only child of its layout's root row and not
  maximized.
- **Transient:** no. **Replaces:** `Actions.maximizeToggle`.

#### `tabset.close`

- **Description:** "Close a tabset: its closable tabs close, and the tabset is removed once empty.
  Refused when the tabset's enableClose is false."
- **Payload:** `{ tabset: string }`. **Result:** `{ closed: string[] }` (the closed tab ids).
- **Schema:** as `tabset.activate`.
- **Preconditions:** `not_found` (`/tabset`); `refused` (`/tabset`): `enableClose` resolves to false.
- **Transient:** no. **Replaces:** `Actions.deleteTabset`.

#### `tabset.move`

- **Description:** "Move a whole tabset: merge its tabs into another tabset (location center), place it
  beside a tabset (an edge), or dock it to an edge of a layout."
- **Payload:** `TabsetMovePayload`. **Result:** `{ tabset: string }` (the moved tabset, or the target
  of a merge).
- **Schema:** `{ type: object, properties: { tabset: id, to, location, index }, required: ["tabset", "to"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tabset`, `/to`); `refused` (`/tabset`): `enableDrag` resolves to
  false; `refused` (`/to`): the target refuses the drop (§5.8), including a target inside the
  tabset itself.
- **Transient:** no. **Replaces:** `Actions.moveNode` for tabsets.

#### `tabset.popout`

- **Description:** "Open a whole tabset in a new browser window. Refused when any of its tabs does
  not allow popouts, when it is empty, or when it is already in a window."
- **Payload:** `{ tabset: string; rect?: Rect }`. **Result:** `{ window: string }`.
- **Schema:** `{ type: object, properties: { tabset: id, rect }, required: ["tabset"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tabset`); `refused` (`/tabset`).
- **Transient:** no. **Replaces:** `Actions.popoutTabset` (`"window"` only).

#### `tabset.configure`

- **Description:** "Change a tabset's behaviour flags, size limits or data. A null value removes the
  tabset's own value so the layout default applies (data: null removes the data)."
- **Payload:** `TabsetConfigurePayload<T>`. **Result:** `{ tabset: string }`.
- **Schema:** `{ type: object, properties: { tabset: id, enableDrop…autoSelectTab: nullable boolean, minWidth…maxHeight: nullable size, data: {} }, required: ["tabset"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/tabset`).
- **Transient:** no. **Replaces:** `Actions.updateNodeAttributes` on a tabset.

### 5.4 Rows

#### `row.resize`

- **Description:** "Set the relative weights of a row's children, one positive number per child in
  order (the splitters issue this while dragged)."
- **Payload:** `{ row: string; weights: number[] }`. **Result:** `{ row: string }`.
- **Schema:** `{ type: object, properties: { row: id, weights: { type: array, items: { type: number, exclusiveMinimum: 0 } } }, required: ["row", "weights"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/row`); `invalid_payload` (`/weights`): not one weight per child.
- **Transient:** yes. **Replaces:** `Actions.adjustWeights`.

#### `row.configure`

- **Description:** "Set (or, with null, remove) a row's data."
- **Payload:** `{ row: string; data?: RowDataOf<T> | null }`. **Result:** `{ row: string }`.
- **Schema:** `{ type: object, properties: { row: id, data: {} }, required: ["row"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/row`).
- **Transient:** no. **Replaces:** `Actions.updateNodeAttributes` on a row.

### 5.5 Borders

#### `border.resize`

- **Description:** "Set the size in px of a border's panel (of its selected tab when that tab has its
  own border size). The size is clamped to the border's min and max."
- **Payload:** `{ border: string; size: number }`. **Result:** `{ border: string; size: number }`
  (the size applied).
- **Schema:** `{ type: object, properties: { border: id, size }, required: ["border", "size"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/border`).
- **Transient:** yes. **Replaces:** `Actions.adjustBorderSplit`.

#### `border.configure`

- **Description:** "Open or close a border's panel (open), switch it between docked and overlay
  (mode), show or hide it, or change its sizes, flags or data. Opening selects its first tab when none
  is selected. A null value removes the border's own value so the layout default applies."
- **Payload:** `BorderConfigurePayload<T>`. **Result:** `{ border: string }`.
- **Schema:** `{ type: object, properties: { border: id, open: boolean, mode: nullable enum, show, autoHide, enableDrop, autoSelectTabWhenOpen, autoSelectTabWhenClosed: nullable boolean, size, minSize, maxSize: nullable size, data: {} }, required: ["border"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/border`); `refused` (`/open`): open true on a border with no tabs.
- **Transient:** no. **Replaces:** `Actions.setBorderType`, the border toggle of `Actions.selectTab`,
  `Actions.updateNodeAttributes` on a border.

### 5.6 Windows

#### `window.close`

- **Description:** "Close a popout window layout: its tabs move back into the main layout's active
  tabset (its first tabset when none is active), and the window closes."
- **Payload:** `{ window: string }`. **Result:** `{ tabs: string[] }` (the tabs moved back).
- **Schema:** `{ type: object, properties: { window: id }, required: ["window"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/window`).
- **Transient:** no. **Replaces:** `Actions.closePopout` (the `"float"` policy is removed) and the
  engine's `dockBack` of a whole window.

#### `window.configure`

- **Description:** "Record a popout window's screen rect (the engine does this when the window moves or
  resizes, so a saved layout reopens it in place)."
- **Payload:** `{ window: string; rect: Rect }`. **Result:** `{ window: string }`.
- **Schema:** `{ type: object, properties: { window: id, rect }, required: ["window", "rect"], additionalProperties: false }`.
- **Preconditions:** `not_found` (`/window`).
- **Transient:** yes. **Replaces:** FlexLayout reading `window.screenLeft` in `toJson`.

### 5.7 Layout

#### `layout.configure`

- **Description:** "Change the layout defaults: the default behaviour of tabs, tabsets and borders,
  and layout settings (root orientation, edge docking). Fields are merged; a null value removes one."
- **Payload:** `{ defaults: LayoutDefaultsPatch }`. **Result:** `{}`.
- **Schema:** `{ type: object, properties: { defaults: { type: object, properties: { tab, tabset, border, layout: nullable objects of nullable fields } } }, required: ["defaults"], additionalProperties: false }`.
- **Preconditions:** none.
- **Transient:** no. **Replaces:** `Actions.updateModelAttributes`.

#### `layout.load`

- **Description:** "Replace the whole layout with a JSON v1 document (a saved layout, an undo step, a
  remote sync). Nodes keep their identity by id, so tabs whose ids survive keep their mounted
  content."
- **Payload:** `{ layout: LayoutJson<T> }`. **Result:** `{ added: string[]; removed: string[] }` (node
  and window ids).
- **Schema:** `{ type: object, properties: { layout: <layoutSchema> }, required: ["layout"], additionalProperties: false }`.
- **Preconditions:** `invalid_payload` with every issue (§4.3), paths under `/layout`.
- **Transient:** no. **Replaces:** `Model.fromJson(json, previousModel)` (the model swap).
- **Reconciliation:** the model keeps its identity; only its state changes. A node is "the same node"
  when its id is present before and after, whatever its position or fields. `added` lists ids only
  in the new state, `removed` ids only in the old one. The engine keeps the view state (moveable
  element, scroll, "rendered") of every surviving tab id and releases the removed ones (§8.2).

#### `batch`

- **Description:** "Run several commands in order as one atomic step: if any fails, none applies.
  Emits one change event. Nested batches are flattened."
- **Payload:** `{ commands: { command: string; payload: object }[] }`. **Result:** `{ results }` (each
  command's value, in order; a nested batch contributes its commands' values).
- **Schema:** `{ type: object, properties: { commands: { type: array, items: { type: object, properties: { command: { type: string }, payload: { type: object } }, required: ["command", "payload"], additionalProperties: false } } }, required: ["commands"], additionalProperties: false }`.
- **Preconditions:** the first failing command's error, with its path prefixed by
  `/commands/<i>/payload` (or `/commands/<i>/command` for an unknown name).
- **Transient:** yes when every command in it is transient-capable and the batch runs transient.
- **Replaces:** `Actions.group`.

### 5.8 Drop rules (shared by `tab.add`, `tab.move`, `tabset.move`)

A move or add to `to` with `location` is refused when (FlexLayout's `Node.isDockAllowed`,
`Node.ts:315-379`, `ModelLayout.canDockTo`, `ModelLayout.ts:101-127`, and the subtree guards of
`Model.ts:258-296`, `RowNode.ts:563`, `TabSetNode.ts:566`):

1. `to` is a tabset and `location` is center and its `enableDrop` resolves to false;
2. `to` is a tabset and `location` is an edge and its `enableDivide` resolves to false;
3. `to` is a border and its `enableDrop` resolves to false, `location` is not center, a tabset
   is moving (a border holds tabs only), or the tab is pinned (only a tabset has a pinned run);
4. an existing tab is pinned and the move leaves its tabset (another `to`, or an edge location);
5. a tabset moving with location center into a tabset, when its `enableClose` resolves to false or
   it holds a pinned tab;
6. `to` is the moved tabset itself or inside it;
7. `to` is in a window and a moving tab's `enablePopout` resolves to false.

A row accepts any location, as `RowNode.drop` does: the edge bands (and `defaults.layout.edgeDock`)
only decide where a drag offers an edge drop, not what a command may do.

The drop indicator refuses a target exactly when `model.can` refuses the command the drop would run
(§8.4), so middleware vetoes and these rules show the same way.

### 5.9 Removed actions

| action | reason |
|---|---|
| `Actions.updateSubLayoutAttributes`, `Actions.createSubLayout`, `Actions.createPopout` | `"tab"` sub-layouts are removed; windows are created by `tab.popout`, `tabset.popout` or `layout.load` |
| `Actions.closePopout` | the `"float"` close policy is removed; `window.close` docks back |
| `Actions.movePopoutToFront`, `Actions.moveFloat`, `Actions.popoutFloat`, `Actions.dockFloatToLayout` | floats are removed |
| `Actions.addTabToNewGroup`, `Actions.ungroup`, `Actions.removeTabFromGroup` | tab groups are removed |

## 6. Bus semantics

### 6.1 Results

```ts
export type CommandResult<R> = { ok: true; value: R } | { ok: false; error: CommandError };
export interface CommandError {
    code: CommandErrorCode;
    message: string;
    /** JSON pointer into the payload (or the dispatched input) */
    path?: string;
    /** every schema problem, for invalid_payload */
    issues?: ValidationIssue[];
}
export type CommandErrorCode =
    | "unknown_command"
    | "invalid_payload"
    | "not_found"
    | "refused"
    | "vetoed"
    | "queued"
    | "middleware_error";
```

`run`, `dispatch` and `can` never throw on bad input: every failure is a result.

### 6.2 The order

For `run(command, payload, options?)`:

1. **Lookup.** An unknown name returns `unknown_command`.
2. **Validation.** The payload is validated against the command's schema (and the component's data
   schema for `tab.add`/`tab.update`); `invalid_payload` with the first issue's path and all issues.
   `options.transient` on a command that is not transient-capable is `invalid_payload` at
   `/transient`.
3. **Middleware.** The chain runs outermost first (§6.3). Each middleware may return early (a veto,
   `vetoed`) or call `next()`.
4. **Preconditions and reducer.** The innermost `next()` re-validates the payload if a middleware
   replaced it, then runs the command's preconditions and reducer on a draft of the current state
   (`not_found`, `refused`, …).
5. **Commit.** Unless `ctx.dryRun`, the new state replaces the old one (frozen, structurally shared,
   the id index updated incrementally) and the result goes back up the chain, so middleware can
   observe it after `next()`.
6. **Subscribe.** One event is delivered to every listener (§6.6).

`dispatch(input: unknown, options?: { meta })` first validates the envelope `{ command: string,
payload: object, transient?: boolean }` (`invalid_payload` with paths such as `/command`; any other
key, `meta` included, is refused), then runs as above. `options.meta` is the app's (who asked, for a
middleware to decide on), never the input's.

### 6.3 Middleware

```ts
export type Middleware<T> = (ctx: CommandContext<T>, next: () => CommandResult<unknown>) => CommandResult<unknown> | undefined;
export interface CommandContext<T> {
    readonly command: CommandName;
    /** the validated payload; assign a new object to rewrite it */
    payload: PayloadOf<T, CommandName>;
    readonly dryRun: boolean;
    readonly transient: boolean;
    /** true for a command running inside a batch (the batch itself also runs the chain) */
    readonly inBatch: boolean;
    /** free-form information from the caller (`options.meta`), e.g. a drag group transfer */
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** the state the command applies to */
    readonly state: LayoutState<T>;
    get(id: string): Node<T> | undefined; // as the command sees it (inside a batch: so far)
    parentOf(id: string): ParentNode<T> | undefined;
}
model.use(middleware): () => void; // returns the function that removes it
```

- **Veto:** return an error without calling `next()`; the `veto(message)` helper builds
  `{ ok: false, error: { code: "vetoed", message } }`.
- **Rewrite:** assign `ctx.payload` and call `next()`; the new payload is validated again.
- **Observe:** call `next()`, inspect its result, return it.
- Returning `undefined` passes on the result of `next()` when it was called, and is a veto otherwise.
- A middleware that throws yields `middleware_error`; nothing is committed.
- Middleware is synchronous. The drop indicator asks `model.can` on every `dragover`, which cannot
  wait for a promise (the issue's sketch showed an async middleware; a synchronous chain is what the
  drop probe needs).
- It applies to every command, engine-issued or not, and to each command inside a batch
  (`inBatch: true`), so a batch cannot bypass a veto.

### 6.4 Batch and transient

- A batch runs its commands on one draft, in order. Nested `batch` entries are flattened. The first
  failure stops it: nothing commits and no event is emitted.
- `run(name, payload, { transient: true })` marks a continuous gesture (a splitter drag). The event
  carries `transient: true`; an undo stack merges consecutive transient events of the same command
  and target. Transient-capable: `row.resize`, `border.resize`, `window.configure`, and a batch of
  those.

### 6.5 Discovery and the validator

```ts
export interface CommandInfo {
    name: CommandName;
    description: string;
    payloadSchema: JsonSchema;
    resultSchema: JsonSchema;
    transient: boolean;
}
model.commands(): readonly CommandInfo[];
```

The schemas are hand-written objects in `src/schema/` and `src/commands/`, typed `as const`. A type
test derives a TypeScript type from each schema (`FromSchema<S>`, a type-level reader of the subset)
and checks it against `PayloadOf<AnyTypes, C>`, so schema and type cannot drift.

The internal validator supports exactly the subset the schemas use: `type` (`object`, `array`,
`string`, `number`, `integer`, `boolean`, `null`), `properties`, `required`, `additionalProperties`
(boolean), `enum`, `const`, `items`, `oneOf`, `anyOf`, `minimum`, `exclusiveMinimum`, `minLength`,
`minItems`, and local `$ref` with `$defs` (the layout schema is recursive). Unknown keywords are
ignored. Errors carry a JSON pointer.

The model copies the `data` and `defaults` it is given (JSON, payloads), so it never freezes or
shares an object the caller still owns.

`createModel(json, { dataSchemas: { editor: {...} } })` registers per-component data schemas;
`tab.add`, `tab.update` and `layout.load` validate `data` with them.

### 6.6 Events and re-entrancy

```ts
export interface CommandEvent<T> {
    command: CommandName;
    payload: unknown;
    result: unknown;
    before: LayoutState<T>;
    after: LayoutState<T>;
    transient: boolean;
    meta: Readonly<Record<string, unknown>> | undefined;
    /** for a batch: the commands it ran, flattened */
    commands?: readonly { command: CommandName; payload: unknown; result: unknown }[];
}
model.subscribe(listener: (event: CommandEvent<T>) => void): () => void;
```

- One event per successful commit, including a command that changed nothing (`before === after`).
- A `run` from a **listener** executes immediately (the previous commit is complete); its event is
  queued after the events still being delivered, so every listener sees commits in order.
- A `run` from a **middleware** (a command is in flight) is queued and executes after the current
  command commits; it returns `{ ok: false, error: { code: "queued" } }` immediately.
- `can` from anywhere runs immediately (it commits nothing).
- A listener that throws does not stop the others; the first error is rethrown after all of them ran.

### 6.7 Dry run

`model.can(name, payload)` performs steps 1–4 with `ctx.dryRun = true` and returns the result the
command would have. It commits nothing and emits nothing. Middleware sees `dryRun` and must not
cause side effects in it.

## 7. Queries

All on `Model<T>`, over the current state; the same functions exist over any state in
`src/state/queries.ts`.

```ts
readonly state: LayoutState<T>;
get(id: string): Node<T> | undefined;                    // O(1)
parentOf(id: string): ParentNode<T> | undefined;         // O(1)
layoutOf(id: string): string | undefined;                // MAIN_LAYOUT or a window id, O(1)
root(layout?: string): RowNode<T> | undefined;           // default MAIN_LAYOUT
windowLayout(id: string): WindowLayout<T> | undefined;
tabs(layout?: string): TabOf<T>[];                       // every tab (of a layout when given), in tree order
tabsets(layout?: string): TabsetNode<T>[];
selectedTab(container: string): TabOf<T> | undefined;    // a tabset's or border's selected tab
activeTabset(layout?: string): TabsetNode<T> | undefined;
maximizedTabset(layout?: string): TabsetNode<T> | undefined;
isHiddenByMaximize(id: string): boolean;
resolve(node: TabOf<T>): ResolvedTab;                    // §3, one overload per kind
resolveLayout(): Required<LayoutSettings>;               // §3
toJSON(): LayoutJson<T>;
```

`isHiddenByMaximize(id)` is true for a tabset or row of a layout whose maximized tabset is another
node and that is not on the path to it (the rule of `Model.ts:880-898`).

## 8. The view engine

### 8.1 Module layout (`packages/core/src`)

| module | contains | FlexLayout port (keeps the header) |
|---|---|---|
| `state/` | node types, `LayoutState`, `LayoutJson`, defaults and `resolve`, ids, the draft and index, load and `toJSON`, queries, `createModel` | `tidy.ts`, `selection.ts` port `RowNode.tidy` and `Utils.ts` |
| `commands/` | the catalogue: one definition per command (name, description, schemas, reducer), the bus | `dock.ts` ports `TabSetNode.drop`, `RowNode.drop`, `BorderNode.drop`, `Model.apply*` |
| `schema/` | the validator, `layoutSchema`, shared `$defs`, `FromSchema` | — |
| `geometry/` | `Rect` helpers, dock-location quadrants and dock rects, edge bands (one implementation) | `rect.ts` (`Rect.ts`), `dock.ts` (`DockLocation.ts`) |
| `split/` | `calculateSplit`, splitter bounds and initials, min/max aggregation, border splitter bounds | `split.ts` (`RowNode.ts:121-356`, `BorderNode.ts:418-476`) |
| `drop/` | drop target resolution over state plus rects: candidates, `findStripDrop`, the pinned clamp | `resolve.ts`, `strip.ts` (`Node.findDropTargetNode`, `*.canDrop`, `StripDrop.ts`) |
| `engine/` | `LayoutEngine`, the view state tables, `isTabPanelVisible` | `LayoutEngine.ts` (LayoutController, LayoutInternal) |
| `dnd/` | `DragDropManager`, `DragState`, drop zones, `DragGroup` | `DragDropManager.ts` |
| `popout/` | `PopoutManager`, `StyleMirror`, `mirrorRootAttributes` | `PopoutManager.ts` |
| `splitter/` | `SplitterController`, `startDrag` | `SplitterController.ts` |
| `keyboard/` | the keymap | `keymap.ts` |
| `overflow/` | `computeTabOverflow` | — |
| `labels/` | `DockableLabel` | `DockableLabel.ts` |
| `paths.ts` | the `data-layout-path` scheme and DOM ids | `paths.ts` |

The guard test's header rule applies to the files marked as ports.

### 8.2 View state, keyed by id

The engine never writes to the state. Everything the view needs that is not layout state lives in
the engine, keyed by node id:

| table | key | owner |
|---|---|---|
| measured rects (row, tabset, tab strip, content, tab button, border strip, border content) | `kind:id` | each layout's engine |
| moveable elements | tab id | shared (main engine) |
| scroll positions | tab id | shared |
| rendered tabs (render on demand) | tab id | shared |
| visible tabs (for `resize`/`visibility` notifications) | tab id | shared |
| hidden tabs (tab overflow) | container id | each layout's engine |
| splitter size, splitter dragging, render revision | — | shared |
| paths and min/max sizes (computed per state) | node id | each layout's engine |

The shared object replaces the "delegate to `mainEngine`" methods. On every model event the engine
drops the entries of removed ids (a removed tab's moveable is released) and keeps the rest, so
`layout.load` with the same ids keeps every moveable element.

### 8.3 `LayoutEngine` API (what `packages/react` uses)

```ts
class LayoutEngine<T extends DockableTypes = AnyTypes> {
    constructor(options: LayoutEngineOptions<T>);
    readonly model: Model<T>;
    readonly layoutId: string;
    readonly main: LayoutEngine<T>;
    /** model.run, for the adapters */
    run: Model<T>["run"];
    setOptions(options: LayoutEngineSettings<T>): void; // the options an adapter may change
    // render cycle
    subscribe(listener): () => void; getSnapshot(): number;
    prepare(): void; attachRoot(element): void; detachRoot(): void; sync(): void; dispose(): void;
    // registration (by id)
    registerMeasurable(id: string, kind: MeasurableKind, element: HTMLElement | null): void;
    registerTabList(containerId: string, element: HTMLElement | null, vertical?: boolean): void;
    registerOverflowTrigger(containerId: string, element: HTMLElement | null): void;
    registerTabPanel(tabId: string, element: HTMLElement | null): void;
    registerSplitter(element: HTMLElement, isHorizontal: () => boolean, register?: boolean): void;
    registerDropZone(element: Element, options: DropZoneOptions<T>): () => void;
    // derived view data
    path(id: string): string; minMax(id: string): SizeRange; splitterSize(): number;
    tabButtonId(tabId: string): string; tabPanelId(tabId: string): string; // DOM ids, page-unique
    edgeBands(): readonly { location: BorderLocation; rect: Rect }[];
    getHiddenTabs(containerId): readonly string[]; subscribeOverflow(listener): () => void;
    isPanelVisible(tabId): boolean; shouldRender(tab, renderOnDemand): boolean;
    // moveables
    getMoveableElement(tabId): HTMLElement; attachMoveable(tabId, panel, options?): void; releaseMoveable(tabId, panel?): void;
    // popouts
    getPopoutManager(): PopoutManager<T>; isSupportsPopout(): boolean; isInWindow(id): boolean;
    canPopout(id): boolean; popout(id): CommandResult<{ window: string }>; dockBack(id): CommandResult<unknown>;
    // interaction
    getDragDropManager(): DragDropManager<T>;
    handleOverlayPointerDown(event): boolean; handleOverlayKeyDown(event, key): boolean;
    closeOverlayBorder(borderId): void; focusAdjacentTabset(delta): boolean;
    isRealtimeResize(): boolean; isSplitterDragging(): boolean; getTabDragSpeed(): number;
    getBoundingClientRect(element): Rect; getDomRect(): Rect; getCurrentDocument(): Document | undefined; getCurrentWindow(): Window | undefined;
}
```

Removed: `doAction`, `interceptAction`, `LayoutEngine.of`, `redrawLayoutAndTabContent`, the
`onAction`/`onModelChange`/`onAllowDrop` options, `FLOAT_ATTRIBUTE`, `startDockLayoutDrag`,
`getRegistrations` (tests read the tables through an `@internal` accessor), and every getter that
delegated to the main engine.

Options: `model`, `layoutId`, `main`, `measure`, `realtimeResize`, `tabDragSpeed`, `popout`
(`popoutURL`, `supportsPopout`, `title`, `onPopoutOpen`, `onPopoutClose`, `mirrorRoot`,
`openWindow`), `onExternalDrag`, `dragGroup`, `idScope`.

`idScope` keeps a layout's DOM ids (`aria-controls`, `aria-labelledby`) and its popout window names
apart from another layout's on the page: default ids (`tab-1`, `window-1`) are the same in every
model. It defaults to a page-unique `d<n>-`; the React adapter passes `useId()`, so server and
client agree. Popout engines share their main engine's scope.

### 8.4 Drag and drop

- `DragDropManager` resolves a drop in two steps: `drop/` produces the geometric candidates in
  FlexLayout's order (open overlay borders, the root row's edge bands, the maximized tabset or the
  tabsets under the pointer, then the border strips and open border panels); the engine turns each
  into the command the drop would run (`tab.move`, `tabset.move`, or `tab.add` for a new tab) and
  asks `model.can`. The first accepted candidate is the target; the first refused one is reported
  as `refused` (`data-drop-refused`). `onAllowDrop` is gone: a middleware veto refuses a drop.
- The page-wide `DragState` stays static. A drag sets the MIME type `application/x-dockable` on the
  data transfer, and the manager only claims `dragenter`/`dragover`/`drop` events that carry it; a
  foreign drag is offered to `onExternalDrag` or ignored. Every `drop` and `dragend` in the document
  (a capture listener installed while the root is attached) ends the page's drag state.
- A drop runs its command through `model.run` (so middleware applies again); `DragGroup` transfers a
  tab between models with a `tab.add` in the target and a `tab.close` in the source, each through its
  own model's middleware, marked `meta: { transfer }`. When the tab's id is taken in the target, the
  new tab gets a generated id. The new tab adopts the old one's moveable element.
- `sortLayouts()` is gone: the layout under the pointer is the one whose root has an active
  `dragenter` count (windows are separate documents).

### 8.5 Splitters

`SplitterController` computes with `split/` over the state and the engine's rects and min/max, and
runs `row.resize` / `border.resize`. A realtime drag runs them with `{ transient: true }` on every
move; the engine applies a transient `row.resize` by writing `flex-grow` imperatively (no re-render)
and a transient `border.resize` by writing the panel size, as today. The release runs one
non-transient command. ARIA and keyboard behaviour are unchanged.

### 8.6 Popouts

- `PopoutManager` keeps one native window per window layout of the state, while the main engine is
  attached: it opens the missing ones and closes those whose layout disappeared. A detach defers the
  release to a microtask, so a StrictMode remount keeps the windows.
- The window opener is injectable: `openWindow(url, name, features) => Window | null` (default: the
  main window's `open`).
- Closing a window from the browser runs `window.close` (dock back); a window that cannot open (no
  popout support, a blocked `open`) also runs it.
- The `"float"` close policy is removed. Style mirroring, root-attribute mirroring and the load
  sequence are unchanged.
- The popout content root keeps `data-dockable-popout`; a window layout's path is
  `/sublayout<n>`, `n` being the lowest number free when the window is first seen, kept while it
  is open (closing one window never renames another's elements).
- The window's screen rect is recorded with a transient `window.configure` on `resize` and by a
  poll (`WINDOW_RECT_POLL_INTERVAL_MS`: a window that only moves fires no event), only when it
  changed. The engines do not redraw for it.

## 9. Tidy and selection rules

These keep FlexLayout's results, so the `data-layout-path` indexes do not shift. Each has a test in
`packages/core/tests/state/` (named in the right column).

### 9.1 Tidy (after every structural command and on load)

| rule | from | test |
|---|---|---|
| a row with no children is removed | `RowNode.ts:366-368` | `tidy.test.ts` "removes an empty row" |
| a row with one child is replaced by it: a tabset takes the row's weight; a row's children are hoisted, their weights scaled to the row's (evenly when they sum to 0) | `RowNode.ts:369-400` | "hoists a single child", "scales hoisted weights" |
| an empty tabset is removed when `deleteWhenEmpty` and `enableClose` resolve true; a removed maximized tabset clears `maximized` | `RowNode.ts:404-418` | "removes an empty tabset", "keeps an empty tabset that must stay" |
| an empty main root gets a new empty tabset (`selected: -1`) that becomes active | `RowNode.ts:428-445` | "gives an empty main layout a tabset" |
| an empty window root removes the window | `RowNode.ts:434-437` | "removes an empty window" |
| a layout's `active` or `maximized` naming a node that is gone is cleared | `Model.ts:855-865` | "clears a dangling active tabset" |

### 9.2 Selection

| rule | from | test |
|---|---|---|
| removing the selected tab selects the next one (the new last when it was last); removing one before it shifts the index | `Utils.ts:57-102` | `selection.test.ts` "close selects the next tab" |
| a border tab removed keeps the index, clamped | `BorderNode.ts:313-316` | "border close clamps" |
| inserting a tab selects it when `select` is true, or when `select` is not false and the container auto-selects (a border: `autoSelectTabWhenOpen` while open, `autoSelectTabWhenClosed` while closed); otherwise the previously selected tab stays selected | `Utils.ts:182-207` | "insert selects", "insert keeps the selection" |
| a tab leaving a border that had it selected closes the border | `Utils.ts:156-162` | "moving the open border tab closes it" |
| a tab docked to a row (edge) leaves its source tabset selecting index 0 (a border: none); a source left empty ends at -1, where FlexLayout keeps 0 and a later merge overflows the index | `RowNode.ts:574-580` | "row edge dock resets the source selection" |
| merging a tabset shifts the target's selection past the inserted tabs, and selects 0 when it had none | `TabSetNode.ts:626-641` | "merge keeps the selection" |
| a forward move within the same container inserts one index earlier | `TabSetNode.ts:575-582` | "reorder forward" |

### 9.3 Docking

| rule | from | test |
|---|---|---|
| an edge drop on a tabset whose row has the drop's orientation inserts beside it and halves its weight | `TabSetNode.ts:678-681` | `dock.test.ts` "split along the row" |
| otherwise the tabset is wrapped in a new row (its weight), both at 50 | `TabSetNode.ts:683-719` | "split across the row" |
| a drop on a root row edge: along the row's orientation it inserts first or last with weight `sum/3`; across it wraps the row's children in a new row (75) beside the new tabset (25) | `RowNode.ts:605-662` | "edge dock along", "edge dock across" |
| the new or target tabset becomes active | `RowNode.ts:664-666`, `TabSetNode.ts:642`, `:720-722` | "drop activates" |
| moving a subtree that holds the maximized tabset clears `maximized` | `Model.ts:268-276` | "move clears maximize" |

### 9.4 Pinned

| rule | from | test |
|---|---|---|
| a pinned tab inserts at most at the end of the pinned run; others at least after it | `TabSetNode.ts:590-599` | `pinned.test.ts` "pinned run" |
| pinning moves the tab to the end of the run, unpinning to the start of the unpinned tabs; the selected tab stays selected | `Model.ts:672-717` | "pin moves", "unpin moves" |
| strip drops clamp to the run boundary | `TabSetNode.ts:491-531` | `drop.test.ts` "clamps to the pinned run" |

## 10. The React surface

### 10.1 `Dockable.Root`

| prop | status |
|---|---|
| `model: Model<T>` | kept (typed); a new state never needs a new model |
| `onAction` | removed: `model.use(middleware)` |
| `onModelChange` | removed: `model.subscribe(listener)` |
| `onAllowDrop` | removed: a middleware veto on `tab.move` / `tab.add` / `tabset.move` |
| `popoutClosePolicy` | removed: always `"dock"` (`window.close`) |
| `openWindow` | added: the injectable window opener |
| `getLabel`, `keyMap`, `realtimeResize`, `tabDragSpeed`, `popoutURL`, `supportsPopout`, `popoutMirrorRoot`, `onPopoutOpen`, `onPopoutClose`, `onExternalDrag` | kept (`onPopoutOpen`/`onPopoutClose` receive a `WindowLayout`; `onExternalDrag` returns `{ tab: TabInitOf<T>, onDrop? }`) |

### 10.2 Parts

| part | change |
|---|---|
| `Row` | `node?: RowNode<T>`; children `(child: TabsetNode<T> \| RowNode<T>) => ReactNode` |
| `TabSet`, `TabSetContent`, `TabList`, `Tab`, `Panel` | take plain nodes; `TabList` children `(tab: TabOf<T>)` |
| `Panels` | children `(tab: TabOf<T>)`; new `renderOnDemand?: boolean \| ((tab) => boolean)` (default true) |
| `Panel` | new `scrollable?: boolean` (default true), `remountInWindow?: boolean` (default false) |
| `Borders` | `renderBar` / `renderContent` receive `BorderNode<T>` |
| `Border` | new `tabDirection?: "up" \| "down"` (left border) |
| `Popout` | children `(layout: WindowLayout<T>)` |
| `DragSource` | `tab: TabInitOf<T> \| (() => TabInitOf<T>)` replaces `json`; `onDrop(tabId \| undefined)` |
| `DropZone` | `accepts(drag)` / `onDrop(drag)` receive `DragSubject<T>`: `{ kind: "tab", tab }`, `{ kind: "tabset", tabset }` or `{ kind: "new", tab: TabInitOf<T> }` |
| `PopoutTrigger` | runs `tab.popout` / `tabset.popout` / `tab.move` (dock back); enabled from `model.can` |
| `RenderedProps<E extends Element = HTMLElement>` | `ref` is a callback ref, assignable to any element's ref: `render={(props) => <div {...props} />}` needs no cast |

### 10.3 Hooks

| hook | change |
|---|---|
| `useDockable<T>()` | returns `{ model, run, engine, mainEngine, layoutId, getLabel }` |
| `useModelState(selector, isEqual?)` | new: `useSyncExternalStore` over `model.subscribe`, re-renders when the selection changes |
| `useTabSet(node)`, `useBorder(node)`, `useTabOverflow(container)`, `useSplitter(node, index)`, `useDragNode(node)`, `useTabSetDropState(engine, id)` | take plain nodes; result shapes unchanged |
| `useDragSource({ model, tab, onDrop, disabled })` | `tab` is a typed `tab.add` init; the model's engine is found through the model (no `LayoutEngine.of`) |
| `useDropZone({ model, accepts, onDrop })` | `DragSubject<T>` instead of `Node` |
| `useDragGroup()` | `transfer({ tab, from, to, target, location, index })` |

## 11. The migration table

The PR description reuses this table.

### 11.1 Model and nodes

| old | new |
|---|---|
| `Model.fromJson(json)` | `createModel<T>(json)` |
| `Model.fromJson(json, previousModel)` | `model.run("layout.load", { layout: json })` (same model) |
| `model.toJson()` / `toString()` | `model.toJSON()` / `JSON.stringify(model)` |
| `model.doAction(action)` | `model.run(name, payload)` / `model.dispatch({ command, payload })` |
| `model.addChangeListener` / `removeChangeListener` | `model.subscribe` (returns the unsubscribe) |
| `model.setOnAllowDrop` | `model.use` (veto `tab.move`, `tab.add`, `tabset.move`) |
| `model.setOnCreateTabSet` | `defaults.tabset` (a new tabset resolves its defaults) |
| `model.getNodeById(id)` | `model.get(id)` |
| `model.getRootRow(layoutId)` | `model.root(layoutId)` |
| `model.getActiveTabset(layoutId)` / `getMaximizedTabset` | `model.activeTabset(layoutId)` / `maximizedTabset` |
| `model.getFirstTabSet()` | `model.tabsets()[0]` |
| `model.visitNodes` / `visitLayoutNodes` | `model.tabs(layout?)`, `model.tabsets(layout?)`, or walk `model.state` |
| `model.getLayouts()` | `model.state.windows` (plus `MAIN_LAYOUT`) |
| `Model.MAIN_LAYOUT_ID` | `MAIN_LAYOUT` (`"main"`) |
| `model.isHiddenByMaximize(node)` | `model.isHiddenByMaximize(id)` |
| `model.getBorderSet().getBorders()` / `getBorderMap()` | `model.state.borders` (find by `location`) |
| `model.getSplitterSize()` | `engine.splitterSize()` |
| `model.getEdgeDockRects()` | `engine.edgeBands()` |
| `model.isRootOrientationVertical()`, `isEnableEdgeDock()`, `getEdgeDockMargin()`, `getEdgeDockLength()` | `model.resolveLayout()` |
| `model.getBorderLeftTabDirection()`, `isEnableEdgeDockIndicators()`, `isEnableRotateBorderIcons()`, `getTabGroupType()` | removed (props, or deleted, §2.1) |
| `node.getId()`, `getType()` | `node.id`, `node.type` |
| `node.getParent()`, `getChildren()` | `model.parentOf(id)`, `node.children` |
| `node.getLayoutId()`, `getLayout()`, `getWindow()`, `getDocument()` | `model.layoutOf(id)`; windows and documents come from the engine |
| `node.getRect()`, `getPath()`, `getModel()` | the engine (`engine.path(id)`); nodes know no model |
| `node.setEventListener("resize" \| "visibility" \| "close" \| "save")` | removed: `model.subscribe` for close/save; the panel's own `ResizeObserver` or `useModelState` for the rest |
| `tab.getName()`, `getAltName()`, `getIcon()`, `getHelpText()` | the app's `tab.data` |
| `tab.getComponent()`, `getConfig()` | `tab.component`, `tab.data` (typed) |
| `tab.getExtraData()` | removed: keep app state in the app, keyed by `tab.id` |
| `tab.isSelected()` | `model.selectedTab(model.parentOf(tab.id)!.id)?.id === tab.id` |
| `tab.isPinned()` | `tab.pinned === true` |
| `tab.isCloseable()` | `model.can("tab.close", { tab: id }).ok` |
| `tab.isEnableClose()`, `isEnableDrag()`, `isEnablePopout()` | `model.resolve(tab).enableClose` … |
| `tab.isEnableRename()`, `isEnablePin()` | the app's `tab.data` |
| `tab.isPoppedOut()` | `model.layoutOf(tab.id) !== MAIN_LAYOUT` |
| `tab.getTabContainer()`, `isInsideTabSet()`, `isInsideBorder()` | `model.parentOf(tab.id)` and its `type` |
| `tabset.getSelectedNode()`, `getSelected()` | `model.selectedTab(tabset.id)`, `tabset.selected` |
| `tabset.getTabNodes()` | `tabset.children` |
| `tabset.isActive()`, `isMaximized()` | `model.activeTabset(layout)?.id === tabset.id`, … |
| `tabset.isEnableMaximize()`, `canMaximize()` | `model.can("tabset.maximize", { tabset: id, value: true }).ok` |
| `tabset.getWeight()`, `getMinWidth()`… | `tabset.weight`, `engine.minMax(id)` |
| `tabset.getName()` | the app's `tabset.data` |
| `border.getLocation()`, `isHorizontal()` | `border.location` (`"left"`/`"right"` are the vertical strips) |
| `border.getSize()`, `getMinSize()`, `getMaxSize()` | `model.resolve(border)` (and the selected tab's own size) |
| `border.isOverlay()`, `getBorderType()` | `model.resolve(border).mode === "overlay"` |
| `border.isShowing()`, `isAutoHide()` | `border.show !== false`, `model.resolve(border).autoHide` |
| `ModelLayout` | `WindowLayout` (windows) / `MAIN_LAYOUT` |
| `Rect` class | `Rect` interface plus functions in `geometry/` |
| `DockLocation` class, `Orientation` class | the string unions `DockLocation`, `Orientation` |
| `DropInfo` | removed from the public API (the drop indicator state and the command payload carry the target) |
| `IJsonModel` and the `I*` attribute interfaces | `LayoutJson<T>` and the node JSON types |
| `ICloseType`, `IDraggable`, `IDropTarget`, `NodeEventType`, `BorderSet`, `TabGroupNode`, `ITabGroupType`, `ILayoutType` | removed |

### 11.2 Actions

| old | new |
|---|---|
| `Actions.addTab(json, to, location, index, select)` / `addNode` | `tab.add` |
| `Actions.moveNode(from, to, location, index, select)` | `tab.move` / `tabset.move` |
| `Actions.deleteTab(id)` | `tab.close` |
| `Actions.deleteTabset(id)` | `tabset.close` |
| `Actions.renameTab(id, text)` | `tab.update` (the name is in `data`) |
| `Actions.setTabPinned(id, pinned)` | `tab.pin` |
| `Actions.setBorderType(id, type)` | `border.configure` with `mode` |
| `Actions.selectTab(id)` | `tab.select`; closing a border is `border.configure` with `open: false` |
| `Actions.setActiveTabset(id)` | `tabset.activate` |
| `Actions.adjustWeights(id, weights)` | `row.resize` |
| `Actions.adjustBorderSplit(id, size)` | `border.resize` |
| `Actions.maximizeToggle(id)` | `tabset.maximize` with `value` |
| `Actions.updateModelAttributes(attrs)` | `layout.configure` |
| `Actions.updateNodeAttributes(id, attrs)` | `tab.configure`, `tabset.configure`, `border.configure`, `row.configure`, `tab.update` |
| `Actions.popoutTab(id)` / `popoutTabset(id)` | `tab.popout` / `tabset.popout` |
| `Actions.group(actions)` | `batch` |
| `action.setAdjusting(true)` / `isAdjusting()` | `run(…, { transient: true })` / `event.transient` |
| `action.setUserData(x)` / `userData` | `run(…, { meta })` / `ctx.meta`, `event.meta` |
| `Actions.<CONSTANT>` (`"FlexLayout_*"`) | the command name (`"tab.close"`) |
| the float, group and sub-layout actions | removed (§5.9) |

### 11.3 Engine, drag and drop, popouts

| old | new |
|---|---|
| `LayoutEngine.of(model)` | not needed: `model.run` works anywhere |
| `engine.doAction(action)` / `interceptAction` | `engine.run` (= `model.run`) / `model.can` |
| `OnAction`, `OnModelChange`, `OnAllowDrop` | `Middleware`, `CommandEvent`, a middleware veto |
| `engine.registerMeasurable(node, …)`, `registerTabPanel(node, …)`, `registerTabList(node, …)` | the same by id |
| `engine.getMoveableElement(tab)`, `attachMoveable`, `releaseMoveable` | the same by id |
| `engine.popout(node)`, `canPopout`, `isInWindow`, `dockBack` | the same by id; results are `CommandResult`s |
| `dockTabs`, `dockTargetOf` | `window.close` / `tab.move` to `model.activeTabset() ?? model.tabsets()[0]` |
| `isTabPanelVisible(tab)` | `engine.isPanelVisible(tabId)` |
| `FLOAT_ATTRIBUTE`, `startDockLayoutDrag`, `DragSource: "float"` | removed (floats) |
| `DragDropManager.setDragNode(event, node, image)` | `startDrag(event, subject, image)` with a `DragSubject` |
| `addTabWithDragAndDrop(event, json, onDrop, image)` | `startAddDrag(event, tab, onDrop, image)` |
| `IExternalDrag { json, onDrop }` | `{ tab: TabInitOf<T>, onDrop? }` |
| `IDropZoneOptions` with `Node` | `DropZoneOptions<T>` with `DragSubject<T>` |
| `DRAG_MARKER` (`text/plain`) | `DRAG_TYPE` (`application/x-dockable`) |
| `DragGroup.transfer(tabId, from, to, toNodeId, location, index)` | `DragGroup.transfer({ tab, from, to, target, location, index })`; `ITransfer.tab` is the new tab's id |
| `ITransferUserData` | `meta.transfer` |
| `PopoutClosePolicy`, `IPopoutOptions.closePolicy` | removed: always dock back |
| `PopoutCallback(layout: ModelLayout, …)` | `PopoutCallback(layout: WindowLayout, …)` |
| `SplitterController(engine, node, index)` | `SplitterController(engine, nodeId, index)` |
| `DockableLabel` float and group keys | removed; `Dock_Float_To_Layout` becomes `Dock_To_Layout` |

Rule 7 becomes: "The model is the source of truth. Every change is a command (`model.run` /
`model.dispatch`) through the middleware chain; nodes are immutable." Provenance becomes: "The model
is Dockable's own. The ported algorithms keep the FlexLayout header, and FlexLayout's tests and
`tests-playwright/` remain the behaviour reference." The popout close policy is `"dock"` only.

## 12. Implementation notes

Where the build refined this record (Epic #43, issues #45–#49):

- **Middleware narrowing.** `CommandContext` is a union discriminated by `command`: checking
  `ctx.command === "tab.close"` types `ctx.payload`. `CommandContextBase` holds the shared fields.
- **Bound bus.** `run`, `dispatch`, `can`, `use` and `subscribe` are bound, so
  `const { run } = model` works (`useDockable().run` is the model's).
- **`toLayoutJson(state)`** turns any kept state (an event's `before`, an undo step) back into a
  document for `layout.load`; the examples' undo keeps states and serialises only on restore.
- **`model.resolve`** takes a tabset or border of any registry (its fields are structural), so a
  generic adapter resolves `TabsetNode<T>` without a cast.
- **Drag groups across registries.** `DragGroup` takes and reports models as a `ModelHandle` (its
  identity and untyped side, which every `Model<T>` is): `transfer.to.model === b` type-checks.
  A transfer that the source refuses at run time (after its dry run passed) is undone.
- **Add drags from outside a layout.** `DragDropManager.startAddDrag(model, event, tab, onDrop,
  image)` finds the model's attached main layout (what `LayoutEngine.of` did);
  `DragDropManager.endDrag()` ends the page's drag. `DragState.subjectOf(model)` types the subject
  by that model's registry.
- **Foreign drags.** A drag that carries types, none of them `DRAG_TYPE`, is foreign; one that
  carries no types at all (synthetic events, as FlexLayout's cross-window test helpers send) is
  taken as the page's drag when there is one.
- **DOM ids and window names** carry a page-unique `idScope` (the React root passes `useId()`),
  since default ids (`tab-1`) repeat across models; `engine.tabButtonId(id)` /
  `engine.tabPanelId(id)` give them.
- **React.** `useModelState` reads a model-only context (it does not re-render with every layout
  change) and selects again when its selector changes; `TabOverflowTrigger<T>` types its hidden
  tabs; `data-popout-enabled` comes from `model.can`.
- **The command reference** (`site/docs/api/commands.mdx`) is generated from the registry by
  `packages/core/scripts/generate-command-docs.ts`; every schema field carries a description,
  which also reaches assistants through `model.commands()`.

