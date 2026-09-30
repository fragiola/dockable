import { COMMAND_DEFINITIONS, COMMANDS } from "../commands/catalogue";
import type { ReduceContext } from "../commands/define";
import type {
    BatchStep,
    CommandContext,
    CommandError,
    CommandEvent,
    CommandInfo,
    CommandListener,
    CommandName,
    CommandResult,
    Middleware,
    PayloadOf,
    ResultOf,
    RunOptions,
} from "../commands/types";
import type { JsonSchema } from "../schema/types";
import { validate } from "../schema/validator";
import {
    type BorderLike,
    type ResolvedBorder,
    type ResolvedLayout,
    type ResolvedTab,
    type ResolvedTabset,
    resolveBorder,
    resolveLayout,
    resolveTab,
    resolveTabset,
    type TabLike,
    type TabsetLike,
} from "./defaults";
import { Draft } from "./draft";
import { type CreateId, IdSource } from "./ids";
import type { LayoutJson } from "./json";
import {
    buildState,
    type DataSchemas,
    LayoutValidationError,
    stateToJson,
} from "./load";
import { type AnyNode, type AnyState, type NodeIndex, walk } from "./tree";
import {
    type AnyTypes,
    type BorderNode,
    type ComponentOf,
    type DockableTypes,
    type LayoutState,
    MAIN_LAYOUT,
    type Node,
    type ParentNode,
    type RowNode,
    type TabNode,
    type TabOf,
    type TabsetNode,
    type WindowLayout,
} from "./types";

/** Options of {@link createModel}. */
export interface ModelOptions<T extends DockableTypes = AnyTypes> {
    /** generates the id of a node created without one; default `` `${kind}-${n}` `` */
    createId?: CreateId | undefined;
    /** a JSON Schema per component: `tab.add`, `tab.update` and `layout.load` validate `data` */
    dataSchemas?: { [K in ComponentOf<T>]?: JsonSchema } | undefined;
    /** freeze every state object (default true) */
    freeze?: boolean | undefined;
}

/**
 * What the app adds to a dispatched command: never read from the untrusted input, so `meta` can
 * say who asked (`{ source: "assistant" }`) for middleware to decide on.
 */
export interface DispatchOptions {
    meta?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * A model of any registry, where only its identity and its untyped side matter (a drag group's
 * transfers join models of different registries): every `Model<T>` is one. Compare it (`===`)
 * with your own models; `dispatch` runs a command given as JSON.
 */
export interface ModelHandle {
    dispatch(input: unknown, options?: DispatchOptions): CommandResult<unknown>;
    commands(): readonly CommandInfo[];
    toJSON(): unknown;
}

/**
 * The layout model: an immutable state tree changed only by commands. Queries read the current
 * state; `run` (typed) and `dispatch` (untrusted JSON) apply commands through the middleware
 * chain; `subscribe` receives one event per commit. `run`, `dispatch`, `can`, `use` and `subscribe`
 * are bound: they can be passed around on their own.
 */
export interface Model<T extends DockableTypes = AnyTypes> {
    /** the current state (immutable; a new object after every change) */
    readonly state: LayoutState<T>;

