import { COMMAND_DEFINITIONS } from "../commands/catalogue";
import type { ReduceContext } from "../commands/define";
import type {
    BatchStep,
    CommandContext,
    CommandContextGetKey,
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

/**
 * The path of a "cannot run as a transient step" error before it is placed: the flag is not in the
 * payload, so it is `/transient` (the option, or `dispatch`'s key), or a batch step's `/command`.
 */
const TRANSIENT_PATH = "\u0000transient";

function placeTransientError(
    result: CommandResult<unknown>,
    path: string,
): CommandResult<unknown> {
    return result.ok || result.error.path !== TRANSIENT_PATH
        ? result
        : { ok: false, error: { ...result.error, path } };
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
        // a dry run commits nothing, not even the ids it generated
        const ids = dryRun ? this.ids.clone() : this.ids;
        const draft = new Draft(
            this.committed.state,
            this.committed.index,
            ids,
        );
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
        result =
            !result.ok && result.error.path === TRANSIENT_PATH
                ? placeTransientError(result, "/transient")
                : prefixed(result, prefix);
        if (!result.ok || dryRun) {
            return result;
        }
        const before = this.committed.state as unknown as LayoutState<T>;
        const committed = draft.commit(this.freeze);
        this.committed.state = committed.state;
        this.committed.index = committed.index;
        const event: CommandEvent<T> = {
            command: command as CommandName,
            payload: finalPayload,
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
                TRANSIENT_PATH,
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
                    draft.ids,
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
                    if (sub.error.path === TRANSIENT_PATH) {
                        return placeTransientError(sub, `${path}/command`);
                    }
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
