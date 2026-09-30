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
    tabSelect,
    tabUpdate,
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

/** Every built-in command, in the order `model.commands()` lists them. */
export const COMMANDS = [
    tabAdd,
    tabSelect,
    tabClose,
    tabMove,
    tabUpdate,
    tabPin,
    tabPopout,
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
] as const;

/** The command definitions by name. */
export const COMMAND_DEFINITIONS: ReadonlyMap<string, CommandDefinition> =
    new Map(
        COMMANDS.map((definition) => [
            definition.name,
            definition as unknown as CommandDefinition,
        ]),
    );

/** Whether `name` is a built-in command. */
export function isCommandName(name: string): name is CommandName {
    return COMMAND_DEFINITIONS.has(name);
}