    /** a node by id (O(1)) */
    get(id: string): Node<T> | undefined;
    /** a node's parent: a row, a tabset or a border */
    parentOf(id: string): ParentNode<T> | undefined;
    /** the layout a node is in: `MAIN_LAYOUT` or a window id */
    layoutOf(id: string): string | undefined;
    /** a layout's root row (default the main layout's) */
    root(layout?: string): RowNode<T> | undefined;
    /** a popout window's layout */
    windowLayout(id: string): WindowLayout<T> | undefined;
    /**
     * the tabs of a layout when given (the main layout's include its borders'), else every tab of
     * the model, the windows' included; in tree order
     */
    tabs(layout?: string): TabOf<T>[];
    /** every tabset of a layout (default the main layout), in tree order */
    tabsets(layout?: string): TabsetNode<T>[];
    /** the selected tab of a tabset or border */
    selectedTab(container: string): TabOf<T> | undefined;
    /** a layout's active tabset (default the main layout's) */
    activeTabset(layout?: string): TabsetNode<T> | undefined;
    /** a layout's maximized tabset (default the main layout's) */
    maximizedTabset(layout?: string): TabsetNode<T> | undefined;
    /** whether a tabset or row is hidden because another tabset of its layout is maximized */
    isHiddenByMaximize(id: string): boolean;
    /** a node's behaviour fields, resolved through the defaults */
    resolve(node: TabNode<string, unknown>): ResolvedTab;
    resolve<U extends DockableTypes>(node: TabsetNode<U>): ResolvedTabset;
    resolve<U extends DockableTypes>(node: BorderNode<U>): ResolvedBorder;
    /** the layout-wide settings, resolved */
    resolveLayout(): ResolvedLayout;
    /** the state as a layout document (a writable copy) */
    toJSON(): LayoutJson<T>;

