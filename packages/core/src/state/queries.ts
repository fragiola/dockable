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
import { stateToJson } from "./load";
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
 * (`model.get("tabs")`), required otherwise (`model.get("parent", { node })`).
 */
export type QueryArgs<P> = NoPayload extends P ? [payload?: P] : [payload: P];

/**
 * What `model.get(key, payload)` reads: each key's payload and result. `layout` defaults to the
 * main layout (`MAIN_LAYOUT`).
 */
export interface ModelGetMap<T extends DockableTypes = AnyTypes> {
    /** a node by id (O(1)) */
    node: { payload: { node: string }; result: Node<T> | undefined };
    /** a node's parent: a row, a tabset or a border */
    parent: { payload: { node: string }; result: ParentNode<T> | undefined };
    /** the layout a node is in: `MAIN_LAYOUT` or a window id */
    "layout-id": { payload: { node: string }; result: string | undefined };
    /** a layout's root row */
    "root-row": {
        payload: { layout?: string | undefined };
        result: RowNode<T> | undefined;
    };
    /** a popout window's layout */
    window: {
        payload: { window: string };
        result: WindowLayout<T> | undefined;
    };
    /**
     * the tabs of a layout when given (the main layout's include its borders'), else every tab of
     * the model, the windows' included; in tree order
     */
    tabs: { payload: { layout?: string | undefined }; result: TabOf<T>[] };
    /** every tabset of a layout (default the main layout), in tree order */
    tabsets: {
        payload: { layout?: string | undefined };
        result: TabsetNode<T>[];
    };
    /** the selected tab of a tabset or border */
    "selected-tab": {
        payload: { container: string };
        result: TabOf<T> | undefined;
    };
    /** a layout's active tabset */
    "active-tabset": {
        payload: { layout?: string | undefined };
        result: TabsetNode<T> | undefined;
    };
    /** a layout's maximized tabset */
    "maximized-tabset": {
        payload: { layout?: string | undefined };
        result: TabsetNode<T> | undefined;
    };
    /** a tab's effective settings: its own value, else the layout's default */
    "tab-settings": {
        payload: { tab: string };
        result: ResolvedTab | undefined;
    };
    /** a tabset's effective settings: its own value, else the layout's default */
    "tabset-settings": {
        payload: { tabset: string };
        result: ResolvedTabset | undefined;
    };
    /** a border's effective settings: its own value, else the layout's default */
    "border-settings": {
        payload: { border: string };
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

/** What `model.is(key, payload)` asks: each question's payload. */
export interface ModelIsMap {
    /** a tab is its tabset's (or border's) selected tab */
    selected: { tab: string };
    /** a tab is pinned */
    pinned: { tab: string };
    /** a tabset is its layout's active tabset */
    active: { tabset: string };
    /** a tabset is its layout's maximized tabset */
    maximized: { tabset: string };
    /** a tabset or a row is hidden because another tabset of its layout is maximized */
    "hidden-by-maximize": { node: string };
    /** a tabset or a border has no tabs */
    empty: { container: string };
    /** a border has a selected tab, so its panel is open */
    open: { border: string };
    /** a border's panel opens over the layout (`mode: "overlay"`) instead of beside it */
    overlay: { border: string };
    /** a row is its layout's root row */
    root: { row: string };
    /** a node lives in a popout window's layout */
    "in-window": { node: string };
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

function layoutOf(source: QuerySource, id: string): string | undefined {
    const { index } = source;
    if (!index.has(id)) {
        return undefined;
    }
    let top = id;
    for (
        let parent = index.parent(top);
        parent !== undefined;
        parent = index.parent(top)
    ) {
        top = parent;
    }
    if (index.get(top)?.type === "border") {
        return MAIN_LAYOUT;
    }
    return index.layoutOfRoot(top);
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

function activeTabset(
    source: QuerySource,
    layout: string = MAIN_LAYOUT,
): TabsetNode | undefined {
    return tabsetById(
        source,
        layout === MAIN_LAYOUT
            ? source.state.active
            : windowLayout(source, layout)?.active,
    );
}

function maximizedTabset(
    source: QuerySource,
    layout: string = MAIN_LAYOUT,
): TabsetNode | undefined {
    return tabsetById(
        source,
        layout === MAIN_LAYOUT
            ? source.state.maximized
            : windowLayout(source, layout)?.maximized,
    );
}

function selectedTab(
    source: QuerySource,
    container: string,
): TabOf<AnyTypes> | undefined {
    const found = node(source, container);
    if (found?.type !== "tabset" && found?.type !== "border") {
        return undefined;
    }
    return found.selected < 0 ? undefined : found.children[found.selected];
}

const GETTERS: Getters = {
    node: (source, { node: id }) => node(source, id),
    parent: (source, { node: id }) => {
        const parent = source.index.parent(id);
        return parent === undefined
            ? undefined
            : (node(source, parent) as ParentNode | undefined);
    },
    "layout-id": (source, { node: id }) => layoutOf(source, id),
    "root-row": (source, { layout }) => rootRow(source, layout),
    window: (source, payload) => windowLayout(source, payload.window),
    tabs: (source, { layout }) => {
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
    },
    tabsets: (source, { layout }) => {
        const tabsets: TabsetNode[] = [];
        const root = rootRow(source, layout);
        if (root) {
            walk(root as unknown as AnyNode, (visited) => {
                if (visited.type === "tabset") {
                    tabsets.push(visited as unknown as TabsetNode);
                }
            });
        }
        return tabsets;
    },
    "selected-tab": (source, { container }) => selectedTab(source, container),
    "active-tabset": (source, { layout }) => activeTabset(source, layout),
    "maximized-tabset": (source, { layout }) => maximizedTabset(source, layout),
    "tab-settings": (source, { tab }) => {
        const found = node(source, tab);
        return found?.type === "tab"
            ? resolveTab(source.state.defaults, found)
            : undefined;
    },
    "tabset-settings": (source, { tabset }) => {
        const found = node(source, tabset);
        return found?.type === "tabset"
            ? resolveTabset(source.state.defaults, found)
            : undefined;
    },
    "border-settings": (source, { border }) => {
        const found = node(source, border);
        return found?.type === "border"
            ? resolveBorder(source.state.defaults, found)
            : undefined;
    },
    "layout-settings": (source) => resolveLayout(source.state.defaults),
    "layout-json": (source) =>
        stateToJson(source.state) as unknown as LayoutJson,
    commands: () => COMMAND_INFO,
};

function hiddenByMaximize(source: QuerySource, id: string): boolean {
    const found = node(source, id);
    if (found?.type !== "tabset" && found?.type !== "row") {
        return false;
    }
    const layout = layoutOf(source, id);
    const maximized =
        layout === undefined ? undefined : maximizedTabset(source, layout);
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
    selected: (source, { tab }) => {
        const parent = source.index.parent(tab);
        return (
            node(source, tab)?.type === "tab" &&
            parent !== undefined &&
            selectedTab(source, parent)?.id === tab
        );
    },
    pinned: (source, { tab }) => {
        const found = node(source, tab);
        return found?.type === "tab" && found.pinned === true;
    },
    active: (source, { tabset }) => {
        const layout = layoutOf(source, tabset);
        return (
            layout !== undefined && activeTabset(source, layout)?.id === tabset
        );
    },
    maximized: (source, { tabset }) => {
        const layout = layoutOf(source, tabset);
        return (
            layout !== undefined &&
            maximizedTabset(source, layout)?.id === tabset
        );
    },
    "hidden-by-maximize": (source, { node: id }) =>
        hiddenByMaximize(source, id),
    empty: (source, { container }) => {
        const found = node(source, container);
        return (
            (found?.type === "tabset" || found?.type === "border") &&
            found.children.length === 0
        );
    },
    open: (source, { border }) => {
        const found = node(source, border);
        return found?.type === "border" && found.selected >= 0;
    },
    overlay: (source, { border }) => {
        const found = node(source, border);
        return (
            found?.type === "border" &&
            resolveBorder(source.state.defaults, found).mode === "overlay"
        );
    },
    root: (source, { row }) =>
        node(source, row)?.type === "row" &&
        source.index.layoutOfRoot(row) !== undefined,
    "in-window": (source, { node: id }) => {
        const layout = layoutOf(source, id);
        return layout !== undefined && layout !== MAIN_LAYOUT;
    },
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
