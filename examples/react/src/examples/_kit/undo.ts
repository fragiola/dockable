// Undo/redo for a Dockable model, as example code: the package ships none, so undo/redo is the
// app's to design (what counts as a step, what to ignore, how steps across layouts combine).
// Copy this file and change it freely.
//
// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/useUndo.ts, rewritten as
// a framework-agnostic class over the command bus. Copyright (c) 2017 Caplin Systems Ltd. MIT
// licence.
import {
    type AnyTypes,
    type CommandEvent,
    type CommandName,
    type DockableTypes,
    type LayoutState,
    type Model,
    toLayoutJson,
} from "@fragiola/dockable";

/** `meta` of the `layout.load` an undo or a redo runs, so it is not recorded as a step. */
const UNDO_META = { undo: true } as const;

/** Options for {@link UndoManager}. */
export interface UndoOptions {
    /** maximum number of undo steps to retain, default 100 */
    maxBufferSize?: number;
    /** commands that should not create an undo step, default `["tabset.activate", "window.configure"]` */
    ignoreCommands?: readonly CommandName[];
}

/** A step of the history: what made it, for a label ("Close", "Move"). */
export interface UndoStep {
    /** the command that made the step (a gesture's last one; `batch` for a batch) */
    readonly command: CommandName;
    /** a batch's commands, flattened; the command itself otherwise */
    readonly commands: readonly CommandName[];
}

/** The state of an {@link UndoManager}. The same object is returned until something changes. */
export interface UndoSnapshot {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** the steps undo goes back through, oldest first (the last one is undone next) */
    readonly undoSteps: readonly UndoStep[];
    /** the steps redo goes forward through, the next one last */
    readonly redoSteps: readonly UndoStep[];
}

/** A step and the state it goes back to (immutable: kept as is until it is loaded). */
interface Entry<T extends DockableTypes> {
    readonly step: UndoStep;
    readonly state: LayoutState<T>;
}

/**
 * Undo/redo for a {@link Model}. It listens to the model's commits (`model.subscribe`) and keeps
 * the state from before each step (a whole drag gesture, its transient commands included, is one
 * step). States are immutable, so keeping one costs nothing; undo and redo turn one back into a
 * document (`toLayoutJson`) and restore it in place with `layout.load`: the model stays the same,
 * and so does the content of every tab that is still there. It listens to its model for the
 * model's whole life: create one manager per model, once.
 *
 * ```ts
 * const undo = new UndoManager(model);
 * const unsubscribe = undo.subscribe(() => render(undo.getSnapshot()));
 * model.run("tab.close", { tabId: "t1" });
 * undo.undo();
 * ```
 */
export class UndoManager<T extends DockableTypes = AnyTypes> {
    private readonly model: Model<T>;
    private readonly maxBufferSize: number;
    private readonly ignoreCommands: readonly CommandName[];
    private undoBuffer: Entry<T>[] = [];
    private redoBuffer: Entry<T>[] = [];
    /** the state after the last recorded commit: what the next step goes back to */
    private last: LayoutState<T>;
    /** a gesture (transient commands) is in progress since `last` */
    private adjusting = false;
    private readonly listeners = new Set<() => void>();
    private snapshot: UndoSnapshot;

    constructor(model: Model<T>, options?: UndoOptions) {
        this.model = model;
        this.maxBufferSize = options?.maxBufferSize ?? 100;
        this.ignoreCommands = options?.ignoreCommands ?? [
            "tabset.activate",
            "window.configure",
        ];
        this.last = model.state;
        this.snapshot = this.createSnapshot();
        model.subscribe(this.onCommit);
    }

    /** undo the most recent change, if any */
    undo() {
        this.swap(this.undoBuffer, this.redoBuffer);
    }

    /** redo the most recently undone change, if any */
    redo() {
        this.swap(this.redoBuffer, this.undoBuffer);
    }

    /** The current state, the same object until it changes (bound, for `useSyncExternalStore`). */
    getSnapshot = (): UndoSnapshot => this.snapshot;

    /** Calls `listener` whenever the snapshot changes. Returns the unsubscribe function (bound). */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private readonly onCommit = (event: CommandEvent<T>) => {
        if (event.meta?.undo === true) {
            return; // an undo or a redo
        }
        if (event.before === event.after && !this.adjusting) {
            return; // a command that changed nothing (a gesture's last one still ends its step)
        }
        if (this.ignored(event)) {
            // an ignored change is part of the state the next step goes back to, unless a gesture
            // is in progress (its step goes back to before the gesture)
            if (!this.adjusting) {
                this.last = event.after;
            }
            return;
        }
        if (event.transient) {
            // the gesture's final, non-transient command records the step (a transient command
            // that changed nothing, at a splitter's bound, starts none)
            if (event.before !== event.after) {
                this.adjusting = true;
            }
            return;
        }
        this.undoBuffer.push({
            step: {
                command: event.command,
                commands: event.commands?.map((step) => step.command) ?? [
                    event.command,
                ],
            },
            state: this.last,
        });
        if (this.undoBuffer.length > this.maxBufferSize) {
            this.undoBuffer.shift();
        }
        this.redoBuffer = [];
        this.adjusting = false;
        this.last = event.after;
        this.notify();
    };

    /** a command (or a batch of only such commands) that creates no step */
    private ignored(event: CommandEvent<T>): boolean {
        const commands =
            event.command === "batch"
                ? (event.commands ?? []).map((step) => step.command)
                : [event.command];
        return (
            commands.length > 0 &&
            commands.every((command) => this.ignoreCommands.includes(command))
        );
    }

    private swap(from: Entry<T>[], to: Entry<T>[]) {
        const entry = from.pop();
        if (entry === undefined) {
            return;
        }
        const current = this.model.state;
        // in place: the model and the content of every tab it keeps stay mounted
        const loaded = this.model.run(
            "layout.load",
            { layout: toLayoutJson(entry.state) },
            { meta: UNDO_META },
        );
        if (!loaded.ok) {
            from.push(entry); // refused (a middleware vetoed layout.load): the step stays
            return;
        }
        to.push({ step: entry.step, state: current });
        this.adjusting = false;
        this.last = this.model.state;
        this.notify();
    }

    private createSnapshot(): UndoSnapshot {
        return {
            canUndo: this.undoBuffer.length > 0,
            canRedo: this.redoBuffer.length > 0,
            undoSteps: this.undoBuffer.map((entry) => entry.step),
            redoSteps: this.redoBuffer.map((entry) => entry.step),
        };
    }

    private notify() {
        this.snapshot = this.createSnapshot();
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}

/** What {@link handleUndoKeys} reads of a key event: a DOM `KeyboardEvent`, or React's. */
type UndoKeyEvent = Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "target" | "preventDefault"
>;

/**
 * The undo shortcuts, for a `keydown` listener: Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and
 * Ctrl/Cmd+Y redo. A text field keeps its own undo.
 */
export function handleUndoKeys<T extends DockableTypes>(
    undo: UndoManager<T>,
    event: UndoKeyEvent,
) {
    const target = event.target;
    const inTextField =
        isElement(target) &&
        target.closest("input, textarea, [contenteditable]") !== null;
    if (!(event.ctrlKey || event.metaKey) || inTextField) {
        return;
    }
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
        undo.undo();
    } else if (key === "y" || key === "z") {
        undo.redo();
    } else {
        return;
    }
    event.preventDefault();
}

/** An element of any window: a popout's elements are not `instanceof` the page's `Element`. */
function isElement(target: EventTarget | null): target is Element {
    return target !== null && "closest" in target;
}
