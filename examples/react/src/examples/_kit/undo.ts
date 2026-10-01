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

/** Commands that don't create an undo step by default (a window's screen rect is no step either). */
const DEFAULT_IGNORE_COMMANDS: readonly CommandName[] = [
    "tabset.activate",
    "window.configure",
];

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
export interface UndoSnapshot<T extends DockableTypes = AnyTypes> {
    /** the current model */
    readonly model: Model<T> | null;
    /** true if there is at least one undo step available */
    readonly canUndo: boolean;
    /** true if there is at least one redo step available */
    readonly canRedo: boolean;
    /** the number of undo steps available */
    readonly undoCount: number;
    /** the number of redo steps available */
    readonly redoCount: number;
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
 * and so does the content of every tab that is still there.
 *
 * ```ts
 * const undo = new UndoManager(createModel<Types>(json));
 * const unsubscribe = undo.subscribe(() => render(undo.getSnapshot()));
 * undo.getModel()?.run("tab.close", { tabId: "t1" });
 * undo.undo();
 * ```
 */
export class UndoManager<T extends DockableTypes = AnyTypes> {
    private model: Model<T> | null;
    private readonly maxBufferSize: number;
    private readonly ignoreCommands: readonly CommandName[];
    private undoBuffer: Entry<T>[] = [];
    private redoBuffer: Entry<T>[] = [];
    /** the state after the last recorded commit: what the next step goes back to */
    private last: LayoutState<T> | null = null;
    /** a gesture (transient commands) is in progress since `last` */
    private adjusting = false;
    private unsubscribeModel: (() => void) | undefined;
    private readonly listeners = new Set<() => void>();
    private snapshot: UndoSnapshot<T>;
    private disposed = false;

    constructor(model: Model<T> | null, options?: UndoOptions) {
        this.maxBufferSize = options?.maxBufferSize ?? 100;
        this.ignoreCommands =
            options?.ignoreCommands ?? DEFAULT_IGNORE_COMMANDS;
        this.model = null;
        this.attach(model);
        this.snapshot = this.createSnapshot();
    }

    /** the current model */
    getModel(): Model<T> | null {
        return this.model;
    }

    /**
     * Replaces the model (e.g. another document). By default the undo/redo history is cleared;
     * pass `false` as the second argument to keep it.
     */
    setModel(model: Model<T>, resetHistory = true) {
        this.attach(model);
        if (resetHistory) {
            this.clear();
        }
        this.notify();
    }

    /** undo the most recent change, if any */
    undo() {
        this.swap(this.undoBuffer, this.redoBuffer);
    }

    /** redo the most recently undone change, if any */
    redo() {
        this.swap(this.redoBuffer, this.undoBuffer);
    }

    /** clear the undo/redo history without touching the model */
    reset() {
        this.clear();
        this.notify();
    }

    get canUndo() {
        return this.undoBuffer.length > 0;
    }

    get canRedo() {
        return this.redoBuffer.length > 0;
    }

    get undoCount() {
        return this.undoBuffer.length;
    }

    get redoCount() {
        return this.redoBuffer.length;
    }

    /** The current state. Returns the same object until the state changes (bound, so it can be
     *  passed to `useSyncExternalStore` as is). */
    getSnapshot = (): UndoSnapshot<T> => this.snapshot;

    /** Calls `listener` whenever the snapshot changes. Returns the unsubscribe function (bound). */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** Detaches from the model and drops every listener. */
    dispose() {
        this.disposed = true;
        this.unsubscribeModel?.();
        this.unsubscribeModel = undefined;
        this.listeners.clear();
    }

    private readonly onCommit = (event: CommandEvent<T>) => {
        if (!this.model || event.meta?.undo === true) {
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
        if (this.last) {
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
        const model = this.model;
        const entry = from.pop();
        if (!model || entry === undefined) {
            return;
        }
        const current = model.state;
        // in place: the model and the content of every tab it keeps stay mounted
        const loaded = model.run(
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
        this.last = model.state;
        this.notify();
    }

    private attach(model: Model<T> | null) {
        if (model === this.model) {
            return;
        }
        this.unsubscribeModel?.();
        this.unsubscribeModel = undefined;
        this.model = model;
        this.last = model ? model.state : null;
        this.adjusting = false;
        if (model && !this.disposed) {
            this.unsubscribeModel = model.subscribe(this.onCommit);
        }
    }

    private clear() {
        this.undoBuffer = [];
        this.redoBuffer = [];
        this.adjusting = false;
        this.last = this.model ? this.model.state : null;
    }

    private createSnapshot(): UndoSnapshot<T> {
        return {
            model: this.model,
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            undoCount: this.undoCount,
            redoCount: this.redoCount,
            undoSteps: this.undoBuffer.map((entry) => entry.step),
            redoSteps: this.redoBuffer.map((entry) => entry.step),
        };
    }

    private notify() {
        const next = this.createSnapshot();
        const prev = this.snapshot;
        if (
            prev.model === next.model &&
            prev.undoCount === next.undoCount &&
            prev.redoCount === next.redoCount &&
            prev.undoSteps.at(-1) === next.undoSteps.at(-1) &&
            prev.redoSteps.at(-1) === next.redoSteps.at(-1)
        ) {
            return;
        }
        this.snapshot = next;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}
