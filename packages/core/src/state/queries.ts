import { COMMANDS } from "../commands/catalogue";
import type { CommandInfo } from "../commands/types";
import {
    type ResolvedBorder,
    type ResolvedLayout,
    type ResolvedTab,
    type ResolvedTabset,
    resolveBorder,
    resolveLayout,
    resolveTab,
    resolveTabset,
} from "./defaults";
import { deepFreeze } from "./draft";
import type { LayoutJson } from "./json";
import { toLayoutJson } from "./load";
import { type AnyNode, type AnyState, type NodeIndex, walk } from "./tree";
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    type Node,
    type ParentNode,
    type RowNode,
    type TabOf,
    type TabsetNode,
    type WindowLayout,
} from "./types";

/** The payload of a query that takes none. */
export type NoPayload = Record<never, never>;

/**
 * The payload argument of a query: optional when the payload has no required field
 * (`model.get("all-tabs")`), required otherwise (`model.get("node-parent-by", { nodeId })`).
 */
export type QueryArgs<P> = NoPayload extends P ? [payload?: P] : [payload: P];

/**
 * Where `selected-tab-by` reads: exactly one of a tabset, a border or a layout (the selected tab of
 * the layout's active tabset).
 */
export type SelectedTabByPayload =
    | { tabsetId: string; borderId?: never; layoutId?: never }
    | { borderId: string; tabsetId?: never; layoutId?: never }
    | { layoutId: string; tabsetId?: never; borderId?: never };

/**
 * What `model.get(key, payload)` reads: each key's payload and result. A key names what it returns;
 * the payload says whose. A key that takes an id ends in `-by`, and the payload's field completes it:
 * `id` when it is the id of what the key returns (`node-by { id }`), `<entity>Id` otherwise
 * (`node-parent-by { nodeId }`, `selected-tab-by { tabsetId }`). A key whose only input is an
 * optional `layoutId` has no `-by`, and reads the main layout (`MAIN_LAYOUT`) without one
 * (`tabsets`, `active-tabset`).
 */
export interface ModelGetMap<T extends DockableTypes = AnyTypes> {
    /** a node by its id (O(1)) */
    "node-by": {
        payload: { id: string };
        result: Node<T> | undefined;
    };
    /** a node's parent: a row, a tabset or a border */
    "node-parent-by": {
        payload: { nodeId: string };
        result: ParentNode<T> | undefined;
    };
    /** the id of the layout a node is in: `MAIN_LAYOUT` or a window id */
    "layout-id-by": {
        payload: { nodeId: string };
        result: string | undefined;
    };
    /** a layout's root row */
    "root-row": {
        payload: { layoutId?: string | undefined };
        result: RowNode<T> | undefined;
    };
    /** a popout window's layout by its id */
    "window-by": {
        payload: { id: string };
        result: WindowLayout<T> | undefined;
    };
    /** every tab of the model: the main layout's, its borders' and the windows', in tree order */
    "all-tabs": { payload: NoPayload; result: TabOf<T>[] };
    /** the tabs of a layout (the main layout's include its borders'), in tree order */
    tabs: {
        payload: { layoutId?: string | undefined };
        result: TabOf<T>[];
    };
    /** the tabsets of a layout, in tree order */
    tabsets: {
        payload: { layoutId?: string | undefined };
        result: TabsetNode<T>[];
    };
    /**
     * the selected tab of a tabset (the one it shows), of a border (the one its open panel shows;
     * none while it is closed) or of a layout (its active tabset's)
     */
    "selected-tab-by": {
        payload: SelectedTabByPayload;
        result: TabOf<T> | undefined;
    };
    /** a layout's active tabset */
    "active-tabset": {
        payload: { layoutId?: string | undefined };
        result: TabsetNode<T> | undefined;
    };
    /** a layout's maximized tabset */
    "maximized-tabset": {
        payload: { layoutId?: string | undefined };
        result: TabsetNode<T> | undefined;
    };
    /** a tab's effective settings: its own value, else the layout's default */
    "tab-settings-by": {
        payload: { tabId: string };
        result: ResolvedTab | undefined;
    };
    /** a tabset's effective settings: its own value, else the layout's default */
    "tabset-settings-by": {
        payload: { tabsetId: string };
        result: ResolvedTabset | undefined;
    };
    /** a border's effective settings: its own value, else the layout's default */
    "border-settings-by": {
        payload: { borderId: string };
        result: ResolvedBorder | undefined;
    };
    /** the layout-wide settings: the layout's own value, else the built-in default */
    "layout-settings": { payload: NoPayload; result: ResolvedLayout };
    /** the layout as a JSON v1 document (a writable copy; what `layout.load` accepts) */
    "layout-json": { payload: NoPayload; result: LayoutJson<T> };
    /** every command with its description and JSON Schemas */
    commands: { payload: NoPayload; result: readonly CommandInfo[] };
}

