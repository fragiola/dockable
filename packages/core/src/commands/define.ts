import type { JsonSchema } from "../schema/types";
import type { Draft } from "../state/draft";
import type { AnyState, NodeIndex } from "../state/tree";
import type { AnyTypes } from "../state/types";
import type {
    CommandError,
    CommandErrorCode,
    CommandName,
    CommandResult,
    PayloadOf,
    ResultOf,
} from "./types";

/** What a reducer can use besides the draft. */
export interface ReduceContext {
    readonly draft: Draft;
    /** validates a tab's data against the component's registered schema (undefined: valid) */
    validateData(
        component: string,
        data: unknown,
        path: string,
    ): CommandError | undefined;
    /** builds a whole state from a layout document (for `layout.load`) */
    loadLayout(
        json: unknown,
        path: string,
    ):
        | { ok: true; state: AnyState; index: NodeIndex }
        | { ok: false; error: CommandError };
    /** runs one command of a batch on the same draft, through the middleware chain */
    runInBatch(
        command: string,
        payload: unknown,
        path: string,
    ): CommandResult<unknown>;
}

/** A built-in command: its description, schemas and reducer. */
export interface CommandDefinition<C extends CommandName = CommandName> {
    readonly name: C;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    /** whether it may run as a transient step of a continuous gesture */
    readonly transient: boolean;
    /** applies the command to the draft, or returns why it cannot */
    readonly reduce: (
        payload: PayloadOf<AnyTypes, C>,
        context: ReduceContext,
    ) => CommandResult<ResultOf<AnyTypes, C>>;
}

export function ok<R>(value: R): { readonly ok: true; readonly value: R } {
    return { ok: true, value };
}

export function fail(
    code: CommandErrorCode,
    message: string,
    path?: string,
): { readonly ok: false; readonly error: CommandError } {
    return {
        ok: false,
        error: path === undefined ? { code, message } : { code, message, path },
    };
}

/**
 * Declares a command: its payload is typed by its name, and its schemas keep their literal types
 * (the type tests read them with `FromSchema`).
 */
export function defineCommand<
    C extends CommandName,
    const P extends JsonSchema,
    const R extends JsonSchema,
>(
    definition: CommandDefinition<C> & {
        readonly payloadSchema: P;
        readonly resultSchema: R;
    },
): Omit<CommandDefinition<C>, "payloadSchema" | "resultSchema"> & {
    readonly payloadSchema: P;
    readonly resultSchema: R;
} {
    return definition;
}
