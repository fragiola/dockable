import type { LayoutEngine } from "../engine/LayoutEngine";
import { Actions } from "../model/Actions";
import type { DockLocation } from "../model/DockLocation";
import type { IJsonTabNode } from "../model/IJsonModel";
import type { Model } from "../model/Model";
import { TabNode } from "../model/TabNode";

/** Where a transferred tab was, or where it went. */
export interface ITransferEnd {
    model: Model;
    /** the layout the tab was (or is now) in */
    layoutId: string;
    /** its tabset (or border), when it has one */
    tabsetId: string | undefined;
    /** its position among the tabset's children */
    index: number;
}

/** A tab that moved from one model to another. */
export interface ITransfer {
    /** the tab in the target model (the same id as before) */
    tab: TabNode;
    /** its JSON, as it left the source model */
    json: IJsonTabNode;
    from: ITransferEnd;
    to: ITransferEnd;
}

export type TransferListener = (transfer: ITransfer) => void;

/** `userData` of the add and delete actions of a transfer, so `onAction` can tell them apart. */
export interface ITransferUserData {
    transfer: {
        tabId: string;
        from: Model;
        to: Model;
    };
}

function endOf(tab: TabNode): ITransferEnd {
    const parent = tab.getParent();
    return {
        model: tab.getModel(),
        layoutId: tab.getLayoutId(),
        tabsetId: parent?.getId(),
        index: parent ? parent.getChildren().indexOf(tab) : -1,
    };
}

/**
 * Layouts of different models that exchange tabs by drag and drop. Each layout's main engine joins
 * the group (the engine's `dragGroup` option); a tab dragged from one member drops into another,
 * and its content is kept (the new tab adopts the old one's moveable element).
 *
 * A transfer asks the target's `onAction` (an `addTab`), then the source's (a `deleteTab`); if either
 * vetoes (or replaces its action with another kind of action), nothing changes; the target's
 * `onAction` may so see an add that the source then refuses. Both actions carry
 * {@link ITransferUserData}. Listeners registered with
 * {@link onTransfer} receive where the tab came from and where it went: what an app's undo needs.
 */
export class DragGroup {
    private readonly engines = new Set<LayoutEngine>();
    private readonly listeners = new Set<TransferListener>();

    /** @internal adds a main engine to the group; returns the function that removes it */
    join(engine: LayoutEngine): () => void {
        this.engines.add(engine);
        return () => {
            this.engines.delete(engine);
        };
    }

    /** Whether `engine` (a main engine) belongs to the group. */
    has(engine: LayoutEngine): boolean {
        return this.engines.has(engine);
    }

    /** The main engine of `model` in this group, if it joined. */
    engineOf(model: Model): LayoutEngine | undefined {
        for (const engine of this.engines) {
            if (engine.getModel() === model) {
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
     * Moves the tab `tabId` from the model `from` into `to`, next to (or into) the node `toNodeId`,
     * as a drop would. Both models' main engines must be in the group. Returns the new tab, or
     * `undefined` when it could not happen (a veto, an unknown tab or target, an id already used in
     * `to`).
     */
    transfer(
        tabId: string,
        from: Model,
        to: Model,
        toNodeId: string,
        location: DockLocation,
        index: number,
    ): TabNode | undefined {
        const source = this.engineOf(from);
        const target = this.engineOf(to);
        const tab = from.getNodeById(tabId);
        if (!source || !target || !(tab instanceof TabNode)) {
            return undefined;
        }
        return this.transferTab(source, target, tab, toNodeId, location, index);
    }

    /**
     * @internal the transfer itself: `targetEngine` is the target layout's engine (the main one, or
     * a popout's), `sourceEngine` the source model's main engine.
     */
    transferTab(
        sourceEngine: LayoutEngine,
        targetEngine: LayoutEngine,
        tab: TabNode,
        toNodeId: string,
        location: DockLocation,
        index: number,
    ): TabNode | undefined {
        const source = sourceEngine.getModel();
        const target = targetEngine.getModel();
        if (source === target || target.getNodeById(tab.getId())) {
            return undefined; // not a transfer, or its id is taken in the target model
        }
        const json = tab.toJson() as IJsonTabNode;
        const userData: ITransferUserData = {
            transfer: { tabId: tab.getId(), from: source, to: target },
        };
        const add = targetEngine.interceptAction(
            Actions.addTab(json, toNodeId, location, index).setUserData(
                userData,
            ),
        );
        // a replacement must still add a tab (and the other, still delete it): anything else
        // would add without removing, so it counts as a veto
        if (add?.type !== Actions.ADD_TAB) {
            return undefined;
        }
        const remove = sourceEngine.interceptAction(
            Actions.deleteTab(tab.getId()).setUserData(userData),
        );
        if (remove?.type !== Actions.DELETE_TAB) {
            return undefined;
        }
        const from = endOf(tab);
        const added = target.doAction(add);
        if (!(added instanceof TabNode)) {
            return undefined;
        }
        // the content moves with it: the new tab re-parents the old tab's element
        added.adoptViewState(tab);
        source.doAction(remove);
        const transfer: ITransfer = {
            tab: added,
            json,
            from,
            to: endOf(added),
        };
        for (const listener of [...this.listeners]) {
            listener(transfer);
        }
        return added;
    }
}