/** A key of `model.get`. */
export type ModelGetKey = keyof ModelGetMap;

/** The payload of `model.get(K)`. */
export type ModelGetPayload<
    T extends DockableTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["payload"];

/** The result of `model.get(K)`. */
export type ModelGetResult<
    T extends DockableTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["result"];

/**
 * What `model.is(key, payload)` asks: each question's payload. A key reads as the question after
 * "is" (`tabset-active`: is the tabset active?) and takes the id of the entity it names first.
 */
export interface ModelIsMap {
    /** a tab is the selected tab of its tabset or border: the one it shows */
    "tab-selected": { tabId: string };
    /** a tab is pinned */
    "tab-pinned": { tabId: string };
    /** a tabset is its layout's active tabset */
    "tabset-active": { tabsetId: string };
    /** a tabset is its layout's maximized tabset */
    "tabset-maximized": { tabsetId: string };
    /** a tabset has no tabs */
    "tabset-empty": { tabsetId: string };
    /** a tabset or a row is hidden because another tabset of its layout is maximized */
    "node-hidden-by-maximize": { nodeId: string };
    /** a node lives in a popout window's layout */
    "node-in-window": { nodeId: string };
    /** a border has no tabs */
    "border-empty": { borderId: string };
    /** a border has a selected tab, so its panel is open */
    "border-open": { borderId: string };
    /** a border's panel opens over the layout (`mode: "overlay"`) instead of beside it */
    "border-overlay": { borderId: string };
    /** a row is its layout's root row */
    "row-root": { rowId: string };
}

/** A key of `model.is`. */
export type ModelIsKey = keyof ModelIsMap;

/** The payload of `model.is(K)`. */
export type ModelIsPayload<K extends ModelIsKey> = ModelIsMap[K];

/** What a query reads: the committed state and its index. */
export interface QuerySource {
    readonly state: AnyState;
    readonly index: NodeIndex;
}

const COMMAND_INFO: readonly CommandInfo[] = Object.freeze(
    COMMANDS.map((definition) =>
        Object.freeze({
            name: definition.name,
            description: definition.description,
            // the validator's own schemas: frozen, so no caller can change what validation means
            payloadSchema: deepFreeze(definition.payloadSchema),
            resultSchema: deepFreeze(definition.resultSchema),
            transient: definition.transient,
        }),
    ),
);

// The queries below read the registry-erased state: `Model<T>` types their results at its boundary.

type AnyGetMap = ModelGetMap<AnyTypes>;
type Getters = {
    [K in ModelGetKey]: (
        source: QuerySource,
        payload: AnyGetMap[K]["payload"],
    ) => AnyGetMap[K]["result"];
};
type Questions = {
    [K in ModelIsKey]: (source: QuerySource, payload: ModelIsMap[K]) => boolean;
};

function node(source: QuerySource, id: string): Node | undefined {
    return source.index.get(id) as Node | undefined;
}

function windowLayout(
    source: QuerySource,
    id: string,
): WindowLayout | undefined {
    return (source.state.windows as readonly WindowLayout[]).find(
        (layout) => layout.id === id,
    );
}

function rootRow(
    source: QuerySource,
    layout: string = MAIN_LAYOUT,
): RowNode | undefined {
    if (layout === MAIN_LAYOUT) {
        return source.state.root as unknown as RowNode;
    }
    return windowLayout(source, layout)?.root;
}

function tabsetById(
    source: QuerySource,
    id: string | undefined,
): TabsetNode | undefined {
    const found = id === undefined ? undefined : node(source, id);
    return found?.type === "tabset" ? found : undefined;
}

