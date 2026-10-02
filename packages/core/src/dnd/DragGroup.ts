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
export type TransferMeta = {
    transfer: {
        tabId: string;
        from: ModelHandle;
        to: ModelHandle;
    };
};

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

/** Where a transferred tab goes in the target model. */
export interface TransferPlacement {
    to: string;
    location: DockLocation;
    index: number;
}

function endOf(model: Model<AnyTypes>, tabId: string): TransferEnd {
    const parent = model.get("node-parent-by", { nodeId: tabId });
    return {
        model,
        layoutId: model.get("layout-id-by", { nodeId: tabId }) ?? "",
        tabsetId: parent?.id,
        index: parent
            ? parent.children.findIndex((child) => child.id === tabId)
            : -1,
    };
}

/** How a tab moves into another model: its fields, the `tab.add` there, and the transfer's `meta`. */
export interface TransferPlan {
    init: TabInit;
    add: TabInit & TransferPlacement;
    meta: TransferMeta;
}

/**
 * The plan that moves tab `tabId` of `source` into `target` (with its id, unless the target
 * already has it); undefined when there is no such tab, or both models are the same.
 */
export function transferPlan(
    source: Model<AnyTypes>,
    target: Model<AnyTypes>,
    tabId: string,
    placement: TransferPlacement,
): TransferPlan | undefined {
    const tab = source.get("node-by", { id: tabId });
    if (source === target || tab?.type !== "tab") {
        return undefined;
    }
    const { type: _type, ...init } = tab;
    const fields: TabInit = target.get("node-by", { id: tabId })
        ? { ...init, id: undefined }
        : init;
    return {
        init: fields,
        add: { ...fields, ...placement },
        meta: { transfer: { tabId, from: source, to: target } },
    };
}

/** Whether both models accept a transfer: the target its `tab.add`, the source its `tab.close`. */
export function canTransfer(
    source: Model<AnyTypes>,
    target: Model<AnyTypes>,
    plan: TransferPlan,
): boolean {
    const options = { meta: plan.meta };
    return (
        target.can("tab.add", plan.add, options) &&
        source.can("tab.close", { tabId: plan.meta.transfer.tabId }, options)
    );
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
            if (engine.adapter.model === model) {
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
        if (!source || !target) {
            return undefined;
        }
        return this.transferTab(source, target, request.tab, {
            to: request.target,
            location: request.location ?? "center",
            index: request.index ?? -1,
        });
    }

    /**
     * @internal the transfer itself: `source` is the source model's main engine, `target` the target
     * layout's engine (the main one or a popout's).
     */
    transferTab(
        source: LayoutEngine<AnyTypes>,
        target: LayoutEngine<AnyTypes>,
        tabId: string,
        placement: TransferPlacement,
    ): string | undefined {
        const from = source.adapter.model;
        const to = target.adapter.model;
        const plan = transferPlan(from, to, tabId, placement);
        if (!plan || !canTransfer(from, to, plan)) {
            return undefined;
        }
        const options = { meta: plan.meta };
        const origin = endOf(from, tabId);
        // the content moves with the tab: take its element before the source forgets it
        const moveable = source.adapter.takeMoveable(tabId);
        const added = to.run("tab.add", plan.add, options);
        if (!added.ok) {
            source.adapter.adoptMoveable(tabId, moveable);
            return undefined;
        }
        const addedId = added.value.tabId;
        target.adapter.adoptMoveable(addedId, moveable);
        if (!from.run("tab.close", { tabId }, options).ok) {
            // the source refused after all (its answer changed since the dry run): undo the add,
            // and the content goes back with the tab
            const back = target.adapter.takeMoveable(addedId);
            if (to.run("tab.close", { tabId: addedId }, options).ok) {
                source.adapter.adoptMoveable(tabId, back);
            } else {
                target.adapter.adoptMoveable(addedId, back);
            }
            return undefined;
        }
        const transfer: Transfer = {
            tab: addedId,
            previousId: tabId,
            init: plan.init,
            from: origin,
            to: endOf(to, addedId),
        };
        for (const listener of [...this.listeners]) {
            listener(transfer);
        }
        return addedId;
    }
}
