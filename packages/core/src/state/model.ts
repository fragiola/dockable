import { COMMAND_DEFINITIONS } from "../commands/catalogue";
import { fail, invalid, type ReduceContext } from "../commands/define";
import type {
    BatchStep,
    CommandContext,
    CommandContextGetKey,
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
import { Draft } from "./draft";
import { type CreateId, IdSource } from "./ids";
import type { LayoutJson } from "./json";
import { buildState, type DataSchemas, LayoutValidationError } from "./load";
import {
    type ModelGetKey,
    type ModelGetPayload,
    type ModelGetResult,
    type ModelIsKey,
    type ModelIsPayload,
    type QueryArgs,
    queryGet,
    queryIs,
} from "./queries";
import type { AnyState, NodeIndex } from "./tree";
import type {
    AnyTypes,
    ComponentOf,
    DockableTypes,
    LayoutState,
} from "./types";

/** Options of {@link createModel}. */
export interface ModelOptions<T extends DockableTypes = AnyTypes> {
    /** generates the id of a node created without one; default `` `${kind}-${n}` `` */
    createId?: CreateId | undefined;
    /** a JSON Schema per component: `tab.add`, `tab.set-data`, `tab.set-component` and `layout.load` validate `data` */
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
    get(key: "commands"): readonly CommandInfo[];
    get(key: "layout-json"): unknown;
}

/**
 * The layout model: the layout's data and its rules. An immutable state tree that only commands
 * change, usable in plain Node (no DOM). Every member is one verb:
 *
 * - `run` changes the layout (a command, through the middleware chain); `dispatch` is `run` for
 *   untrusted JSON;
 * - `can` answers whether `run` would succeed; `check` returns what it would return;
 * - `get` reads (`model.get("selected-tab-by", { tabsetId })`); `is` asks a yes/no
 *   question (`model.is("tabset-maximized", { tabsetId })`);
 * - `use` adds a middleware around every command; `subscribe` listens to every commit.
 *
 * Every method is bound: it can be passed around on its own.
 */
export interface Model<T extends DockableTypes = AnyTypes> {
    /** the current state (immutable; a new object after every change) */
    readonly state: LayoutState<T>;

    /** changes the layout: runs a command (typed) through the middleware chain; never throws on bad input */
    run<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /**
     * `run` for a command given as untrusted JSON `{ command, payload, transient? }`, validated;
     * `options.meta` (the app's, not the input's) reaches middleware and listeners
     */
    dispatch(input: unknown, options?: DispatchOptions): CommandResult<unknown>;
    /** whether `run` would succeed now (nothing is committed or emitted) */
    can<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): boolean;
    /** what `run` would return (its value, or why it is refused), without committing or emitting */
    check<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /** reads from the current state: a node, its parent, the selected tab, settings, the JSON, … */
    get<K extends ModelGetKey>(
        key: K,
        ...payload: QueryArgs<ModelGetPayload<T, K>>
    ): ModelGetResult<T, K>;
    /** asks a yes/no question about the current state */
    is<K extends ModelIsKey>(key: K, payload: ModelIsPayload<K>): boolean;
    /** adds a middleware around every command (the first added runs outermost); returns its remover */
    use(middleware: Middleware<T>): () => void;
    /** listens to every committed command (one event per commit); returns its remover */
    subscribe(listener: CommandListener<T>): () => void;
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

/** Where a command's errors point: into its payload, at its name and at its transient flag. */
interface ErrorPaths {
    readonly payload: string;
    readonly command?: string;
    readonly transient: string;
}

/** One top-level execution: the draft it runs on, and what it collects (the steps of a batch). */
interface Execution {
    readonly draft: Draft;
    readonly dryRun: boolean;
    readonly options: RunOptions;
    readonly steps: BatchStep[];
    /** an exception a reducer threw: rethrown once the chain unwound */
    thrown: { error: unknown } | undefined;
}

class LayoutModel<T extends DockableTypes> implements Model<T> {
    /** the committed state and its index: what queries read and commands start from */
    private readonly committed: { state: AnyState; index: NodeIndex };
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
        this.committed = { state, index };
        this.ids = ids;
        this.dataSchemas = options.dataSchemas as DataSchemas | undefined;
        this.freeze = options.freeze ?? true;
        // the bus can be passed around detached: `const { run } = model`
        this.run = this.run.bind(this);
        this.dispatch = this.dispatch.bind(this);
        this.can = this.can.bind(this);
        this.check = this.check.bind(this);
        this.get = this.get.bind(this);
        this.is = this.is.bind(this);
        this.use = this.use.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    // ---------------------------------------------------------------------------------------------
    // queries
    // ---------------------------------------------------------------------------------------------

    get state(): LayoutState<T> {
        return this.committed.state as unknown as LayoutState<T>;
    }

    get<K extends ModelGetKey>(
        key: K,
        ...payload: QueryArgs<ModelGetPayload<T, K>>
    ): ModelGetResult<T, K> {
        return queryGet(this.committed, key, payload[0]) as ModelGetResult<
            T,
            K
        >;
    }

    is<K extends ModelIsKey>(key: K, payload: ModelIsPayload<K>): boolean {
        return queryIs(this.committed, key, payload);
    }

    // ---------------------------------------------------------------------------------------------
    // the bus
    // ---------------------------------------------------------------------------------------------

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
    ): boolean {
        return this.check(command, payload, options).ok;
    }

    check<C extends CommandName>(
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
            return fail(
                "invalid_payload",
                "must be an object { command, payload }",
                "",
            );
        }
        const { command, payload, transient } = input;
        if (typeof command !== "string") {
            return fail("invalid_payload", "must be a string", "/command");
        }
        if (!COMMAND_DEFINITIONS.has(command)) {
            return fail(
                "unknown_command",
                `unknown command "${command}"`,
                "/command",
            );
        }
        if (!isObject(payload)) {
            return fail("invalid_payload", "must be an object", "/payload");
        }
        if (transient !== undefined && typeof transient !== "boolean") {
            return fail("invalid_payload", "must be a boolean", "/transient");
        }
        for (const key of Object.keys(input)) {
            if (key !== "command" && key !== "payload" && key !== "transient") {
                return fail("invalid_payload", "is not allowed", `/${key}`);
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
            return fail(
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
        // a dry run commits nothing, not even the ids it generated
        const ids = dryRun ? this.ids.clone() : this.ids;
        const draft = new Draft(
            this.committed.state,
            this.committed.index,
            ids,
        );
        const execution: Execution = {
            draft,
            dryRun,
            options,
            steps: [],
            thrown: undefined,
        };
        if (!dryRun) {
            this.inFlight++;
        }
        let ran: { result: CommandResult<unknown>; payload: unknown };
        try {
            ran = this.runChain(
                execution,
                command,
                payload,
                { payload: prefix, transient: "/transient" },
                false,
            );
        } finally {
            if (!dryRun) {
                this.inFlight--;
            }
        }
        if (execution.thrown) {
            throw execution.thrown.error;
        }
        const { result } = ran;
        if (!result.ok || dryRun) {
            return result;
        }
        const before = this.committed.state as unknown as LayoutState<T>;
        const committed = draft.commit(this.freeze);
        this.committed.state = committed.state;
        this.committed.index = committed.index;
        const event: CommandEvent<T> = {
            command: command as CommandName,
            payload: ran.payload,
            result: result.value,
            before,
            after: this.committed.state as unknown as LayoutState<T>,
            transient: options.transient === true,
            meta: options.meta,
            ...(command === "batch" ? { commands: execution.steps } : {}),
        };
        this.emit(event);
        return result;
    }

    /**
     * Looks up, validates and runs one command through the middleware chain on the execution's
     * draft. Returns its result, its errors placed at `at`, and the payload the reducer ran with (a
     * middleware may have rewritten it).
     */
    private runChain(
        execution: Execution,
        command: string,
        payload: unknown,
        at: ErrorPaths,
        inBatch: boolean,
    ): { result: CommandResult<unknown>; payload: unknown } {
        const { draft, dryRun, options } = execution;
        const definition = COMMAND_DEFINITIONS.get(command);
        if (!definition) {
            return {
                result: fail(
                    "unknown_command",
                    `unknown command "${command}"`,
                    at.command,
                ),
                payload,
            };
        }
        const failed = invalid(
            validate(definition.payloadSchema, payload, at.payload),
        );
        if (failed) {
            return { result: failed, payload };
        }
        if (options.transient === true && !definition.transient) {
            return {
                result: fail(
                    "invalid_payload",
                    `"${command}" cannot run as a transient step`,
                    at.transient,
                ),
                payload,
            };
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
            state: this.committed.state as unknown as LayoutState<T>,
            get: (
                key: CommandContextGetKey,
                payload?: { id?: unknown; nodeId?: unknown },
            ) => {
                if (key === "node-by") {
                    const id = payload?.id;
                    return typeof id === "string" ? draft.get(id) : undefined;
                }
                if (key === "node-parent-by") {
                    const nodeId = payload?.nodeId;
                    const parent =
                        typeof nodeId === "string"
                            ? draft.parentOf(nodeId)
                            : undefined;
                    return parent === undefined ? undefined : draft.get(parent);
                }
                return undefined;
            },
        } as CommandContext<T>;

        const reduceContext: ReduceContext = {
            draft,
            validateData: (component, data) => {
                const schema = this.dataSchemas?.[component];
                return schema && invalid(validate(schema, data, "/data"));
            },
            loadLayout: (json) => {
                const built = buildState(
                    json,
                    draft.ids,
                    {
                        dataSchemas: this.dataSchemas,
                        freeze: this.freeze,
                        reserved: (id) => draft.isUsed(id),
                    },
                    "/layout",
                );
                return built.ok
                    ? built
                    : (invalid(built.issues) ??
                          fail("invalid_payload", "invalid layout"));
            },
            runInBatch: (subCommand, subPayload, path) => {
                const sub = this.runChain(
                    execution,
                    subCommand,
                    subPayload,
                    {
                        payload: `${path}/payload`,
                        command: `${path}/command`,
                        transient: `${path}/command`,
                    },
                    true,
                );
                if (sub.result.ok) {
                    execution.steps.push({
                        command: subCommand as CommandName,
                        payload: sub.payload,
                        result: sub.result.value,
                    });
                }
                return sub.result;
            },
        };

        let ranWith = payload;
        const core = (): CommandResult<unknown> => {
            const rewritten =
                context.payload !== validated &&
                invalid(
                    validate(definition.payloadSchema, context.payload),
                    "rewritten by a middleware: ",
                );
            if (rewritten) {
                return rewritten;
            }
            ranWith = context.payload;
            try {
                return definition.reduce(
                    context.payload as never,
                    reduceContext,
                );
            } catch (thrown) {
                execution.thrown ??= { error: thrown };
                return fail("refused", "the command failed");
            }
        };
        const result = prefixed(this.chain(context, core), at.payload);
        return { result, payload: ranWith };
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
            let nextResult: CommandResult<unknown> = fail(
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
                return fail(
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
