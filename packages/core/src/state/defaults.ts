import type { Orientation } from "../geometry/dock";
import type { BorderMode, LayoutDefaults } from "./types";

/** Every behaviour field of a tab, resolved. */
export interface ResolvedTab {
    readonly enableClose: boolean;
    readonly enableDrag: boolean;
    readonly enablePopout: boolean;
    readonly pinned: boolean;
    readonly minWidth: number;
    readonly minHeight: number;
    readonly maxWidth: number;
    readonly maxHeight: number;
}

/** Every behaviour field of a tabset, resolved. */
export interface ResolvedTabset {
    readonly enableDrop: boolean;
    readonly enableDrag: boolean;
    readonly enableDivide: boolean;
    readonly enableMaximize: boolean;
    readonly enableClose: boolean;
    readonly deleteWhenEmpty: boolean;
    readonly autoSelectTab: boolean;
    readonly minWidth: number;
    readonly minHeight: number;
    readonly maxWidth: number;
    readonly maxHeight: number;
}

/**
 * Every behaviour field of a border, resolved. `size`, `minSize` and `maxSize` are the effective
 * values of its panel: the selected tab's own border size replaces `size`, and its size limits
 * narrow `minSize` and `maxSize` (FlexLayout's `BorderNode.getSize` / `getMinSize` / `getMaxSize`).
 */
export interface ResolvedBorder {
    readonly size: number;
    readonly minSize: number;
    readonly maxSize: number;
    readonly mode: BorderMode;
    readonly autoHide: boolean;
    readonly enableDrop: boolean;
    readonly autoSelectTabWhenOpen: boolean;
    readonly autoSelectTabWhenClosed: boolean;
    readonly show: boolean;
}

/** Layout-wide settings, resolved. */
export interface ResolvedLayout {
    readonly rootOrientation: Orientation;
    readonly edgeDock: boolean;
    readonly edgeDockMargin: number;
    readonly edgeDockLength: number;
}

/** The smallest size limit (FlexLayout's `DefaultMin`). */
export const DEFAULT_MIN_SIZE = 1;
/** The largest size limit (FlexLayout's `DefaultMax`). */
export const DEFAULT_MAX_SIZE = 99999;

/** The built-in value of every behaviour field: the last step of the defaults rule. */
export const BUILT_IN = Object.freeze({
    tab: Object.freeze({
        enableClose: true,
        enableDrag: true,
        enablePopout: false,
        minWidth: DEFAULT_MIN_SIZE,
        minHeight: DEFAULT_MIN_SIZE,
        maxWidth: DEFAULT_MAX_SIZE,
        maxHeight: DEFAULT_MAX_SIZE,
    }),
    tabset: Object.freeze({
        enableDrop: true,
        enableDrag: true,
        enableDivide: true,
        enableMaximize: true,
        enableClose: true,
        deleteWhenEmpty: true,
        autoSelectTab: true,
        minWidth: DEFAULT_MIN_SIZE,
        minHeight: DEFAULT_MIN_SIZE,
        maxWidth: DEFAULT_MAX_SIZE,
        maxHeight: DEFAULT_MAX_SIZE,
    }),
    border: Object.freeze({
        size: 200,
        minSize: DEFAULT_MIN_SIZE,
        maxSize: DEFAULT_MAX_SIZE,
        mode: "docked" as BorderMode,
        autoHide: false,
        enableDrop: true,
        autoSelectTabWhenOpen: true,
        autoSelectTabWhenClosed: false,
    }),
    layout: Object.freeze({
        rootOrientation: "horizontal" as Orientation,
        edgeDock: true,
        edgeDockMargin: 10,
        edgeDockLength: 100,
    }),
});

type TabFields = Omit<ResolvedTab, "pinned">;
type BorderFields = Omit<ResolvedBorder, "show">;

/** The fields of a tab that take part in the defaults rule. */
export interface TabLike {
    readonly pinned?: boolean;
    readonly enableClose?: boolean;
    readonly enableDrag?: boolean;
    readonly enablePopout?: boolean;
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
}

/** The fields of a tabset that take part in the defaults rule. */
export type TabsetLike = {
    readonly [K in keyof ResolvedTabset]?: ResolvedTabset[K];
};

function pick<O, K extends keyof O>(
    own: Partial<O> | undefined,
    defaults: Partial<O> | undefined,
    builtIn: O,
    key: K,
): O[K] {
    return own?.[key] ?? defaults?.[key] ?? builtIn[key];
}

