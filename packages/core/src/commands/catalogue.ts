import { borderConfigure, borderResize } from "./border";
import type { CommandDefinition } from "./define";
import { batch, layoutConfigure, layoutLoad } from "./layout";
import { rowConfigure, rowResize } from "./row";
import {
    tabAdd,
    tabClose,
    tabConfigure,
    tabMove,
    tabPin,
    tabPopout,
    tabRename,
    tabSelect,
    tabSetComponent,
    tabSetData,
} from "./tab";
import {
    tabsetActivate,
    tabsetClose,
    tabsetConfigure,
    tabsetMaximize,
    tabsetMove,
    tabsetPopout,
} from "./tabset";
import type { CommandName } from "./types";
import { windowClose, windowConfigure } from "./window";

/**
 * Every built-in command, in the order `model.get("commands")` lists them. Each definition keeps its
 * schemas' literal types (the type tests read them); the list erases them to `CommandDefinition`
 * once, so code that walks it does not compare 24 literal schemas with `JsonSchema` again.
 */
export const COMMANDS: readonly CommandDefinition[] = [
    tabAdd,
    tabSelect,
    tabClose,
    tabMove,
    tabSetData,
    tabSetComponent,
    tabPin,
    tabPopout,
    tabRename,
    tabConfigure,
    tabsetActivate,
    tabsetMaximize,
    tabsetClose,
    tabsetMove,
    tabsetPopout,
    tabsetConfigure,
    rowResize,
    rowConfigure,
    borderResize,
    borderConfigure,
    windowClose,
    windowConfigure,
    layoutConfigure,
    layoutLoad,
    batch,
    // each entry is checked for what the list relies on (its schemas were checked where it was
    // defined), then the literal types are erased
] as const satisfies readonly {
    readonly name: CommandName;
    readonly transient: boolean;
    readonly reduce: (...args: never[]) => unknown;
}[] as readonly unknown[] as readonly CommandDefinition[];

/** The command definitions by name. */
export const COMMAND_DEFINITIONS: ReadonlyMap<string, CommandDefinition> =
    new Map(COMMANDS.map((definition) => [definition.name, definition]));