/** A layout's active or maximized tabset. */
function layoutTabset(
    source: QuerySource,
    layout: string | undefined,
    which: "active" | "maximized",
): TabsetNode | undefined {
    const record =
        layout === undefined || layout === MAIN_LAYOUT
            ? source.state
            : windowLayout(source, layout);
    return tabsetById(source, record?.[which]);
}

/** The selected tab of a tabset or a border (of `type` only, when given). */
function selectedTab(
    source: QuerySource,
    container: string,
    type?: "tabset" | "border",
): TabOf<AnyTypes> | undefined {
    const found = node(source, container);
    if (found?.type !== "tabset" && found?.type !== "border") {
        return undefined;
    }
    if (type !== undefined && found.type !== type) {
        return undefined;
    }
    return found.selected < 0 ? undefined : found.children[found.selected];
}

/** The tabs of a layout when given (the main layout's include its borders'), else every tab. */
function tabsOf(source: QuerySource, layout?: string): TabOf<AnyTypes>[] {
    const tabs: TabOf<AnyTypes>[] = [];
    const collect = (root: AnyNode) =>
        walk(root, (visited) => {
            if (visited.type === "tab") {
                tabs.push(visited as unknown as TabOf<AnyTypes>);
            }
        });
    const { state } = source;
    if (layout === undefined || layout === MAIN_LAYOUT) {
        collect(state.root);
        for (const border of state.borders) {
            collect(border);
        }
    }
    for (const popout of state.windows) {
        if (layout === undefined || layout === popout.id) {
            collect(popout.root);
        }
    }
    return tabs;
}

/** Whether `id` is a tabset (or a border) with no tabs. */
function isEmpty(
    source: QuerySource,
    id: string,
    type: "tabset" | "border",
): boolean {
    const found = node(source, id);
    return found?.type === type && found.children.length === 0;
}

/** The selected tab `selected-tab-by` reads: exactly one of its fields, else none. */
function selectedTabBy(
    source: QuerySource,
    payload: SelectedTabByPayload,
): TabOf<AnyTypes> | undefined {
    const { tabsetId, borderId, layoutId } = payload;
    const given = [tabsetId, borderId, layoutId].filter(
        (id) => id !== undefined,
    );
    if (given.length !== 1) {
        return undefined;
    }
    if (tabsetId !== undefined) {
        return selectedTab(source, tabsetId, "tabset");
    }
    if (borderId !== undefined) {
        return selectedTab(source, borderId, "border");
    }
    const active = layoutTabset(source, layoutId, "active");
    return active ? selectedTab(source, active.id, "tabset") : undefined;
}

const GETTERS: Getters = {
    "node-by": (source, { id }) => node(source, id),
    "node-parent-by": (source, { nodeId }) => {
        const parent = source.index.parent(nodeId);
        return parent === undefined
            ? undefined
            : (node(source, parent) as ParentNode | undefined);
    },
    "layout-id-by": (source, { nodeId }) => source.index.layoutOf(nodeId),
    "root-row": (source, { layoutId }) => rootRow(source, layoutId),
    "window-by": (source, { id }) => windowLayout(source, id),
    "all-tabs": (source) => tabsOf(source),
    tabs: (source, { layoutId }) => tabsOf(source, layoutId ?? MAIN_LAYOUT),
    tabsets: (source, { layoutId }) => {
        const tabsets: TabsetNode[] = [];
        const root = rootRow(source, layoutId);
        if (root) {
            walk(root as unknown as AnyNode, (visited) => {
                if (visited.type === "tabset") {
                    tabsets.push(visited as unknown as TabsetNode);
                }
            });
        }
        return tabsets;
    },
    "selected-tab-by": selectedTabBy,
    "active-tabset": (source, { layoutId }) =>
        layoutTabset(source, layoutId, "active"),
    "maximized-tabset": (source, { layoutId }) =>
        layoutTabset(source, layoutId, "maximized"),
    "tab-settings-by": (source, { tabId }) => {
        const found = node(source, tabId);
        return found?.type === "tab"
            ? resolveTab(source.state.defaults, found)
            : undefined;
    },
    "tabset-settings-by": (source, { tabsetId }) => {
        const found = node(source, tabsetId);
        return found?.type === "tabset"
            ? resolveTabset(source.state.defaults, found)
            : undefined;
    },
    "border-settings-by": (source, { borderId }) => {
        const found = node(source, borderId);
        return found?.type === "border"
            ? resolveBorder(source.state.defaults, found)
            : undefined;
    },
    "layout-settings": (source) => resolveLayout(source.state.defaults),
    "layout-json": (source) => toLayoutJson(source.state),
    commands: () => COMMAND_INFO,
};

