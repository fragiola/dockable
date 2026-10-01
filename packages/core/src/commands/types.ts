import type { DockLocation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";
import type { JsonSchema, ValidationIssue } from "../schema/types";
import type { DataField, LayoutJson, TabInit } from "../state/json";
import type {
    AnyTypes,
    BorderDataOf,
    BorderMode,
    ComponentOf,
    DockableTypes,
    LayoutState,
    Node,
    ParentNode,
    RowDataOf,
    TabDataOf,
    TabsetDataOf,
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

export type TabMovePayload = { tab: string } & Placement;

export type TabsetMovePayload = { tabset: string } & Omit<Placement, "select">;

/** The payload of `tab.update`: a component and its whole data. */
export type TabUpdatePayload<T extends DockableTypes> = {
    [K in ComponentOf<T>]: { tab: string; component: K } & DataField<
        TabDataOf<T, K>
    >;
}[ComponentOf<T>];

export type TabConfigurePayload = { tab: string } & Nullable<{
    enableClose: boolean;
    enableDrag: boolean;
    enablePopout: boolean;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    borderWidth: number;
    borderHeight: number;
}>;

export type TabsetConfigurePayload<T extends DockableTypes> = {
    tabset: string;
} & Nullable<{
    enableDrop: boolean;
    enableDrag: boolean;
    enableDivide: boolean;
    enableMaximize: boolean;
    enableClose: boolean;
    deleteWhenEmpty: boolean;
    autoSelectTab: boolean;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    data: TabsetDataOf<T>;
}>;

export type BorderConfigurePayload<T extends DockableTypes> = {
    border: string;
    /** open (select its first tab when none is selected) or close the border's panel */
    open?: boolean;
} & Nullable<{
    mode: BorderMode;
    show: boolean;
    autoHide: boolean;
    enableDrop: boolean;
    autoSelectTabWhenOpen: boolean;
    autoSelectTabWhenClosed: boolean;
    size: number;
    minSize: number;
    maxSize: number;
    data: BorderDataOf<T>;
}>;

export type RowConfigurePayload<T extends DockableTypes> = {
    row: string;
    data?: RowDataOf<T> | null;
};

/** A patch of the layout defaults: fields are merged, `null` removes one (or a whole kind). */
export type LayoutDefaultsPatch = {
    tab?: Nullable<{
        enableClose: boolean;
        enableDrag: boolean;
        enablePopout: boolean;
        minWidth: number;
        minHeight: number;
        maxWidth: number;
        maxHeight: number;
    }> | null;
    tabset?: Nullable<{
        enableDrop: boolean;
        enableDrag: boolean;
        enableDivide: boolean;
        enableMaximize: boolean;
        enableClose: boolean;
        deleteWhenEmpty: boolean;
        autoSelectTab: boolean;
        minWidth: number;
        minHeight: number;
        maxWidth: number;
        maxHeight: number;
    }> | null;
    border?: Nullable<{
        size: number;
        minSize: number;
        maxSize: number;
        mode: BorderMode;
        autoHide: boolean;
        enableDrop: boolean;
        autoSelectTabWhenOpen: boolean;
        autoSelectTabWhenClosed: boolean;
    }> | null;
    layout?: Nullable<{
        rootOrientation: "horizontal" | "vertical";
        edgeDock: boolean;
        edgeDockMargin: number;
        edgeDockLength: number;
    }> | null;
};

/** One command of a batch. */
export type BatchEntry<T extends DockableTypes = AnyTypes> = {
    [C in CommandName]: { command: C; payload: PayloadOf<T, C> };
}[CommandName];

/** Every built-in command: its payload and its result, typed by the registry `T`. */
export interface CommandMap<T extends DockableTypes = AnyTypes> {
    "tab.add": { payload: TabAddPayload<T>; result: { tab: string } };
    "tab.select": { payload: { tab: string }; result: { tab: string } };
    "tab.close": { payload: { tab: string }; result: { tab: string } };
    "tab.move": { payload: TabMovePayload; result: { tab: string } };
    "tab.update": { payload: TabUpdatePayload<T>; result: { tab: string } };
    "tab.pin": {
        payload: { tab: string; value: boolean };
        result: { tab: string };
    };
    "tab.popout": {
        payload: { tab: string; rect?: Rect };
        result: { window: string };
    };
    "tab.configure": {
        payload: TabConfigurePayload;
        result: { tab: string };
    };
    "tabset.activate": {
        payload: { tabset: string };
        result: { tabset: string };
    };
    "tabset.maximize": {
        payload: { tabset: string; value: boolean };
        result: { tabset: string };
    };
    "tabset.close": {
        payload: { tabset: string };
        result: { closed: string[] };
    };
    "tabset.move": {
        payload: TabsetMovePayload;
        result: { tabset: string };
    };
    "tabset.popout": {
        payload: { tabset: string; rect?: Rect };
        result: { window: string };
    };
    "tabset.configure": {
        payload: TabsetConfigurePayload<T>;
        result: { tabset: string };
    };
    "row.resize": {
        payload: { row: string; weights: number[] };
        result: { row: string };
    };
    "row.configure": {
        payload: RowConfigurePayload<T>;
        result: { row: string };
    };
    "border.resize": {
        payload: { border: string; size: number };
        result: { border: string; size: number };
    };
    "border.configure": {
        payload: BorderConfigurePayload<T>;
        result: { border: string };
    };
    "window.close": {
        payload: { window: string };
        result: { tabs: string[] };
    };
    "window.configure": {
        payload: { window: string; rect: Rect };
        result: { window: string };
    };
    "layout.configure": {
        payload: { defaults: LayoutDefaultsPatch };
        result: Record<never, never>;
    };
    "layout.load": {
        payload: { layout: LayoutJson<T> };
        result: { added: string[]; removed: string[] };
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

/** What a middleware's `ctx.get` reads. */
export type CommandContextGetKey = "node" | "parent";

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
     * reads a node (`"node"`) or its parent (`"parent"`) as the command sees it: inside a batch,
     * after the batch's earlier commands
     */
    get<K extends CommandContextGetKey>(
        key: K,
        payload: { node: string },
    ): K extends "parent" ? ParentNode<T> | undefined : Node<T> | undefined;
}

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "tab.close") ctx.payload.tab`).
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
