import type { Orientation } from "../geometry/dock";
import type {
    BorderDefaults,
    BorderMode,
    LayoutDefaults,
    LayoutSettings,
    TabDefaults,
    TabOwnFields,
    TabsetDefaults,
} from "./types";

/** Every behaviour field of a tab, resolved. */
export interface ResolvedTab extends Readonly<Required<TabDefaults>> {
    readonly pinned: boolean;
}

/** Every behaviour field of a tabset, resolved. */
export interface ResolvedTabset extends Readonly<Required<TabsetDefaults>> {}

/**
 * Every behaviour field of a border, resolved. `size`, `minSize` and `maxSize` are the effective
 * values of its panel: the selected tab's own border size replaces `size`, and its size limits
 * narrow `minSize` and `maxSize` (FlexLayout's `BorderNode.getSize` / `getMinSize` / `getMaxSize`).
 */
export interface ResolvedBorder extends Readonly<Required<BorderDefaults>> {
    readonly show: boolean;
}

/** Layout-wide settings, resolved. */
export interface ResolvedLayout extends Readonly<Required<LayoutSettings>> {}

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

/** The fields of a tab that take part in the defaults rule (and its own border size). */
export type TabLike = Readonly<TabDefaults & TabOwnFields>;

/** The fields of a tabset that take part in the defaults rule. */
export type TabsetLike = Readonly<TabsetDefaults>;

/** `own.x ?? defaults.x ?? builtIn.x`, for every field of `builtIn`. */
function resolve<R extends object>(
    own: Partial<R> | undefined,
    defaults: Partial<R> | undefined,
    builtIn: R,
): R {
    const resolved = { ...builtIn };
    for (const key in builtIn) {
        resolved[key] = own?.[key] ?? defaults?.[key] ?? builtIn[key];
    }
    return resolved;
}

/** A tab's behaviour fields: `tab.x ?? defaults.tab.x ?? built-in`. */
export function resolveTab(
    defaults: LayoutDefaults,
    tab: TabLike,
): ResolvedTab {
    const { minWidth, minHeight, maxWidth, maxHeight, ...flags } = resolve<
        Required<TabDefaults>
    >(tab, defaults.tab, BUILT_IN.tab);
    return {
        ...flags,
        pinned: tab.pinned === true,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
    };
}

/** A tabset's behaviour fields: `tabset.x ?? defaults.tabset.x ?? built-in`. */
export function resolveTabset(
    defaults: LayoutDefaults,
    tabset: TabsetLike,
): ResolvedTabset {
    return resolve<Required<TabsetDefaults>>(
        tabset,
        defaults.tabset,
        BUILT_IN.tabset,
    );
}

/** Whether a border's strip runs vertically (a left or right border): its panel has a width. */
export function isVerticalBorder(location: string): boolean {
    return location === "left" || location === "right";
}

/** The fields of a border that take part in the defaults rule (and its selected tab's size). */
export type BorderLike = {
    readonly location: string;
    readonly selected: number;
    readonly children: readonly TabLike[];
    readonly show?: boolean;
} & Readonly<BorderDefaults>;

/** A border's behaviour fields, with the selected tab's own size and limits applied. */
export function resolveBorder(
    defaults: LayoutDefaults,
    border: BorderLike,
): ResolvedBorder {
    const resolved = resolve<Required<BorderDefaults>>(
        border,
        defaults.border,
        BUILT_IN.border,
    );
    const tab =
        border.selected >= 0 ? border.children[border.selected] : undefined;
    if (tab) {
        const vertical = isVerticalBorder(border.location);
        resolved.size =
            (vertical ? tab.borderWidth : tab.borderHeight) ?? resolved.size;
        const limits = resolveTab(defaults, tab);
        resolved.minSize = Math.max(
            resolved.minSize,
            vertical ? limits.minWidth : limits.minHeight,
        );
        resolved.maxSize = Math.min(
            resolved.maxSize,
            vertical ? limits.maxWidth : limits.maxHeight,
        );
    }
    return { ...resolved, show: border.show !== false };
}

/**
 * Whether a border shows: its `show` is on and, when it `autoHide`s, it has tabs or a drag
 * reveals it.
 */
export function borderShown(
    defaults: LayoutDefaults,
    border: BorderLike,
    revealed: boolean,
): boolean {
    const { show, autoHide } = resolveBorder(defaults, border);
    return show && (!autoHide || border.children.length > 0 || revealed);
}

/** The layout-wide settings: `defaults.layout.x ?? built-in`. */
export function resolveLayout(defaults: LayoutDefaults): ResolvedLayout {
    return resolve<Required<LayoutSettings>>(
        undefined,
        defaults.layout,
        BUILT_IN.layout,
    );
}
