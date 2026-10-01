import type {
    DockableTypes,
    DragGroup,
    Model,
    ModelHandle,
    Transfer,
} from "@fragiola/dockable";

// Undo and redo for tabs moved between layouts, built by the app on the group's transfer events.
// Dockable ships no undo: this is one choice among many (here, only moves between layouts are
// steps; a history of each layout's own changes would be recorded the same way, from
// model.subscribe). Copy it and adapt it.

/** One side of a step: the model, and where the tab is (or was) in it. */
export interface StepEnd<T extends DockableTypes> {
    model: Model<T>;
    /** the tab's id in this model (a transfer keeps it unless it is taken there) */
    tabId: string;
    /** the tabset it was in, and its position there */
    tabsetId: string | undefined;
    index: number;
}

export interface Step<T extends DockableTypes> {
    name: string;
    from: StepEnd<T>;
    to: StepEnd<T>;
}

/**
 * A transferred tab's name, from its `data.name`. A transfer carries the tab as it left its model,
 * with untyped data (the group can join models of any registry), so the name is read with checks.
 */
function nameOf(init: { readonly data?: unknown }): string {
    const data = init.data;
    return typeof data === "object" &&
        data !== null &&
        "name" in data &&
        typeof data.name === "string"
        ? data.name
        : "";
}

/** Where to put a tab back: its old tabset if it still exists, else the model's first tabset. */
function targetIn<T extends DockableTypes>(
    end: StepEnd<T>,
): string | undefined {
    const tabset = end.tabsetId ? end.model.get(end.tabsetId) : undefined;
    if (tabset?.type === "tabset") {
        return tabset.id;
    }
    return end.model.tabsets()[0]?.id ?? end.model.root()?.id;
}

/**
 * A history of transfers for one drag group. Undo moves the tab back to where it came from (so it
 * disappears from the layout it went to); redo moves it again. Both go through `group.transfer`,
 * which keeps the tab's content mounted and runs each model's middleware.
 */
export class TransferHistory<T extends DockableTypes> {
    private undoStack: Step<T>[] = [];
    private redoStack: Step<T>[] = [];
    private replaying = false;
    private readonly listeners = new Set<() => void>();
    private snapshot = {
        undo: [] as readonly Step<T>[],
        redo: [] as readonly Step<T>[],
    };

    /** `models`: the group's models the history knows (a transfer names them as handles) */
    constructor(
        private readonly group: DragGroup,
        private readonly models: readonly Model<T>[],
    ) {}

    /** Starts recording the group's transfers. Returns the function that stops. */
    connect(): () => void {
        return this.group.onTransfer((transfer: Transfer) => {
            if (this.replaying) {
                return; // our own undo or redo: not a new step
            }
            const from = this.modelOf(transfer.from.model);
            const to = this.modelOf(transfer.to.model);
            if (!from || !to) {
                return; // a transfer between models this history does not follow
            }
            this.undoStack.push({
                name: nameOf(transfer.init),
                from: {
                    model: from,
                    tabId: transfer.previousId,
                    tabsetId: transfer.from.tabsetId,
                    index: transfer.from.index,
                },
                to: {
                    model: to,
                    tabId: transfer.tab,
                    tabsetId: transfer.to.tabsetId,
                    index: transfer.to.index,
                },
            });
            this.redoStack = [];
            this.changed();
        });
    }

    undo() {
        const step = this.undoStack.pop();
        const moved = step && this.move(step.to, step.from);
        if (step && moved) {
            this.redoStack.push({
                ...step,
                from: { ...step.from, tabId: moved },
            });
        }
        this.changed();
    }

    redo() {
        const step = this.redoStack.pop();
        const moved = step && this.move(step.from, step.to);
        if (step && moved) {
            this.undoStack.push({ ...step, to: { ...step.to, tabId: moved } });
        }
        this.changed();
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.snapshot;

    /** Our own model behind a transfer's handle: the same object, compared with `===`. */
    private modelOf(handle: ModelHandle): Model<T> | undefined {
        return this.models.find((model) => model === handle);
    }

    /** Moves the tab from one end to the other; returns its id there, or undefined if refused. */
    private move(from: StepEnd<T>, to: StepEnd<T>): string | undefined {
        const target = targetIn(to);
        if (!target) {
            return undefined;
        }
        this.replaying = true;
        try {
            return this.group.transfer({
                tab: from.tabId,
                from: from.model,
                to: to.model,
                target,
                location: "center",
                index: target === to.tabsetId ? to.index : -1,
            });
        } finally {
            this.replaying = false;
        }
    }

    private changed() {
        this.snapshot = {
            undo: [...this.undoStack],
            redo: [...this.redoStack],
        };
        for (const listener of [...this.listeners]) {
            listener();
        }
    }
}
