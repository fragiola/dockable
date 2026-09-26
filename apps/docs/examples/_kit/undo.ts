// Undo/redo for a Dockable model, as example code: the package ships none, so undo/redo is the
// app's to design (what counts as a step, what to ignore, how steps across layouts combine).
// Copy this file and change it freely.
//
// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/useUndo.ts, rewritten as
// a framework-agnostic class. Copyright (c) 2017 Caplin Systems Ltd. MIT licence.
import { type Action, Actions, Model } from "@fragiola/dockable";

/** actions that don't create an undo step by default */
const DEFAULT_IGNORE_ACTION_TYPES = [Actions.SET_ACTIVE_TABSET];

/** Options for {@link UndoManager}. */
export interface IUndoOptions {
    /** maximum number of undo steps to retain, default 100 */
    maxBufferSize?: number;
    /** action types that should not create an undo step, default [Actions.SET_ACTIVE_TABSET] */
    ignoreActionTypes?: string[];
}

/** The state of an {@link UndoManager}. The same object is returned until something changes. */
export interface IUndoSnapshot {
    /** the current model */
    readonly model: Model | null;
    /** true if there is at least one undo step available */
    readonly canUndo: boolean;
    /** true if there is at least one redo step available */
    readonly canRedo: boolean;
    /** the number of undo steps available */
    readonly undoCount: number;
    /** the number of redo steps available */
    readonly redoCount: number;
}

/**
 * Undo/redo for a {@link Model}. It owns the current model, records a snapshot before each model
 * mutation (collapsing an entire drag gesture into a single step), and replaces the model on
 * undo/redo via `Model.fromJson(json, current)` so mounted tab content is preserved.
 *
 * ```ts
 * const undo = new UndoManager(Model.fromJson(json));
 * const unsubscribe = undo.subscribe(() => render(undo.getSnapshot()));
 * undo.getModel()?.doAction(Actions.deleteTab("t1"));
 * undo.undo();
 * ```
 */
export class UndoManager {
    private model: Model | null;
    private readonly maxBufferSize: number;
    private readonly ignoreActionTypes: string[];
    private undoBuffer: string[] = [];
    private redoBuffer: string[] = [];
    // the pre-drag state for a gesture in progress; only the first adjusting action records it so
    // the whole gesture collapses into a single undo step
    private modelBeforeAdjusting: string | null = null;
    private readonly listeners = new Set<() => void>();
    private snapshot: IUndoSnapshot;
    private disposed = false;

    private readonly changeListener = {
        onBeforeAction: (action: Action) => {
            const model = this.model;
            if (!model) {
                return;
            }
            if (action.isAdjusting()) {
                if (this.modelBeforeAdjusting === null) {
                    this.modelBeforeAdjusting = JSON.stringify(model.toJson());
                }
            } else {
                // an ignored action (e.g. activating a tabset mid-drag) must not drop the snapshot of a
                // gesture in progress: only the step that records it clears it
                if (!this.ignoreActionTypes.includes(action.type)) {
                    this.undoBuffer.push(
                        this.modelBeforeAdjusting ??
                            JSON.stringify(model.toJson()),
                    );
                    if (this.undoBuffer.length > this.maxBufferSize) {
                        this.undoBuffer.shift();
                    }
                    this.redoBuffer = [];
                    this.modelBeforeAdjusting = null;
                    this.notify();
                }
            }
        },
    };

    constructor(model: Model | null, options?: IUndoOptions) {
        this.maxBufferSize = options?.maxBufferSize ?? 100;
        this.ignoreActionTypes =
            options?.ignoreActionTypes ?? DEFAULT_IGNORE_ACTION_TYPES;
        this.model = null;
        this.attach(model);
        this.snapshot = this.createSnapshot();
    }

    /** the current model */
    getModel(): Model | null {
        return this.model;
    }

    /**
     * Replaces the model (e.g. after loading a layout). By default the undo/redo history is
     * cleared; pass `false` as the second argument to keep it (for example for an in-place
     * round-trip of the same model, which should not lose the history).
     */
    setModel(model: Model, resetHistory = true) {
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

    /** clear the undo/redo history without replacing the model */
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
    getSnapshot = (): IUndoSnapshot => this.snapshot;

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
        this.model?.removeChangeListener(this.changeListener);
        this.listeners.clear();
    }

    private swap(from: string[], to: string[]) {
        const current = this.model;
        if (!current) {
            return;
        }
        const json = from.pop();
        if (json === undefined) {
            return;
        }
        to.push(JSON.stringify(current.toJson()));
        this.modelBeforeAdjusting = null;
        this.attach(Model.fromJson(JSON.parse(json), current));
        this.notify();
    }

    private attach(model: Model | null) {
        if (model === this.model) {
            return;
        }
        this.model?.removeChangeListener(this.changeListener);
        this.model = model;
        if (model && !this.disposed) {
            model.addChangeListener(this.changeListener);
        }
    }

    private clear() {
        this.undoBuffer = [];
        this.redoBuffer = [];
        this.modelBeforeAdjusting = null;
    }

    private createSnapshot(): IUndoSnapshot {
        return {
            model: this.model,
            canUndo: this.canUndo,
            canRedo: this.canRedo,
            undoCount: this.undoCount,
            redoCount: this.redoCount,
        };
    }

    private notify() {
        const next = this.createSnapshot();
        const prev = this.snapshot;
        if (
            prev.model === next.model &&
            prev.undoCount === next.undoCount &&
            prev.redoCount === next.redoCount
        ) {
            return;
        }
        this.snapshot = next;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}
