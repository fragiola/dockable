import {
    DockLocation,
    type DragGroup,
    type ITransfer,
    type ITransferEnd,
    type Model,
    TabSetNode,
} from "@fragiola/dockable";

// Undo and redo for tabs moved between layouts, built by the app on the group's transfer events.
// Dockable ships no undo: this is one choice among many (here, only moves between layouts are
// steps; a history of each layout's own changes would be recorded the same way, from
// onModelChange). Copy it and adapt it.

export interface Step {
    tabId: string;
    name: string;
    from: ITransferEnd;
    to: ITransferEnd;
}

/** Where to put a tab back: its old tabset if it still exists, else the model's first tabset. */
function targetIn(model: Model, end: ITransferEnd): string | undefined {
    const tabset = end.tabsetId ? model.getNodeById(end.tabsetId) : undefined;
    if (tabset instanceof TabSetNode) {
        return tabset.getId();
    }
    return model.getFirstTabSet()?.getId() ?? model.getRootRow()?.getId();
}

/**
 * A history of transfers for one drag group. Undo moves the tab back to where it came from (so it
 * disappears from the layout it went to); redo moves it again. Both go through `group.transfer`,
 * which keeps the tab's content mounted and runs each layout's `onAction`.
 */
export class TransferHistory {
    private undoStack: Step[] = [];
    private redoStack: Step[] = [];
    private replaying = false;
    private readonly listeners = new Set<() => void>();
    private snapshot = {
        undo: [] as readonly Step[],
        redo: [] as readonly Step[],
    };

    constructor(private readonly group: DragGroup) {}

    /** Starts recording the group's transfers. Returns the function that stops. */
    connect(): () => void {
        return this.group.onTransfer((transfer: ITransfer) => {
            if (this.replaying) {
                return; // our own undo or redo: not a new step
            }
            this.undoStack.push({
                tabId: transfer.tab.getId(),
                name: transfer.tab.getName(),
                from: transfer.from,
                to: transfer.to,
            });
            this.redoStack = [];
            this.changed();
        });
    }

    undo() {
        const step = this.undoStack.pop();
        if (step && this.move(step, step.to, step.from)) {
            this.redoStack.push(step);
        }
        this.changed();
    }

    redo() {
        const step = this.redoStack.pop();
        if (step && this.move(step, step.from, step.to)) {
            this.undoStack.push(step);
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

    private move(step: Step, from: ITransferEnd, to: ITransferEnd): boolean {
        const target = targetIn(to.model, to);
        if (!target) {
            return false;
        }
        this.replaying = true;
        try {
            const index = target === to.tabsetId ? to.index : -1;
            return (
                this.group.transfer(
                    step.tabId,
                    from.model,
                    to.model,
                    target,
                    DockLocation.CENTER,
                    index,
                ) !== undefined
            );
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