    /** runs a command (typed); never throws on bad input */
    run<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /**
     * runs a command given as untrusted JSON `{ command, payload, transient? }`, validated;
     * `options.meta` (the app's, not the input's) reaches middleware and listeners
     */
    dispatch(input: unknown, options?: DispatchOptions): CommandResult<unknown>;
    /** what `run` would return, without committing or emitting anything */
    can<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /** every command with its description and JSON Schemas */
    commands(): readonly CommandInfo[];
    /** adds a middleware (the first added runs outermost); returns the function that removes it */
    use(middleware: Middleware<T>): () => void;
    /** adds a listener of commits; returns the function that removes it */
    subscribe(listener: CommandListener<T>): () => void;
}

const COMMAND_INFO: readonly CommandInfo[] = Object.freeze(
    COMMANDS.map((definition) =>
        Object.freeze({
            name: definition.name,
            description: definition.description,
            payloadSchema: definition.payloadSchema,
            resultSchema: definition.resultSchema,
            transient: definition.transient,
        }),
    ),
);

function error(
    code: CommandError["code"],
    message: string,
    path?: string,
    issues?: CommandError["issues"],
): { ok: false; error: CommandError } {
    const value: {
        code: CommandError["code"];
        message: string;
        path?: string;
        issues?: CommandError["issues"];
    } = { code, message };
    if (path !== undefined) {
        value.path = path;
    }
    if (issues !== undefined) {
        value.issues = issues;
    }
    return { ok: false, error: value };
}

function prefixed(
    result: CommandResult<unknown>,
    prefix: string,
): CommandResult<unknown> {
    if (result.ok || prefix === "") {
        return result;
    }
    const { error: failure } = result;
    return {
        ok: false,
        error: {
            ...failure,
            ...(failure.path !== undefined
                ? { path: `${prefix}${failure.path}` }
                : {}),
            ...(failure.issues
                ? {
                      issues: failure.issues.map((issue) => ({
                          path: `${prefix}${issue.path}`,
                          message: issue.message,
                      })),
                  }
                : {}),
        },
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What one top-level execution collects (the steps of a batch). */
interface Execution {
    steps: BatchStep[];
    /** an exception a reducer threw: rethrown once the chain unwound */
    thrown: { error: unknown } | undefined;
}

class LayoutModel<T extends DockableTypes> implements Model<T> {
    private current: AnyState;
    private index: NodeIndex;
    private readonly ids: IdSource;
    private readonly dataSchemas: DataSchemas | undefined;
    private readonly freeze: boolean;
    private readonly middleware: Middleware<T>[] = [];
    private readonly listeners = new Set<CommandListener<T>>();
    private inFlight = 0;
    private readonly queue: (() => void)[] = [];
    private readonly events: CommandEvent<T>[] = [];
    private delivering = false;

    constructor(
        state: AnyState,
        index: NodeIndex,
        ids: IdSource,
        options: ModelOptions<T>,
    ) {
        this.current = state;
        this.index = index;
        this.ids = ids;
        this.dataSchemas = options.dataSchemas as DataSchemas | undefined;
        this.freeze = options.freeze ?? true;
        // the bus can be passed around detached: `const { run } = model`
        this.run = this.run.bind(this);
        this.dispatch = this.dispatch.bind(this);
        this.can = this.can.bind(this);
        this.use = this.use.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    // ---------------------------------------------------------------------------------------------
    // queries
    // ---------------------------------------------------------------------------------------------

    get state(): LayoutState<T> {
        return this.current as unknown as LayoutState<T>;
    }

    get(id: string): Node<T> | undefined {
        return this.index.get(id) as Node<T> | undefined;
    }

    parentOf(id: string): ParentNode<T> | undefined {
        const parent = this.index.parent(id);
        return parent === undefined
            ? undefined
            : (this.index.get(parent) as ParentNode<T> | undefined);
    }

    layoutOf(id: string): string | undefined {
        const node = this.index.get(id);
        if (!node) {
            return undefined;
        }
        let top = id;
        for (
            let parent = this.index.parent(top);
            parent !== undefined;
            parent = this.index.parent(top)
        ) {
            top = parent;
        }
        if (this.index.get(top)?.type === "border") {
            return MAIN_LAYOUT;
        }
        return this.index.layoutOfRoot(top);
    }

    root(layout: string = MAIN_LAYOUT): RowNode<T> | undefined {
        if (layout === MAIN_LAYOUT) {
            return this.state.root;
        }
        return this.windowLayout(layout)?.root;
    }

    windowLayout(id: string): WindowLayout<T> | undefined {
        return this.state.windows.find(
            (windowLayout) => windowLayout.id === id,
        );
    }

    tabs(layout?: string): TabOf<T>[] {
        const tabs: TabOf<T>[] = [];
        const collect = (node: AnyNode) =>
            walk(node, (visited) => {
                if (visited.type === "tab") {
                    tabs.push(visited as unknown as TabOf<T>);
                }
            });
        const state = this.current;
        if (layout === undefined || layout === MAIN_LAYOUT) {
            collect(state.root);
            for (const border of state.borders) {
                collect(border);
            }
        }
        for (const windowLayout of state.windows) {
            if (layout === undefined || layout === windowLayout.id) {
                collect(windowLayout.root);
            }
        }
        return tabs;
    }

    tabsets(layout: string = MAIN_LAYOUT): TabsetNode<T>[] {
        const tabsets: TabsetNode<T>[] = [];
        const root = this.root(layout);
        if (root) {
            walk(root as unknown as AnyNode, (node) => {
                if (node.type === "tabset") {
                    tabsets.push(node as unknown as TabsetNode<T>);
                }
            });
        }
        return tabsets;
    }

    selectedTab(container: string): TabOf<T> | undefined {
        const node = this.index.get(container);
        if (node?.type !== "tabset" && node?.type !== "border") {
            return undefined;
        }
        return node.selected < 0
            ? undefined
            : (node.children[node.selected] as TabOf<T> | undefined);
    }

    activeTabset(layout: string = MAIN_LAYOUT): TabsetNode<T> | undefined {
        const id =
            layout === MAIN_LAYOUT
                ? this.state.active
                : this.windowLayout(layout)?.active;
        const node = id === undefined ? undefined : this.get(id);
        return node?.type === "tabset" ? node : undefined;
    }

    maximizedTabset(layout: string = MAIN_LAYOUT): TabsetNode<T> | undefined {
        const id =
            layout === MAIN_LAYOUT
                ? this.state.maximized
                : this.windowLayout(layout)?.maximized;
        const node = id === undefined ? undefined : this.get(id);
        return node?.type === "tabset" ? node : undefined;
    }

    isHiddenByMaximize(id: string): boolean {
        const node = this.index.get(id);
        if (node?.type !== "tabset" && node?.type !== "row") {
            return false;
        }
        const layout = this.layoutOf(id);
        const maximized =
            layout === undefined ? undefined : this.maximizedTabset(layout);
        if (!maximized || maximized.id === id) {
            return false;
        }
        for (
            let parent = this.index.parent(maximized.id);
            parent !== undefined;
            parent = this.index.parent(parent)
        ) {
            if (parent === id) {
                return false; // on the path to the maximized tabset
            }
        }
        return true;
    }

    resolve(node: TabNode<string, unknown>): ResolvedTab;
    resolve<U extends DockableTypes>(node: TabsetNode<U>): ResolvedTabset;
    resolve<U extends DockableTypes>(node: BorderNode<U>): ResolvedBorder;
    resolve(
        node:
            | ({ readonly type: "tab" } & TabLike)
            | ({ readonly type: "tabset" } & TabsetLike)
            | ({ readonly type: "border" } & BorderLike),
    ): ResolvedTab | ResolvedTabset | ResolvedBorder {
        const defaults = this.current.defaults;
        switch (node.type) {
            case "tab":
                return resolveTab(defaults, node);
            case "tabset":
                return resolveTabset(defaults, node);
            default:
                return resolveBorder(defaults, node);
        }
    }

    resolveLayout(): ResolvedLayout {
        return resolveLayout(this.current.defaults);
    }

    toJSON(): LayoutJson<T> {
        return stateToJson(this.current) as unknown as LayoutJson<T>;
    }

    // ---------------------------------------------------------------------------------------------
    // the bus
    // ---------------------------------------------------------------------------------------------

    commands(): readonly CommandInfo[] {
        return COMMAND_INFO;
    }

    use(middleware: Middleware<T>): () => void {
        this.middleware.push(middleware);
        return () => {
            const at = this.middleware.indexOf(middleware);
            if (at >= 0) {
                this.middleware.splice(at, 1);
            }
        };
    }

    subscribe(listener: CommandListener<T>): () => void {
        const wrapper: CommandListener<T> = (event) => listener(event);
        this.listeners.add(wrapper);
        return () => {
            this.listeners.delete(wrapper);
        };
    }

    run<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>> {
        return this.enqueueOrExecute(
            command,
            payload,
            options,
            "",
        ) as CommandResult<ResultOf<T, C>>;
    }

    can<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>> {
        return this.execute(
            command,
            payload,
            options ?? {},
            true,
            "",
        ) as CommandResult<ResultOf<T, C>>;
    }

    dispatch(
        input: unknown,
        options: DispatchOptions = {},
    ): CommandResult<unknown> {
        if (!isObject(input)) {
            return error(
                "invalid_payload",
                "must be an object { command, payload }",
                "",
            );
        }
        const { command, payload, transient } = input;
        if (typeof command !== "string") {
            return error("invalid_payload", "must be a string", "/command");
        }
        if (!COMMAND_DEFINITIONS.has(command)) {
            return error(
                "unknown_command",
                `unknown command "${command}"`,
                "/command",
            );
        }
        if (!isObject(payload)) {
            return error("invalid_payload", "must be an object", "/payload");
        }
        if (transient !== undefined && typeof transient !== "boolean") {
            return error("invalid_payload", "must be a boolean", "/transient");
        }
        for (const key of Object.keys(input)) {
            if (key !== "command" && key !== "payload" && key !== "transient") {
                return error("invalid_payload", "is not allowed", `/${key}`);
            }
        }
        return this.enqueueOrExecute(
            command,
            payload,
            {
                ...(transient === undefined ? {} : { transient }),
                ...(options.meta === undefined ? {} : { meta: options.meta }),
            },
            "/payload",
        );
    }

    private enqueueOrExecute(
        command: string,
        payload: unknown,
        options: RunOptions | undefined,
        prefix: string,
    ): CommandResult<unknown> {
        if (this.inFlight > 0) {
            // issued from a middleware: runs once the current command committed
            this.queue.push(() => {
                this.execute(command, payload, options ?? {}, false, prefix);
            });
            return error(
                "queued",
                `"${command}" was issued while another command was running; it runs after it`,
            );
        }
        try {
            return this.execute(command, payload, options ?? {}, false, prefix);
        } finally {
            // a throwing listener or reducer must not strand the commands a middleware queued
            this.drain();
        }
    }

    private drain() {
        while (this.inFlight === 0 && this.queue.length > 0) {
            this.queue.shift()?.();
        }
    }

    private execute(
        command: string,
        payload: unknown,
        options: RunOptions,
        dryRun: boolean,
        prefix: string,
    ): CommandResult<unknown> {
        const draft = new Draft(this.current, this.index, this.ids);
        const execution: Execution = { steps: [], thrown: undefined };
        if (!dryRun) {
            this.inFlight++;
        }
        let result: CommandResult<unknown>;
        let finalPayload = payload;
        try {
            result = this.runChain(
                command,
                payload,
                options,
                draft,
                dryRun,
                false,
                execution,
                (final) => {
                    finalPayload = final;
                },
            );
        } finally {
            if (!dryRun) {
                this.inFlight--;
            }
        }
        if (execution.thrown) {
            throw execution.thrown.error;
        }
        result = prefixed(result, prefix);
        if (!result.ok || dryRun) {
            return result;
        }
        const before = this.current as unknown as LayoutState<T>;
        const committed = draft.commit(this.freeze);
        this.current = committed.state;
        this.index = committed.index;
        const event: CommandEvent<T> = {
            command: command as CommandName,
            payload: finalPayload,
            result: result.value,
            before,
            after: this.current as unknown as LayoutState<T>,
            transient: options.transient === true,
            meta: options.meta,
            ...(command === "batch" ? { commands: execution.steps } : {}),
        };
        this.emit(event);
        return result;
    }

    /**
     * Looks up, validates and runs one command through the middleware chain on `draft`.
     * `onPayload` receives the payload the reducer ran with (a middleware may have rewritten it).
     */
    private runChain(
        command: string,
        payload: unknown,
        options: RunOptions,
        draft: Draft,
        dryRun: boolean,
        inBatch: boolean,
        execution: Execution,
        onPayload: (payload: unknown) => void,
    ): CommandResult<unknown> {
        const definition = COMMAND_DEFINITIONS.get(command);
        if (!definition) {
            return error("unknown_command", `unknown command "${command}"`);
        }
        const issues = validate(definition.payloadSchema, payload);
        const first = issues[0];
        if (first) {
            return error("invalid_payload", first.message, first.path, issues);
        }
        if (options.transient === true && !definition.transient) {
            return error(
                "invalid_payload",
                `"${command}" cannot run as a transient step`,
                "/transient",
            );
        }

        const validated = payload;
        // the command was looked up by name and the payload validated against its schema
        const context = {
            command: command as CommandName,
            payload: payload as PayloadOf<T, CommandName>,
            dryRun,
            transient: options.transient === true,
            inBatch,
            meta: options.meta,
            state: this.current as unknown as LayoutState<T>,
            get: (id) => draft.get(id) as Node<T> | undefined,
            parentOf: (id) => {
                const parent = draft.parentOf(id);
                return parent === undefined
                    ? undefined
                    : (draft.get(parent) as ParentNode<T> | undefined);
            },
        } as CommandContext<T>;

        const reduceContext: ReduceContext = {
            draft,
            validateData: (component, data, path) => {
                const schema = this.dataSchemas?.[component];
                if (!schema) {
                    return undefined;
                }
                const dataIssues = validate(schema, data, path);
                const firstIssue = dataIssues[0];
                return firstIssue
                    ? {
                          code: "invalid_payload",
                          message: firstIssue.message,
                          path: firstIssue.path,
                          issues: dataIssues,
                      }
                    : undefined;
            },
            loadLayout: (json, path) => {
                const built = buildState(
                    json,
                    this.ids,
                    {
                        dataSchemas: this.dataSchemas,
                        freeze: this.freeze,
                        reserved: (id) => draft.isUsed(id),
                    },
                    path,
                );
                if (built.ok) {
                    return built;
                }
                const firstIssue = built.issues[0];
                return {
                    ok: false,
                    error: {
                        code: "invalid_payload",
                        message: firstIssue?.message ?? "invalid layout",
                        ...(firstIssue ? { path: firstIssue.path } : {}),
                        issues: built.issues,
                    },
                };
            },
            runInBatch: (subCommand, subPayload, path) => {
                let ranWith: unknown = subPayload;
                const sub = this.runChain(
                    subCommand,
                    subPayload,
                    { ...options },
                    draft,
                    dryRun,
                    true,
                    execution,
                    (final) => {
                        ranWith = final;
                    },
                );
                if (!sub.ok) {
                    return sub.error.code === "unknown_command"
                        ? error(
                              "unknown_command",
                              sub.error.message,
                              `${path}/command`,
                          )
                        : prefixed(sub, `${path}/payload`);
                }
                execution.steps.push({
                    command: subCommand as CommandName,
                    payload: ranWith,
                    result: sub.value,
                });
                return sub;
            },
        };

        const core = (): CommandResult<unknown> => {
            if (context.payload !== validated) {
                const rewritten = validate(
                    definition.payloadSchema,
                    context.payload,
                );
                const problem = rewritten[0];
                if (problem) {
                    return error(
                        "invalid_payload",
                        `rewritten by a middleware: ${problem.message}`,
                        problem.path,
                        rewritten,
                    );
                }
            }
            onPayload(context.payload);
            try {
                return definition.reduce(
                    context.payload as never,
                    reduceContext,
                );
            } catch (thrown) {
                execution.thrown ??= { error: thrown };
                return error("refused", "the command failed");
            }
        };
        return this.chain(context, core);
    }

    private chain(
        context: CommandContext<T>,
        core: () => CommandResult<unknown>,
    ): CommandResult<unknown> {
        const list = [...this.middleware];
        const at = (i: number): CommandResult<unknown> => {
            const middleware = list[i];
            if (!middleware) {
                return core();
            }
            let called = false;
            let nextResult: CommandResult<unknown> = error(
                "vetoed",
                "a middleware returned no result",
            );
            const next = () => {
                if (!called) {
                    called = true;
                    nextResult = at(i + 1);
                }
                return nextResult;
            };
            let out: CommandResult<unknown> | undefined;
            try {
                out = middleware(context, next);
            } catch (thrown) {
                return error(
                    "middleware_error",
                    thrown instanceof Error ? thrown.message : String(thrown),
                );
            }
            if (out === undefined) {
                return nextResult;
            }
            return out;
        };
        return at(0);
    }

    private emit(event: CommandEvent<T>) {
        this.events.push(event);
        if (this.delivering) {
            return;
        }
        this.delivering = true;
        let failure: { error: unknown } | undefined;
        try {
            for (
                let next = this.events.shift();
                next !== undefined;
                next = this.events.shift()
            ) {
                for (const listener of [...this.listeners]) {
                    try {
                        listener(next);
                    } catch (thrown) {
                        failure ??= { error: thrown };
                    }
                }
            }
        } finally {
            this.delivering = false;
        }
        if (failure) {
            throw failure.error;
        }
    }
}

const EMPTY_LAYOUT: LayoutJson = {
    version: 1,
    root: { type: "row", children: [] },
};

/**
 * Creates a layout model from a JSON v1 document (an empty layout with one tabset without one).
 * The document is validated; an invalid one throws a {@link LayoutValidationError} listing every
 * problem with its JSON path.
 */
export function createModel<T extends DockableTypes = AnyTypes>(
    json?: LayoutJson<T>,
    options: ModelOptions<T> = {},
): Model<T> {
    const ids = new IdSource(options.createId);
    const built = buildState(json ?? EMPTY_LAYOUT, ids, {
        dataSchemas: options.dataSchemas as DataSchemas | undefined,
        freeze: options.freeze ?? true,
    });
    if (!built.ok) {
        throw new LayoutValidationError(built.issues);
    }
    return new LayoutModel<T>(built.state, built.index, ids, options);
}
