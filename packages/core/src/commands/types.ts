import type { DockLocation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";
import type { JsonSchema, ValidationIssue } from "../schema/types";
import type { DataField, LayoutJson, TabInit } from "../state/json";
import type {
    AnyTypes,
    BorderDataOf,
    BorderDefaults,
    ComponentOf,
    DockableTypes,
    LayoutSettings,
    LayoutState,
    Node,
    ParentNode,
    RowDataOf,
    TabDataOf,
    TabDefaults,
    TabOwnFields,
    TabsetDataOf,
    TabsetDefaults,
} from "../state/types";

/** Where a tab or tabset goes. */
export interface Placement {
    /** a tabset, a row, a border, or a layout id (meaning that layout's root row) */
    to: string;
    /**
     * `"center"` (default) goes into the target; an edge of a tabset splits it; an edge of a row
     * (a layout's root row: the layout's edge) docks beside its children
     */
    location?: DockLocation;
    /** for a center drop: the insertion index among the target's tabs (or children); -1 appends */
    index?: number;
    /** whether the tab is selected in its new place; default: the target's auto-select rule */
    select?: boolean;
}

/** Each field may be `null`: the node's own value is removed so the defaults apply. */
export type Nullable<P> = { [K in keyof P]?: P[K] | null };

/** A new tab of the registry `T` placed somewhere: the payload of `tab.add`. */
export type TabAddPayload<T extends DockableTypes> = {
    [K in ComponentOf<T>]: TabInit<K, TabDataOf<T, K>> & Placement;
}[ComponentOf<T>];

export type TabMovePayload = { tabId: string } & Placement;

export type TabsetMovePayload = { tabsetId: string } & Omit<
    Placement,
    "select"
>;

/** A shallow patch of data `D`: some of its top-level keys (any keys when `D` is not typed). */
type PatchOf<D> = unknown extends D
    ? Record<string, unknown>
    : D extends object
      ? Partial<D>
      : never;

/** A shallow patch of a tab's data in the registry `T`: some top-level keys of one component's data. */
export type DataPatchOf<T extends DockableTypes> = {
    [K in ComponentOf<T>]: PatchOf<TabDataOf<T, K>>;
}[ComponentOf<T>];

/** The payload of `tab.set-data`: a shallow patch of the tab's data. */
export type TabSetDataPayload<T extends DockableTypes> = {
    tabId: string;
    data: DataPatchOf<T>;
};

/** The payload of `tab.set-component`: a component and its whole data. */
export type TabSetComponentPayload<T extends DockableTypes> = {
    [K in ComponentOf<T>]: { tabId: string; component: K } & DataField<
        TabDataOf<T, K>
    >;
}[ComponentOf<T>];

export type TabConfigurePayload = {
    tabId: string;
    /** the tab's new name (a tab always has one: it cannot be removed) */
    label?: string;
} & Nullable<Required<TabDefaults & Omit<TabOwnFields, "pinned">>>;

export type TabsetConfigurePayload<T extends DockableTypes> = {
    tabsetId: string;
} & Nullable<Required<TabsetDefaults> & { data: TabsetDataOf<T> }>;

export type BorderConfigurePayload<T extends DockableTypes> = {
    borderId: string;
    /** open (select its first tab when none is selected) or close the border's panel */
    open?: boolean;
} & Nullable<
    Required<BorderDefaults> & { show: boolean; data: BorderDataOf<T> }
>;

export type RowConfigurePayload<T extends DockableTypes> = {
    rowId: string;
    data?: RowDataOf<T> | null;
};

/** A patch of the layout defaults: fields are merged, `null` removes one (or a whole kind). */
export type LayoutDefaultsPatch = {
    tab?: Nullable<Required<TabDefaults>> | null;
    tabset?: Nullable<Required<TabsetDefaults>> | null;
    border?: Nullable<Required<BorderDefaults>> | null;
    layout?: Nullable<Required<LayoutSettings>> | null;
};

/** One command of a batch. */
export type BatchEntry<T extends DockableTypes = AnyTypes> = {
    [C in CommandName]: { command: C; payload: PayloadOf<T, C> };
}[CommandName];

/** Every built-in command: its payload and its result, typed by the registry `T`. */
export interface CommandMap<T extends DockableTypes = AnyTypes> {
    "tab.add": { payload: TabAddPayload<T>; result: { tabId: string } };
    "tab.select": { payload: { tabId: string }; result: { tabId: string } };
    "tab.close": { payload: { tabId: string }; result: { tabId: string } };
    "tab.move": { payload: TabMovePayload; result: { tabId: string } };
    "tab.set-data": {
        payload: TabSetDataPayload<T>;
        result: { tabId: string };
    };
    "tab.set-component": {
        payload: TabSetComponentPayload<T>;
        result: { tabId: string };
    };
    "tab.pin": {
        payload: { tabId: string; value: boolean };
        result: { tabId: string };
    };
    "tab.popout": {
        payload: { tabId: string; rect?: Rect };
        result: { windowId: string };
    };
    "tab.configure": {
        payload: TabConfigurePayload;
        result: { tabId: string };
    };
    "tabset.activate": {
        payload: { tabsetId: string };
        result: { tabsetId: string };
    };
    "tabset.maximize": {
        payload: { tabsetId: string; value: boolean };
        result: { tabsetId: string };
    };
    "tabset.close": {
        payload: { tabsetId: string };
        result: { closedTabIds: string[] };
    };
    "tabset.move": {
        payload: TabsetMovePayload;
        result: { tabsetId: string };
    };
    "tabset.popout": {
        payload: { tabsetId: string; rect?: Rect };
        result: { windowId: string };
    };
    "tabset.configure": {
        payload: TabsetConfigurePayload<T>;
        result: { tabsetId: string };
    };
    "row.resize": {
        payload: { rowId: string; weights: number[] };
        result: { rowId: string };
    };
    "row.configure": {
        payload: RowConfigurePayload<T>;
        result: { rowId: string };
    };
    "border.resize": {
        payload: { borderId: string; size: number };
        result: { borderId: string; size: number };
    };
    "border.configure": {
        payload: BorderConfigurePayload<T>;
        result: { borderId: string };
    };
    "window.close": {
        payload: { windowId: string };
        result: { tabIds: string[] };
    };
    "window.configure": {
        payload: { windowId: string; rect: Rect };
        result: { windowId: string };
    };
    "layout.configure": {
        payload: { defaults: LayoutDefaultsPatch };
        result: Record<never, never>;
    };
    "layout.load": {
        payload: { layout: LayoutJson<T> };
        result: { addedNodeIds: string[]; removedNodeIds: string[] };
    };
    batch: {
        payload: { commands: BatchEntry<T>[] };
        result: { results: unknown[] };
    };
}

/** The name of a built-in command. */
export type CommandName = keyof CommandMap;

/** The payload of command `C`. */
export type PayloadOf<
    T extends DockableTypes,
    C extends CommandName,
> = CommandMap<T>[C]["payload"];

/** The result of command `C`. */
export type ResultOf<
    T extends DockableTypes,
    C extends CommandName,
> = CommandMap<T>[C]["result"];

/** Why a command did not apply. */
export type CommandErrorCode =
    /** no command has this name */
    | "unknown_command"
    /** the payload does not match the command's schema (or a data schema) */
    | "invalid_payload"
    /** a node or window the payload names does not exist (or is not of the kind needed) */
    | "not_found"
    /** a rule of the layout forbids it (a permission flag, a pinned tab, …) */
    | "refused"
    /** a middleware vetoed it */
    | "vetoed"
    /** it was issued from a middleware and will run after the current command */
    | "queued"
    /** a middleware threw */
    | "middleware_error";

export interface CommandError {
    readonly code: CommandErrorCode;
    readonly message: string;
    /** a JSON pointer into the payload (or the dispatched input) */
    readonly path?: string;
    /** every schema problem, for `invalid_payload` */
    readonly issues?: readonly ValidationIssue[];
}

/** What a command returns: its value, or why it did not apply. It never throws on bad input. */
export type CommandResult<R> =
    | { readonly ok: true; readonly value: R }
    | { readonly ok: false; readonly error: CommandError };

/** Options of `run`. */
export interface RunOptions {
    /** a step of a continuous gesture (a splitter drag): the event is marked so undo can merge it */
    transient?: boolean;
    /** free-form information for middleware and listeners (e.g. a drag group transfer) */
    meta?: Readonly<Record<string, unknown>>;
}

/** What a middleware's `ctx.get` reads: each key's payload and result, as on `model.get`. */
export interface CommandContextGetMap<T extends DockableTypes = AnyTypes> {
    /** a node by its id */
    "node-by": { payload: { id: string }; result: Node<T> | undefined };
    /** a node's parent: a row, a tabset or a border */
    "node-parent-by": {
        payload: { nodeId: string };
        result: ParentNode<T> | undefined;
    };
}

/** What a middleware's `ctx.get` reads. */
export type CommandContextGetKey = keyof CommandContextGetMap;

/** What a middleware sees of any command. */
export interface CommandContextBase<T extends DockableTypes = AnyTypes> {
    /** `model.can`/`model.check`: nothing will be committed; do not cause side effects */
    readonly dryRun: boolean;
    readonly transient: boolean;
    /** true for a command running inside a batch (the batch itself also passes the chain) */
    readonly inBatch: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** the committed state the command applies to */
    readonly state: LayoutState<T>;
    /**
     * reads a node (`"node-by"`) or its parent (`"node-parent-by"`) as the command sees it:
     * inside a batch, after the batch's earlier commands
     */
    get<K extends CommandContextGetKey>(
        key: K,
        payload: CommandContextGetMap<T>[K]["payload"],
    ): CommandContextGetMap<T>[K]["result"];
}

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "tab.close") ctx.payload.tabId`).
 */
export type CommandContext<T extends DockableTypes = AnyTypes> = {
    [C in CommandName]: CommandContextBase<T> & {
        readonly command: C;
        /** the validated payload; assign a new object to rewrite it (it is validated again) */
        payload: PayloadOf<T, C>;
    };
}[CommandName];

/**
 * Runs around every command, engine-issued or not: veto (return an error without calling
 * `next`), rewrite (assign `ctx.payload`, then call `next`) or observe (call `next` and look at its
 * result). Returning `undefined` passes on `next`'s result when it was called.
 */
export type Middleware<T extends DockableTypes = AnyTypes> = (
    ctx: CommandContext<T>,
    next: () => CommandResult<unknown>,
) => CommandResult<unknown> | undefined;

/** One command of a batch, as its event reports it. */
export interface BatchStep {
    readonly command: CommandName;
    readonly payload: unknown;
    readonly result: unknown;
}

/** What a listener receives: one event per commit. */
export interface CommandEvent<T extends DockableTypes = AnyTypes> {
    readonly command: CommandName;
    readonly payload: unknown;
    /** the command's value */
    readonly result: unknown;
    readonly before: LayoutState<T>;
    readonly after: LayoutState<T>;
    readonly transient: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** for a batch: the commands it ran, flattened */
    readonly commands?: readonly BatchStep[];
}

export type CommandListener<T extends DockableTypes = AnyTypes> = (
    event: CommandEvent<T>,
) => void;

/** A command as `model.get("commands")` describes it: ready to become an AI tool definition. */
export interface CommandInfo {
    readonly name: CommandName;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    /** whether it may run as a step of a continuous gesture */
    readonly transient: boolean;
}

/** The vetoed result a middleware returns to stop a command. */
export function veto(message = "vetoed by a middleware"): {
    readonly ok: false;
    readonly error: CommandError;
} {
    return { ok: false, error: { code: "vetoed", message } };
}
