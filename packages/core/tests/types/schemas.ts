// Type fixtures (compiled by `pnpm typecheck`, never run): each command's hand-written JSON Schema,
// read back as a type with FromSchema, is the command's payload type (and result type). A schema
// that drifts from its type fails the typecheck.
import type { borderConfigure, borderResize } from "../../src/commands/border";
import type { layoutConfigure } from "../../src/commands/layout";
import type { rowConfigure, rowResize } from "../../src/commands/row";
import type {
    tabAdd,
    tabClose,
    tabConfigure,
    tabMove,
    tabPin,
    tabPopout,
    tabSelect,
    tabUpdate,
} from "../../src/commands/tab";
import type {
    tabsetActivate,
    tabsetClose,
    tabsetConfigure,
    tabsetMaximize,
    tabsetMove,
    tabsetPopout,
} from "../../src/commands/tabset";
import type {
    CommandName,
    PayloadOf,
    ResultOf,
} from "../../src/commands/types";
import type { windowClose, windowConfigure } from "../../src/commands/window";
import type { FromSchema } from "../../src/schema/from-schema";
import type { AnyTypes } from "../../src/state/types";

/** Mutually assignable, with the same keys. */
type Same<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? [keyof A] extends [keyof B]
            ? [keyof B] extends [keyof A]
                ? true
                : false
            : false
        : false
    : false;

type Check<
    C extends CommandName,
    D extends { payloadSchema: unknown; resultSchema: unknown },
> = [
    Same<FromSchema<D["payloadSchema"]>, PayloadOf<AnyTypes, C>>,
    Same<FromSchema<D["resultSchema"]>, ResultOf<AnyTypes, C>>,
];

/** Compiles only when every entry is `[true, true]`. */
export type SchemasMatchTypes = [
    Check<"tab.add", typeof tabAdd>,
    Check<"tab.select", typeof tabSelect>,
    Check<"tab.close", typeof tabClose>,
    Check<"tab.move", typeof tabMove>,
    Check<"tab.update", typeof tabUpdate>,
    Check<"tab.pin", typeof tabPin>,
    Check<"tab.popout", typeof tabPopout>,
    Check<"tab.configure", typeof tabConfigure>,
    Check<"tabset.activate", typeof tabsetActivate>,
    Check<"tabset.maximize", typeof tabsetMaximize>,
    Check<"tabset.close", typeof tabsetClose>,
    Check<"tabset.move", typeof tabsetMove>,
    Check<"tabset.popout", typeof tabsetPopout>,
    Check<"tabset.configure", typeof tabsetConfigure>,
    Check<"row.resize", typeof rowResize>,
    Check<"row.configure", typeof rowConfigure>,
    Check<"border.resize", typeof borderResize>,
    Check<"border.configure", typeof borderConfigure>,
    Check<"window.close", typeof windowClose>,
    Check<"window.configure", typeof windowConfigure>,
    Check<"layout.configure", typeof layoutConfigure>,
] extends [true, true][]
    ? true
    : never;

export const schemasMatchTypes: SchemasMatchTypes = true;