function hiddenByMaximize(source: QuerySource, id: string): boolean {
    const found = node(source, id);
    if (found?.type !== "tabset" && found?.type !== "row") {
        return false;
    }
    const layout = source.index.layoutOf(id);
    const maximized =
        layout === undefined
            ? undefined
            : layoutTabset(source, layout, "maximized");
    if (!maximized || maximized.id === id) {
        return false;
    }
    for (
        let parent = source.index.parent(maximized.id);
        parent !== undefined;
        parent = source.index.parent(parent)
    ) {
        if (parent === id) {
            return false; // on the path to the maximized tabset
        }
    }
    return true;
}

const QUESTIONS: Questions = {
    "tab-selected": (source, { tabId }) => {
        const parent = source.index.parent(tabId);
        return (
            node(source, tabId)?.type === "tab" &&
            parent !== undefined &&
            selectedTab(source, parent)?.id === tabId
        );
    },
    "tab-pinned": (source, { tabId }) => {
        const found = node(source, tabId);
        return found?.type === "tab" && found.pinned === true;
    },
    "tabset-active": (source, { tabsetId }) => {
        const layout = source.index.layoutOf(tabsetId);
        return (
            layout !== undefined &&
            layoutTabset(source, layout, "active")?.id === tabsetId
        );
    },
    "tabset-maximized": (source, { tabsetId }) => {
        const layout = source.index.layoutOf(tabsetId);
        return (
            layout !== undefined &&
            layoutTabset(source, layout, "maximized")?.id === tabsetId
        );
    },
    "tabset-empty": (source, { tabsetId }) =>
        isEmpty(source, tabsetId, "tabset"),
    "node-hidden-by-maximize": (source, { nodeId }) =>
        hiddenByMaximize(source, nodeId),
    "node-in-window": (source, { nodeId }) => {
        const layout = source.index.layoutOf(nodeId);
        return layout !== undefined && layout !== MAIN_LAYOUT;
    },
    "border-empty": (source, { borderId }) =>
        isEmpty(source, borderId, "border"),
    "border-open": (source, { borderId }) => {
        const found = node(source, borderId);
        return found?.type === "border" && found.selected >= 0;
    },
    "border-overlay": (source, { borderId }) => {
        const found = node(source, borderId);
        return (
            found?.type === "border" &&
            resolveBorder(source.state.defaults, found).mode === "overlay"
        );
    },
    "row-root": (source, { rowId }) =>
        node(source, rowId)?.type === "row" &&
        source.index.layoutOfRoot(rowId) !== undefined,
};

/** Every key of `model.get`, for documentation coverage. */
export const MODEL_GET_KEYS: readonly ModelGetKey[] = Object.freeze(
    Object.keys(GETTERS) as ModelGetKey[],
);

/** Every key of `model.is`, for documentation coverage. */
export const MODEL_IS_KEYS: readonly ModelIsKey[] = Object.freeze(
    Object.keys(QUESTIONS) as ModelIsKey[],
);

/** Reads `key` from `source`; an unknown key reads `undefined`. */
export function queryGet(
    source: QuerySource,
    key: string,
    payload: unknown,
): unknown {
    const getter = Object.hasOwn(GETTERS, key)
        ? (GETTERS[key as ModelGetKey] as (
              source: QuerySource,
              payload: unknown,
          ) => unknown)
        : undefined;
    return getter?.(source, payload ?? {});
}

/** Answers `key` on `source`; an unknown key answers `false`. */
export function queryIs(
    source: QuerySource,
    key: string,
    payload: unknown,
): boolean {
    const question = Object.hasOwn(QUESTIONS, key)
        ? (QUESTIONS[key as ModelIsKey] as (
              source: QuerySource,
              payload: unknown,
          ) => boolean)
        : undefined;
    return question?.(source, payload ?? {}) ?? false;
}
