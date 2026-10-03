import type { BorderLocation, Orientation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";

/**
 * What an app declares about its layout's data: each tab component's data type (`tabs`), and
 * optionally the data type of tabsets, borders and rows. `tab.data` narrows on `tab.component`.
 *
 * ```ts
 * type Types = { tabs: { editor: { path: string }; chart: { series: string[] } } };
 * const model = createModel<Types>(json);
 * ```
 */
export interface DockableTypes {
    /** each tab component's data type, keyed by the component name */
    tabs: object;
    /** the data type of tabsets */
    tabset?: unknown;
    /** the data type of borders */
    border?: unknown;
    /** the data type of rows */
    row?: unknown;
}

/** The registry used when an app declares none: any component, `unknown` data. */
export interface AnyTypes {
    tabs: Record<string, unknown>;
}

/** The component names of a registry. */
export type ComponentOf<T extends DockableTypes> = Extract<
    keyof T["tabs"],
    string
>;

/** The data type of component `K` of a registry. */
export type TabDataOf<
    T extends DockableTypes,
    K extends string,
> = K extends keyof T["tabs"] ? T["tabs"][K] : never;

/** The data type of the tabsets of a registry (`unknown` when it declares none). */
export type TabsetDataOf<T extends DockableTypes> = T extends {
    tabset: infer D;
}
    ? D
    : unknown;

/** The data type of the borders of a registry. */
export type BorderDataOf<T extends DockableTypes> = T extends {
    border: infer D;
}
    ? D
    : unknown;

/** The data type of the rows of a registry. */
export type RowDataOf<T extends DockableTypes> = T extends { row: infer D }
    ? D
    : unknown;

/** Size limits of a tab or tabset, in px. */
export interface SizeLimits {
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
}

/** How a border's panel opens: beside the layout (`docked`) or over it (`overlay`). */
export type BorderMode = "docked" | "overlay";

/** The fields of a tab no layout default applies to. */
export interface TabOwnFields {
    /** pinned tabs sit at the start of their strip, cannot close and cannot leave their tabset */
    pinned?: boolean;
    /** the tab's own panel width in a start or end border (the border's `size` otherwise) */
    borderWidth?: number;
    /** the tab's own panel height in a top or bottom border */
    borderHeight?: number;
}

/** A tab: component `K` with data `D`. */
export interface TabNode<K extends string = string, D = unknown>
    extends Readonly<TabDefaults>,
        Readonly<TabOwnFields> {
    readonly type: "tab";
    readonly id: string;
    /** what the tab shows: the registry key that types `data` */
    readonly component: K;
    /** the tab's name, as the app wrote it: never translated, never rendered by the packages */
    readonly label: string;
    /** the app's data for the tab */
    readonly data: D;
}

/** A tab of the registry `T`: a union discriminated by `component`, so `data` narrows. */
export type TabOf<T extends DockableTypes> = {
    [K in ComponentOf<T>]: TabNode<K, TabDataOf<T, K>>;
}[ComponentOf<T>];

/** A tabset: tabs sharing a strip and a content area. */
export interface TabsetNode<T extends DockableTypes = AnyTypes>
    extends Readonly<TabsetDefaults> {
    readonly type: "tabset";
    readonly id: string;
    /** relative size in its row */
    readonly weight: number;
    /** index of the selected tab in `children`; -1 when none */
    readonly selected: number;
    readonly children: readonly TabOf<T>[];
    readonly data?: TabsetDataOf<T>;
}

/** A row (or column): tabsets and rows laid out along its orientation. */
export interface RowNode<T extends DockableTypes = AnyTypes> {
    readonly type: "row";
    readonly id: string;
    /** relative size in its parent row */
    readonly weight: number;
    readonly children: readonly (RowNode<T> | TabsetNode<T>)[];
    readonly data?: RowDataOf<T>;
}

/** A border: a strip of tabs on one side of the main layout, whose panel opens beside or over it. */
export interface BorderNode<T extends DockableTypes = AnyTypes>
    extends Readonly<BorderDefaults> {
    readonly type: "border";
    readonly id: string;
    readonly location: BorderLocation;
    /** index of the selected tab; -1 when the border's panel is closed */
    readonly selected: number;
    readonly children: readonly TabOf<T>[];
    readonly data?: BorderDataOf<T>;
    /** false hides the border entirely */
    readonly show?: boolean;
}

/** A popout window's layout: a native window with its own root row. */
export interface WindowLayout<T extends DockableTypes = AnyTypes> {
    readonly id: string;
    /** the window's screen rect */
    readonly rect: Rect;
    readonly root: RowNode<T>;
    /** the window's active tabset */
    readonly active?: string;
    /** the window's maximized tabset */
    readonly maximized?: string;
}

/** Any node of the tree. */
export type Node<T extends DockableTypes = AnyTypes> =
    | RowNode<T>
    | TabsetNode<T>
    | TabOf<T>
    | BorderNode<T>;

/** The kinds of node: `"row" | "tabset" | "tab" | "border"`. */
export type NodeKind = Node["type"];

/** What holds tabs: a tabset or a border. */
export type TabContainer<T extends DockableTypes = AnyTypes> =
    | TabsetNode<T>
    | BorderNode<T>;

/** What a node can be the child of. */
export type ParentNode<T extends DockableTypes = AnyTypes> =
    | RowNode<T>
    | TabsetNode<T>
    | BorderNode<T>;

/** Layout-wide settings, set in `defaults.layout`. */
export interface LayoutSettings {
    /** the orientation of every layout's root row; nested rows alternate */
    rootOrientation?: Orientation;
    /** whether a drag offers the layout's edges as drop targets */
    edgeDock?: boolean;
    /** the depth in px of each edge band */
    edgeDockMargin?: number;
    /** the length in px of each edge band, centred on its edge (at most the edge) */
    edgeDockLength?: number;
}

/** The defaults of a tab's behaviour fields. */
export interface TabDefaults {
    closable?: boolean;
    draggable?: boolean;
    poppable?: boolean;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
}

/** The defaults of a tabset's behaviour fields. */
export interface TabsetDefaults {
    droppable?: boolean;
    draggable?: boolean;
    splittable?: boolean;
    maximizable?: boolean;
    closable?: boolean;
    deleteWhenEmpty?: boolean;
    autoSelectTab?: boolean;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
}

/** The defaults of a border's behaviour fields. */
export interface BorderDefaults {
    size?: number;
    minSize?: number;
    maxSize?: number;
    mode?: BorderMode;
    /** hide the strip while the border has no tabs (a drag near its edge reveals it) */
    autoHide?: boolean;
    droppable?: boolean;
    autoSelectTabWhenOpen?: boolean;
    autoSelectTabWhenClosed?: boolean;
}

/** The layout's defaults: `node.x ?? defaults[kind].x ?? built-in`. */
export interface LayoutDefaults {
    tab?: TabDefaults;
    tabset?: TabsetDefaults;
    border?: BorderDefaults;
    layout?: LayoutSettings;
}

/** The whole layout: the main layout, its borders and the popout windows. */
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

/** The id of the main layout. A window layout's id is its window's id. */
export const MAIN_LAYOUT = "main";
