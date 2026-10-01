import type { LayoutEngine } from "../engine/LayoutEngine";
import type { DockLocation } from "../geometry/dock";
import type { TabInit } from "../state/json";
import type { Model, ModelHandle } from "../state/model";
import type { AnyTypes } from "../state/types";

/** Where a transferred tab was, or where it went. */
export interface TransferEnd {
    /** the model (compare it with yours: `transfer.from.model === a`) */
    model: ModelHandle;
    /** the layout the tab was (or is now) in */
    layoutId: string;
    /** its tabset (or border), when it has one */
    tabsetId: string | undefined;
    /** its position among the tabset's tabs */
    index: number;
}

/** A tab that moved from one model to another. */
export interface Transfer {
    /** the tab's id in the target model (its old id, unless that was taken there) */
    tab: string;
    /** its id in the source model */
    previousId: string;
    /** its fields, as it left the source model */
    init: TabInit;
    from: TransferEnd;
    to: TransferEnd;
}

export type TransferListener = (transfer: Transfer) => void;

/** `meta` of the `tab.add` and `tab.close` of a transfer, so middleware can tell them apart. */
export interface TransferMeta {
    transfer: {
        tabId: string;
        from: ModelHandle;
        to: ModelHandle;
    };
}

/** What `transfer` takes. */
export interface TransferRequest {
    /** the tab's id in `from` */
    tab: string;
    from: ModelHandle;
    to: ModelHandle;
    /** a tabset, row, border or layout of `to` */
    target: string;
    location?: DockLocation | undefined;
    index?: number | undefined;
}

function endOf(model: Model<AnyTypes>, tab: string): TransferEnd {
    const parent = model.get("parent", { node: tab });
    return {
        model,
        layoutId: model.get("layout-id", { node: tab }) ?? "",
        tabsetId: parent?.id,
        index: parent
            ? parent.children.findIndex((child) => child.id === tab)
            : -1,
    };
}

/**
 * Layouts of different models that exchange tabs by drag and drop. Each layout's main engine joins
 * the group; a tab dragged from one member drops into another, and its content is kept (the new tab
 * adopts the old one's moveable element).
 *
 * A transfer is a `tab.add` in the target model and a `tab.close` in the source, each through its
 * own model's middleware (marked with {@link TransferMeta}); when either refuses, nothing changes.
 */
export class DragGroup {
    private readonly engines = new Set<LayoutEngine<AnyTypes>>();
    private readonly listeners = new Set<TransferListener>();

    /** @internal adds a main engine to the group; returns the function that removes it */
    join(engine: LayoutEngine<AnyTypes>): () => void {
        this.engines.add(engine);
        return () => {
            this.engines.delete(engine);
        };
    }

    /** Whether `engine` (a main engine) belongs to the group. */
    has(engine: LayoutEngine<AnyTypes>): boolean {
        return this.engines.has(engine);
    }

    /** The main engine of `model` in this group, if it joined. */
    engineOf(model: ModelHandle): LayoutEngine<AnyTypes> | undefined {
        for (const engine of this.engines) {
            if (engine.model === model) {
                return engine;
            }
        }
        return undefined;
    }

    /** Calls `listener` after each transfer. Returns the unsubscribe function. */
    onTransfer(listener: TransferListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Moves a tab from one model into another, next to (or into) `target`, as a drop would. Both
     * models' main engines must be in the group. Returns the new tab's id, or undefined when it
     * could not happen (a refusal, an unknown tab or target).
     */
    transfer(request: TransferRequest): string | undefined {
        const source = this.engineOf(request.from);
        const target = this.engineOf(request.to);
        if (
            !source ||
            !target ||
            !source.model.get("node", { node: request.tab })
        ) {
            return undefined;
        }
        return this.transferTab(
            source,
            target,
            request.tab,
            request.target,
            request.location ?? "center",
            request.index ?? -1,
        );
    }

    /**
     * @internal the transfer itself: `targetEngine` is the target layout's engine (the main one or
     * a popout's), `sourceEngine` the source model's main engine.
     */
    transferTab(
        sourceEngine: LayoutEngine<AnyTypes>,
        targetEngine: LayoutEngine<AnyTypes>,
        tabId: string,
        to: string,
        location: DockLocation,
        index: number,
    ): string | undefined {
        const source = sourceEngine.model as unknown as Model<AnyTypes>;
        const target = targetEngine.model as unknown as Model<AnyTypes>;
        const tab = source.get("node", { node: tabId });
        if (source === target || tab?.type !== "tab") {
            return undefined;
        }
        const { type: _type, ...init } = tab;
        const fields: TabInit = target.get("node", { node: tabId })
            ? { ...init, id: undefined }
            : init;
        const meta: TransferMeta = {
            transfer: { tabId, from: source, to: target },
        };
        const add = { ...fields, to, location, index };
        // both sides must accept before anything changes
        if (
            !target.can("tab.add", add, { meta: { ...meta } }) ||
            !source.can("tab.close", { tab: tabId }, { meta: { ...meta } })
        ) {
            return undefined;
        }
        const from = endOf(source, tabId);
        // the content moves with the tab: take its element before the source forgets it
        const moveable = sourceEngine.main.takeMoveable(tabId);
        const added = target.run("tab.add", add, { meta: { ...meta } });
        if (!added.ok) {
            sourceEngine.main.adoptMoveable(tabId, moveable);
            return undefined;
        }
        targetEngine.main.adoptMoveable(added.value.tab, moveable);
        const closed = source.run(
            "tab.close",
            { tab: tabId },
            { meta: { ...meta } },
        );
        if (!closed.ok) {
            // the source refused after all (its answer changed since the dry run): undo the add,
            // and the content goes back with the tab
            const back = targetEngine.main.takeMoveable(added.value.tab);
            const undone = target.run(
                "tab.close",
                { tab: added.value.tab },
                { meta: { ...meta } },
            );
            if (undone.ok) {
                sourceEngine.main.adoptMoveable(tabId, back);
            } else {
                targetEngine.main.adoptMoveable(added.value.tab, back);
            }
            return undefined;
        }
        const transfer: Transfer = {
            tab: added.value.tab,
            previousId: tabId,
            init: fields,
            from,
            to: endOf(target, added.value.tab),
        };
        for (const listener of [...this.listeners]) {
            listener(transfer);
        }
        return added.value.tab;
    }
}