/** A tab's behaviour fields: `tab.x ?? defaults.tab.x ?? built-in`. */
export function resolveTab(
    defaults: LayoutDefaults,
    tab: TabLike,
): ResolvedTab {
    const d = defaults.tab;
    const own: Partial<TabFields> = tab;
    const b: TabFields = BUILT_IN.tab;
    return {
        enableClose: pick(own, d, b, "enableClose"),
        enableDrag: pick(own, d, b, "enableDrag"),
        enablePopout: pick(own, d, b, "enablePopout"),
        pinned: tab.pinned === true,
        minWidth: pick(own, d, b, "minWidth"),
        minHeight: pick(own, d, b, "minHeight"),
        maxWidth: pick(own, d, b, "maxWidth"),
        maxHeight: pick(own, d, b, "maxHeight"),
    };
}

/** A tabset's behaviour fields: `tabset.x ?? defaults.tabset.x ?? built-in`. */
export function resolveTabset(
    defaults: LayoutDefaults,
    tabset: TabsetLike,
): ResolvedTabset {
    const d = defaults.tabset;
    const b: ResolvedTabset = BUILT_IN.tabset;
    return {
        enableDrop: pick(tabset, d, b, "enableDrop"),
        enableDrag: pick(tabset, d, b, "enableDrag"),
        enableDivide: pick(tabset, d, b, "enableDivide"),
        enableMaximize: pick(tabset, d, b, "enableMaximize"),
        enableClose: pick(tabset, d, b, "enableClose"),
        deleteWhenEmpty: pick(tabset, d, b, "deleteWhenEmpty"),
        autoSelectTab: pick(tabset, d, b, "autoSelectTab"),
        minWidth: pick(tabset, d, b, "minWidth"),
        minHeight: pick(tabset, d, b, "minHeight"),
        maxWidth: pick(tabset, d, b, "maxWidth"),
        maxHeight: pick(tabset, d, b, "maxHeight"),
    };
}

/** Whether a border's strip runs vertically (a left or right border): its panel has a width. */
export function isVerticalBorder(location: string): boolean {
    return location === "left" || location === "right";
}

/** The fields of a border that take part in the defaults rule (and its selected tab's size). */
export type BorderLike = {
    readonly location: string;
    readonly selected: number;
    readonly children: readonly (TabLike & {
        readonly borderWidth?: number;
        readonly borderHeight?: number;
    })[];
    readonly show?: boolean;
} & { readonly [K in keyof BorderFields]?: BorderFields[K] };

/** A border's behaviour fields, with the selected tab's own size and limits applied. */
export function resolveBorder(
    defaults: LayoutDefaults,
    border: BorderLike,
): ResolvedBorder {
    const d: Partial<BorderFields> | undefined = defaults.border;
    const b: BorderFields = BUILT_IN.border;
    const vertical = isVerticalBorder(border.location);
    let size = pick(border, d, b, "size");
    let minSize = pick(border, d, b, "minSize");
    let maxSize = pick(border, d, b, "maxSize");
    const tab =
        border.selected >= 0 ? border.children[border.selected] : undefined;
    if (tab) {
        const own = vertical ? tab.borderWidth : tab.borderHeight;
        if (own !== undefined) {
            size = own;
        }
        const resolved = resolveTab(defaults, tab);
        minSize = Math.max(
            minSize,
            vertical ? resolved.minWidth : resolved.minHeight,
        );
        maxSize = Math.min(
            maxSize,
            vertical ? resolved.maxWidth : resolved.maxHeight,
        );
    }
    return {
        size,
        minSize,
        maxSize,
        mode: pick(border, d, b, "mode"),
        autoHide: pick(border, d, b, "autoHide"),
        enableDrop: pick(border, d, b, "enableDrop"),
        autoSelectTabWhenOpen: pick(border, d, b, "autoSelectTabWhenOpen"),
        autoSelectTabWhenClosed: pick(border, d, b, "autoSelectTabWhenClosed"),
        show: border.show !== false,
    };
}

/** The layout-wide settings: `defaults.layout.x ?? built-in`. */
export function resolveLayout(defaults: LayoutDefaults): ResolvedLayout {
    const d: Partial<ResolvedLayout> | undefined = defaults.layout;
    const b: ResolvedLayout = BUILT_IN.layout;
    return {
        rootOrientation: pick(undefined, d, b, "rootOrientation"),
        edgeDock: pick(undefined, d, b, "edgeDock"),
        edgeDockMargin: pick(undefined, d, b, "edgeDockMargin"),
        edgeDockLength: pick(undefined, d, b, "edgeDockLength"),
    };
}
