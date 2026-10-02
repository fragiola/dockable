// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/DragDropManager.tsx,
// with React, JSX and class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see
// LICENSE.
//
// Differences from FlexLayout:
// - the drop outline is not a classed div the manager creates: the manager exposes a subscribable
//   indicator state that a view renders (`Dockable.DropIndicator`);
// - the drag image is an element the adapter provides (no generated text);
// - a drop is refused exactly when the model refuses the command it would run (`model.can`), so a
//   middleware veto refuses a drop; there is no `onAllowDrop`;
// - only drags that carry Dockable's MIME type are claimed (other libraries' drags pass through),
//   and every `drop` and `dragend` in the document ends the page's drag state;
// - "add" drags (a consumer element dragged in) and external drags (a foreign drag accepted by
//   `onExternalDrag`) drop through `tab.add`;
// - drop zones: consumer elements that take a layout drag and hand it to the consumer.
import type { PayloadOf } from "../commands/types";
import {
    type DropCandidate,
    type DropGeometry,
    dropCandidates,
} from "../drop/resolve";
import type { LayoutEngine, MeasurableKind } from "../engine/LayoutEngine";
import type { DockLocation } from "../geometry/dock";
import { EMPTY_RECT, type Rect, rect, rectEquals } from "../geometry/rect";
import { enablePointerOnIFrames } from "../splitter/SplitterController";
import { resolveBorder, resolveLayout } from "../state/defaults";
import type { TabInit, TabInitOf } from "../state/json";
import type { Model } from "../state/model";
import type {
    AnyTypes,
    DockableTypes,
    TabOf,
    TabsetNode,
} from "../state/types";
import { canTransfer, type TransferPlacement, transferPlan } from "./DragGroup";

/** The MIME type every Dockable drag carries; drags without it are not Dockable's. */
export const DRAG_TYPE = "application/x-dockable";

/** The drop location names. */
export type DropLocation = DockLocation;

/** What a drop outline represents: a drop into or beside a node (`rect`), or at a layout edge. */
export type DropKind = "rect" | "edge";

/** What is being dragged. */
export type DragSubject<T extends DockableTypes = AnyTypes> =
    /** a tab of the layout */
    | { readonly kind: "tab"; readonly tab: TabOf<T> }
    /** a whole tabset of the layout */
    | { readonly kind: "tabset"; readonly tabset: TabsetNode<T> }
    /** a new tab (a drag source, or a foreign drag) */
    | { readonly kind: "new"; readonly tab: TabInitOf<T> };

/** What a drop indicator shows. The same object is returned until it changes. */
export interface DropIndicatorState {
    /** a drop target is under the pointer */
    readonly visible: boolean;
    /** the drop outline, relative to the layout root (1x1 at the pointer when a drag enters) */
    readonly rect: Rect;
    /** where the dragged node would dock relative to the target */
    readonly location: DropLocation;
    /** `"edge"` for a drop at the outer edge of a layout, `"rect"` otherwise */
    readonly kind: DropKind;
    /** a drag is over this layout */
    readonly dragging: boolean;
    /** the id of the dragged tab or tabset (undefined for a new tab) */
    readonly dragNodeId: string | undefined;
    /** edge docking is enabled (and no tabset is maximized): edge affordances may be shown */
    readonly showEdges: boolean;
    /** seconds a view may take to animate the outline between targets (the core never animates) */
    readonly tabDragSpeed: number;
    /** the id of the drop target node (a tabset, a row for edge drops, a border) */
    readonly targetNodeId: string | undefined;
    /** the id of the tabset (or border) the drop goes into or beside */
    readonly targetTabSetId: string | undefined;
    /** the insertion index in the target's tab strip, or -1 for a drop on the content area */
    readonly index: number;
    /** the pointer is over a target that refuses the drop (a rule of the layout, a middleware) */
    readonly refused: boolean;
    /** the id of the tabset (or border) that refused the drop, when it was one */
    readonly refusedTabSetId: string | undefined;
    /** an auto-hide border with no tabs that the drag reveals (main layout only) */
    readonly revealedBorder: Exclude<DropLocation, "center"> | undefined;
}

/** The subset of a native `DragEvent` the manager uses. */
export type DragEventLike = Pick<
    DragEvent,
    "clientX" | "clientY" | "dataTransfer" | "target" | "preventDefault"
>;

/** Called after an add or external drag was dropped: the new tab's id, or undefined when refused. */
export type NewTabDropped = (
    tab: string | undefined,
    event: DragEventLike,
) => void;

/** What `onExternalDrag` returns to accept a foreign drag: the tab to create, and a callback. */
export interface ExternalDrag<T extends DockableTypes = AnyTypes> {
    /** the tab the drop creates */
    tab: TabInitOf<T>;
    /** called after the drop with the created tab's id (or undefined when refused) */
    onDrop?: NewTabDropped | undefined;
}

/**
 * Decides whether a drag that did not start in a layout (files, links, text, another library's
 * element) can be dropped into it: return the tab to create, or undefined to ignore the drag. It is
 * called when the drag enters a layout, when only `event.dataTransfer.types` is readable.
 */
export type OnExternalDrag<T extends DockableTypes = AnyTypes> = (
    event: DragEventLike,
) => ExternalDrag<T> | undefined;

/** Options of a drop zone: a consumer element that takes a layout drag. */
export interface DropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** whether the zone takes this drag (default: every drag of the zone's model) */
    accepts?: ((drag: DragSubject<T>) => boolean) | undefined;
    /** called when the drag is dropped on the zone; nothing is moved: run the command you want */
    onDrop: (drag: DragSubject<T>, event: DragEventLike) => void;
    /** called when the pointer enters (`true`) or leaves (`false`) the zone during a drag it takes */
    onOverChange?: ((over: boolean) => void) | undefined;
}

interface DropZone {
    options: DropZoneOptions<AnyTypes>;
    enterCount: number;
    over: boolean;
}

/** How a drag started: a node of a layout, a consumer element that adds a tab, a foreign drag. */
export type DragSourceKind = "internal" | "add" | "external";

/** The drag in progress. There is one for the page, shared by every window of a model. */
export class DragState {
    readonly mainEngine: LayoutEngine<AnyTypes>;
    readonly source: DragSourceKind;
    readonly subject: DragSubject<AnyTypes>;
    /** called after an add or external drag was dropped */
    readonly onNewTabDropped: NewTabDropped | undefined;

    constructor(
        mainEngine: LayoutEngine<AnyTypes>,
        source: DragSourceKind,
        subject: DragSubject<AnyTypes>,
        onNewTabDropped?: NewTabDropped,
    ) {
        this.mainEngine = mainEngine;
        this.source = source;
        this.subject = subject;
        this.onNewTabDropped = onNewTabDropped;
    }

    /** the id of the dragged tab or tabset (undefined for a new tab) */
    get dragId(): string | undefined {
        return this.subject.kind === "tab"
            ? this.subject.tab.id
            : this.subject.kind === "tabset"
              ? this.subject.tabset.id
              : undefined;
    }

    /** true for drags that create a new tab on drop */
    isNewTab(): boolean {
        return this.subject.kind === "new";
    }

    /** What is dragged, typed by the registry of `model`, when the drag belongs to `model`. */
    subjectOf<T extends DockableTypes>(
        model: Model<T>,
    ): DragSubject<T> | undefined {
        const owner: object = this.mainEngine.adapter.model;
        return owner === model
            ? (this.subject as unknown as DragSubject<T>)
            : undefined;
    }
}

function hasOwnPayload(event: DragEventLike): boolean {
    return event.dataTransfer?.types.includes(DRAG_TYPE) ?? false;
}

/**
 * A drag that is someone else's: it carries types, and not Dockable's. A drag that carries no
 * types at all (a synthetic event, as FlexLayout's cross-window test helpers send) is taken as the
 * page's drag, when there is one: a foreign drag always carries its data's types.
 */
function isForeignDrag(event: DragEventLike): boolean {
    const types = event.dataTransfer?.types;
    return !!types && types.length > 0 && !hasOwnPayload(event);
}

/** The indicator fields of a pointer over no target (over one that refuses the drop, if given). */
function noTarget(refused?: DropCandidate) {
    return {
        visible: false,
        targetNodeId: undefined,
        targetTabSetId: undefined,
        index: -1,
        refused: refused !== undefined,
        refusedTabSetId: refused?.container,
    };
}

/** A command a drop runs, as the manager prepares it. */
type DropCommand =
    | { command: "tab.move"; payload: PayloadOf<AnyTypes, "tab.move"> }
    | { command: "tabset.move"; payload: PayloadOf<AnyTypes, "tabset.move"> }
    | { command: "tab.add"; payload: PayloadOf<AnyTypes, "tab.add"> }
    | {
          command: "transfer";
          payload: { tabId: string } & TransferPlacement;
      };

/**
 * The drag-and-drop state machine of one layout engine, working on native drag events. The static
 * {@link DragState} is shared across every engine and window of the page, so a drag can cross
 * layouts (popouts participate in the same drag).
 */
export class DragDropManager {
    private static dragState: DragState | undefined = undefined;
    private static readonly dragListeners = new Set<() => void>();
    private static readonly dropZones = new Set<DropZone>();
    private static removeLostDragGuard: (() => void) | undefined;
    /** the managers of the main layouts attached to the page, by model (latest last) */
    private static readonly attachedMains = new WeakMap<
        object,
        DragDropManager[]
    >();

    private readonly engine: LayoutEngine<AnyTypes>;
    /** the rects the drop resolution reads, from this layout's engine */
    private readonly geometry: DropGeometry;
    private dragEnterCount = 0;
    private active = false;
    private target: DropCommand | undefined;
    private indicator: DropIndicatorState;
    private readonly listeners = new Set<() => void>();
    /** the model's answers during the current drag, by candidate (the state does not change mid-drag) */
    private verdicts = new Map<string, boolean>();
    private verdictsFor: DragState | undefined;
    private verdictsState: unknown;
    private verdictsSourceState: unknown;

    constructor(engine: LayoutEngine<AnyTypes>) {
        this.engine = engine;
        this.indicator = this.idleIndicator();
        const rect = (kind: MeasurableKind) => (id: string) =>
            engine.adapter.rect(kind, id);
        this.geometry = {
            node: (id) => rect("row")(id) ?? rect("tabset")(id),
            tabStrip: rect("tabstrip"),
            content: rect("tabsetcontent"),
            tabButton: rect("tabbutton"),
            borderStrip: rect("borderheader"),
            borderContent: rect("bordercontent"),
        };
    }

    // *********************************************************************************
    // The page-wide drag state
    // *********************************************************************************

    /** The drag in progress, if any. */
    static getDragState(): DragState | undefined {
        return DragDropManager.dragState;
    }

    /** Calls `listener` when a drag starts or ends. Returns the unsubscribe function. */
    static subscribeDrag(listener: () => void): () => void {
        DragDropManager.dragListeners.add(listener);
        return () => {
            DragDropManager.dragListeners.delete(listener);
        };
    }

    /**
     * Starts dragging a new tab into the layout of `model` from a consumer element anywhere on the
     * page (a sidebar item, a palette entry). Call from the element's `dragstart`, and
     * {@link endDrag} from its `dragend`. A drop runs `tab.add`, then calls `onDrop` with the new
     * tab's id. Returns false, starting nothing, when no layout of `model` is attached.
     */
    static startAddDrag<T extends DockableTypes>(
        model: Model<T>,
        event: DragEventLike,
        tab: TabInitOf<T>,
        onDrop?: NewTabDropped,
        dragImage?: Element | null,
    ): boolean {
        const managers = DragDropManager.attachedMains.get(model);
        const manager = managers?.[managers.length - 1];
        if (!manager) {
            return false;
        }
        manager.begin(
            event,
            "add",
            { kind: "new", tab: tab as TabInitOf<AnyTypes> },
            onDrop,
        );
        if (dragImage) {
            event.dataTransfer?.setDragImage(dragImage, 10, 10);
        }
        return true;
    }

    /** Ends the page's drag, if any (a drag source's `dragend`, or the lost drag fallback). */
    static endDrag() {
        const state = DragDropManager.dragState;
        if (state) {
            state.mainEngine.adapter.getDragDropManager().clearDragMain();
            DragDropManager.setDragState(undefined);
        }
    }

    private static setDragState(state: DragState | undefined, doc?: Document) {
        if (DragDropManager.dragState === state) {
            return;
        }
        DragDropManager.dragState = state;
        DragDropManager.removeLostDragGuard?.();
        DragDropManager.removeLostDragGuard =
            state && doc ? lostDragGuard(doc) : undefined;
        if (state === undefined) {
            for (const zone of DragDropManager.dropZones) {
                DragDropManager.setZoneOver(zone, false);
                zone.enterCount = 0;
            }
        }
        for (const listener of [...DragDropManager.dragListeners]) {
            listener();
        }
    }

    // *********************************************************************************
    // Indicator state
    // *********************************************************************************

    /** The drop indicator of this layout. The same object is returned until it changes. */
    getIndicatorState = (): DropIndicatorState => this.indicator;

    /** Calls `listener` when the indicator changes. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private idleIndicator(): DropIndicatorState {
        return {
            visible: false,
            rect: EMPTY_RECT,
            location: "center",
            kind: "rect",
            dragging: false,
            dragNodeId: undefined,
            showEdges: false,
            tabDragSpeed: this.engine.adapter.getTabDragSpeed(),
            targetNodeId: undefined,
            targetTabSetId: undefined,
            index: -1,
            refused: false,
            refusedTabSetId: undefined,
            revealedBorder: undefined,
        };
    }

    private setIndicator(next: DropIndicatorState) {
        const prev = this.indicator;
        let key: keyof DropIndicatorState;
        for (key in next) {
            if (
                key === "rect"
                    ? !rectEquals(prev.rect, next.rect)
                    : prev[key] !== next[key]
            ) {
                this.indicator = next;
                for (const listener of [...this.listeners]) {
                    listener();
                }
                return;
            }
        }
    }

    // *********************************************************************************
    // Starting and ending a drag
    // *********************************************************************************

    /** makes a drag of this layout's model the page's drag */
    private setDrag(
        source: DragSourceKind,
        subject: DragSubject,
        onDrop?: NewTabDropped,
    ) {
        DragDropManager.setDragState(
            new DragState(this.engine.adapter.main, source, subject, onDrop),
            this.engine.get("owner-document"),
        );
        this.dragEnterCount = 0;
    }

    private begin(
        event: DragEventLike,
        source: DragSourceKind,
        subject: DragSubject,
        onDrop?: NewTabDropped,
    ) {
        this.setDrag(source, subject, onDrop);
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.setData(
                DRAG_TYPE,
                DragDropManager.dragState?.dragId ?? "",
            );
            const copy = subject.kind === "new";
            dataTransfer.effectAllowed = copy ? "copy" : "copyMove";
            dataTransfer.dropEffect = copy ? "copy" : "move";
        }
    }

    /**
     * Starts dragging a tab or a whole tabset of this layout (by id). Call from the source's
     * `dragstart`, and {@link endDrag} from its `dragend`. `dragImage` is the element the browser
     * snapshots; with none, the browser default.
     */
    startDrag = (
        event: DragEventLike,
        id: string,
        dragImage?: Element | null,
    ) => {
        const model = this.engine.adapter.model;
        const node = model.get("node-by", { id });
        if (node?.type !== "tab" && node?.type !== "tabset") {
            return;
        }
        this.begin(
            event,
            "internal",
            node.type === "tab"
                ? { kind: "tab", tab: node }
                : { kind: "tabset", tabset: node },
        );
        if (!dragImage) {
            return;
        }
        let x = 10;
        let y = 10;
        const parent = model.get("node-parent-by", { nodeId: id });
        const inSideBorder =
            parent?.type === "border" &&
            (parent.location === "left" || parent.location === "right");
        if (node.type === "tab" && !inSideBorder) {
            // keep the grab point: the image is offset by the pointer position within the element
            const r = this.engine.adapter.rectInLayout(
                dragImage as HTMLElement,
            );
            const root = this.engine.adapter.getDomRect();
            x = event.clientX - root.x - r.x;
            y = event.clientY - root.y - r.y;
        }
        event.dataTransfer?.setDragImage(dragImage, x, y);
    };

    /**
     * Attaches the native drag listeners to a layout root, and the document listeners that end the
     * page's drag on every `dragend` and `drop` (a drop into an input, a drag released outside).
     * Returns the function that detaches them.
     */
    attach(element: HTMLElement): () => void {
        const doc = element.ownerDocument;
        const onDragEnter = (event: DragEvent) => this.onDragEnter(event);
        const onDragLeave = (event: DragEvent) => this.onDragLeave(event);
        const onDragOver = (event: DragEvent) => this.onDragOver(event);
        const onDrop = (event: DragEvent) => this.onDrop(event);
        element.addEventListener("dragenter", onDragEnter);
        element.addEventListener("dragleave", onDragLeave);
        element.addEventListener("dragover", onDragOver);
        element.addEventListener("drop", onDrop);
        // after the targets handled it (bubble phase on the document): whatever received the drop,
        // the drag is over
        const onDocumentEnd = () => {
            this.clearDragLocal();
            DragDropManager.endDrag();
        };
        doc.addEventListener("dragend", onDocumentEnd);
        doc.addEventListener("drop", onDocumentEnd);
        const model = this.engine.adapter.model;
        const main = this.engine.adapter.main === this.engine;
        if (main) {
            const managers = DragDropManager.attachedMains.get(model) ?? [];
            managers.push(this);
            DragDropManager.attachedMains.set(model, managers);
        }
        return () => {
            if (main) {
                const managers = DragDropManager.attachedMains.get(model);
                const index = managers?.indexOf(this) ?? -1;
                if (index >= 0) {
                    managers?.splice(index, 1);
                }
            }
            element.removeEventListener("dragenter", onDragEnter);
            element.removeEventListener("dragleave", onDragLeave);
            element.removeEventListener("dragover", onDragOver);
            element.removeEventListener("drop", onDrop);
            doc.removeEventListener("dragend", onDocumentEnd);
            doc.removeEventListener("drop", onDocumentEnd);
            this.clearDragLocal();
        };
    }

    // *********************************************************************************
    // Native drag events on the layout root
    // *********************************************************************************

    /** the managers of every layout of this model: the main one and the popout windows' */
    private managers(): DragDropManager[] {
        const main = this.engine.adapter.main;
        const managers = [main.adapter.getDragDropManager()];
        const popouts = main.adapter.getPopoutManager();
        for (const layoutId of popouts.getOpenLayoutIds()) {
            const manager = popouts
                .getLayoutEngine(layoutId)
                ?.adapter.getDragDropManager();
            if (manager) {
                managers.push(manager);
            }
        }
        return managers;
    }

    /** a drag is over one of this model's layouts */
    private anyDragging(): boolean {
        return this.managers().some((manager) => manager.indicator.dragging);
    }

    /** decides which layout is the active drop target: the one the pointer is in */
    private updateActive(event: DragEventLike) {
        const managers = this.managers();
        // windows first: a popout is its own document, so at most one layout has the pointer
        const found = [...managers.slice(1), managers[0]].find(
            (manager) => manager && manager.dragEnterCount > 0,
        );
        for (const manager of managers) {
            manager.setActive(manager === found, event);
        }
    }

    private setActive(active: boolean, event: DragEventLike) {
        if (this.active !== active) {
            this.active = active;
            if (active) {
                this.activate(event);
            } else {
                this.deactivate();
            }
        }
    }

    /** `dragenter` on the layout root */
    private onDragEnter(event: DragEventLike) {
        const state = DragDropManager.dragState;
        if (state && state.source !== "external" && isForeignDrag(event)) {
            // a drag that is not Dockable's while a stale state lingers (its dragend never came)
            DragDropManager.endDrag();
        }
        // ask onExternalDrag once per entry into this layout: dragenter also bubbles from every
        // child the pointer crosses, which the enter count already tracks
        if (
            !DragDropManager.dragState &&
            this.dragEnterCount === 0 &&
            !hasOwnPayload(event)
        ) {
            const external = this.engine.adapter.getOnExternalDrag()?.(event);
            if (external) {
                this.setDrag(
                    "external",
                    { kind: "new", tab: external.tab },
                    external.onDrop,
                );
            }
        }
        this.dragEnterCount++;
        this.updateActive(event);
    }

    /** `dragleave` on the layout root */
    private onDragLeave(event: DragEventLike) {
        this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
        this.updateActive(event);
    }

    private clearDragMain() {
        this.setPointerOnAllWindows(true);
        for (const manager of this.managers()) {
            manager.clearDragLocal();
        }
    }

    private clearDragLocal() {
        this.dragEnterCount = 0;
        this.active = false;
        this.clearDragLocalVisuals();
    }

    private clearDragLocalVisuals() {
        this.target = undefined;
        this.setIndicator(this.idleIndicator());
    }

    // FlexLayout shows a transparent overlay over every window during a drag; only its pointer
    // guard is kept: iframes must not swallow the drag events
    private setPointerOnAllWindows(enable: boolean) {
        const docs = new Set<Document>();
        for (const manager of this.managers()) {
            const doc = manager.engine.get("owner-document");
            if (doc) {
                docs.add(doc);
            }
        }
        for (const doc of docs) {
            enablePointerOnIFrames(enable, doc);
        }
    }

    /** a drag that started in another model's layout (a drag group transfer) */
    private fromOtherModel(state: DragState): boolean {
        return state.mainEngine.adapter.model !== this.engine.adapter.model;
    }

    /**
     * whether the page's drag is one this layout takes: its model's, or a tab of another model
     * whose layout is in this layout's drag group
     */
    private belongsToDrag(event?: DragEventLike): boolean {
        const state = DragDropManager.dragState;
        if (
            !state ||
            (event && state.source !== "external" && isForeignDrag(event))
        ) {
            return false;
        }
        return (
            !this.fromOtherModel(state) ||
            (state.source === "internal" &&
                state.subject.kind === "tab" &&
                this.engine.adapter.getDragGroup()?.has(state.mainEngine) ===
                    true)
        );
    }

    /** the pointer entered this layout during a drag it takes */
    private activate(event: DragEventLike) {
        const state = DragDropManager.dragState;
        if (!state || !this.belongsToDrag()) {
            return;
        }
        event.preventDefault();
        this.target = undefined;
        this.setPointerOnAllWindows(false);
        const showEdges =
            this.engine.adapter.model.get("maximized-tabset", {
                layoutId: this.engine.layoutId,
            }) === undefined &&
            resolveLayout(this.engine.adapter.model.state.defaults).edgeDock;
        const root = this.engine.adapter.getFreshDomRect();
        // the outline starts as a 1x1 rect at the pointer (a view may animate from it)
        this.setIndicator({
            ...this.idleIndicator(),
            rect: rect(event.clientX - root.x, event.clientY - root.y, 1, 1),
            dragging: true,
            dragNodeId: state.dragId,
            showEdges,
        });
    }

    /** the pointer left this layout during a drag it takes */
    private deactivate() {
        if (!this.belongsToDrag()) {
            return;
        }
        this.clearDragLocalVisuals();
        const external = DragDropManager.dragState?.source === "external";
        if (
            (this.engine.is("main-layout") || external) &&
            !this.anyDragging()
        ) {
            this.clearDragMain();
            DragDropManager.endExternalDragOutside();
        }
    }

    /** the command a drop at `candidate` runs for the page's drag (none for a self drop) */
    private commandFor(
        state: DragState,
        candidate: DropCandidate,
    ): DropCommand | undefined {
        if (candidate.self) {
            return undefined;
        }
        const placement = {
            to: candidate.target,
            location: candidate.location,
            index: candidate.index,
        };
        const subject = state.subject;
        if (subject.kind === "tabset") {
            return {
                command: "tabset.move",
                payload: { tabsetId: subject.tabset.id, ...placement },
            };
        }
        if (subject.kind === "new") {
            return {
                command: "tab.add",
                payload: { ...(subject.tab as TabInit), ...placement },
            };
        }
        return {
            command: this.fromOtherModel(state) ? "transfer" : "tab.move",
            payload: { tabId: subject.tab.id, ...placement },
        };
    }

    /** whether the model accepts a command (asked once per candidate during a drag) */
    private accepts(state: DragState, command: DropCommand): boolean {
        // the subject is the drag's: within one drag and its models' states, the placement decides
        const model = this.engine.adapter.model;
        const source = state.mainEngine.adapter.model;
        if (
            this.verdictsFor !== state ||
            this.verdictsState !== model.state ||
            this.verdictsSourceState !== source.state
        ) {
            this.verdictsFor = state;
            this.verdictsState = model.state;
            this.verdictsSourceState = source.state;
            this.verdicts = new Map();
        }
        const { to, location, index } = command.payload;
        const key = `${command.command}|${to}|${location}|${index}`;
        let verdict = this.verdicts.get(key);
        if (verdict === undefined) {
            verdict = this.ask(source, command);
            this.verdicts.set(key, verdict);
        }
        return verdict;
    }

    private ask(source: Model<AnyTypes>, command: DropCommand): boolean {
        const model = this.engine.adapter.model;
        switch (command.command) {
            case "tab.move":
                return model.can("tab.move", command.payload);
            case "tabset.move":
                return model.can("tabset.move", command.payload);
            case "tab.add":
                return model.can("tab.add", command.payload);
            case "transfer": {
                const { tabId, ...placement } = command.payload;
                const plan = transferPlan(source, model, tabId, placement);
                return plan !== undefined && canTransfer(source, model, plan);
            }
        }
    }

    /** `dragover` on the layout root */
    private onDragOver(event: DragEventLike) {
        const state = DragDropManager.dragState;
        if (!state || !this.active || !this.belongsToDrag(event)) {
            return;
        }
        const root = this.engine.adapter.getFreshDomRect();
        const x = event.clientX - root.x;
        const y = event.clientY - root.y;

        const revealedBorder = this.borderToReveal(x, y);
        const model = this.engine.adapter.model;
        const candidates = dropCandidates({
            state: model.state,
            layoutId: this.engine.layoutId,
            maximized: model.get("maximized-tabset", {
                layoutId: this.engine.layoutId,
            }),
            geometry: this.geometry,
            subject: state.subject,
            x,
            y,
        });
        let accepted: DropCandidate | undefined;
        let refused: DropCandidate | undefined;
        let command: DropCommand | undefined;
        for (const candidate of candidates) {
            command = this.commandFor(state, candidate);
            if (!command || this.accepts(state, command)) {
                accepted = candidate;
                break;
            }
            refused ??= candidate;
        }
        if (!accepted) {
            // no target here: hide the outline, and report a target that refused the drop
            if (refused && event.dataTransfer) {
                event.dataTransfer.dropEffect = "none";
            }
            this.target = undefined;
            this.setIndicator({
                ...this.indicator,
                ...noTarget(refused),
                revealedBorder,
            });
            return;
        }
        event.preventDefault(); // can drop so prevent default (which is cannot drop)
        if (state.isNewTab() && event.dataTransfer) {
            // a new tab is a copy of what was dragged (and a file drag allows no "move")
            event.dataTransfer.dropEffect = "copy";
        }
        this.target = command;
        this.setIndicator({
            ...this.indicator,
            visible: true,
            rect: accepted.rect,
            location: accepted.location,
            kind: accepted.kind,
            targetNodeId: accepted.target,
            targetTabSetId: accepted.container,
            index: accepted.index,
            refused: false,
            refusedTabSetId: undefined,
            revealedBorder,
        });
    }

    /**
     * Ported from FlexLayout's LayoutController.checkForBorderToShow: the auto-hide border (with no
     * tabs) whose edge of the main area the pointer is within the edge margin of, except over the
     * edge docking bands; undefined for none. Unlike FlexLayout, it resets when the drag ends.
     */
    private borderToReveal(
        x: number,
        y: number,
    ): DropIndicatorState["revealedBorder"] {
        if (!this.engine.is("main-layout")) {
            return undefined;
        }
        const state = this.engine.adapter.model.state;
        const r = this.engine.adapter.rect("row", state.root.id);
        if (!r || r.width === 0 || r.height === 0) {
            return undefined;
        }
        const settings = resolveLayout(state.defaults);
        const margin = settings.edgeDockMargin;
        const half = settings.edgeDockLength / 2;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const overEdge =
            settings.edgeDock &&
            this.indicator.revealedBorder === undefined &&
            (Math.abs(y - cy) < half || Math.abs(x - cx) < half);
        if (overEdge) {
            return undefined;
        }
        const location =
            x <= r.x + margin
                ? "left"
                : x >= r.x + r.width - margin
                  ? "right"
                  : y <= r.y + margin
                    ? "top"
                    : y >= r.y + r.height - margin
                      ? "bottom"
                      : undefined;
        const border = location
            ? state.borders.find((candidate) => candidate.location === location)
            : undefined;
        if (!location || !border) {
            return undefined;
        }
        const resolved = resolveBorder(state.defaults, border);
        if (
            !resolved.show ||
            !resolved.autoHide ||
            border.children.length > 0
        ) {
            return undefined;
        }
        return location;
    }

    /** `drop` on the layout root: runs the command of the target found during the hover */
    private onDrop(event: DragEventLike) {
        const state = DragDropManager.dragState;
        if (state && this.active && this.belongsToDrag(event)) {
            event.preventDefault();
            if (this.target) {
                this.runDrop(state, this.target, event);
            }
            this.clearDragMain();
            if (this.fromOtherModel(state)) {
                // a drag from another layout of the group: clear the source's layouts too
                state.mainEngine.adapter.getDragDropManager().clearDragMain();
            }
            DragDropManager.setDragState(undefined);
        }
        // whatever the drop was, this layout's hover state is over
        this.clearDragLocal();
    }

    private runDrop(
        state: DragState,
        target: DropCommand,
        event: DragEventLike,
    ) {
        const model = this.engine.adapter.model;
        switch (target.command) {
            case "transfer": {
                const { tabId, ...placement } = target.payload;
                this.engine.adapter
                    .getDragGroup()
                    ?.transferTab(
                        state.mainEngine,
                        this.engine,
                        tabId,
                        placement,
                    );
                return;
            }
            case "tab.add": {
                const result = model.run("tab.add", target.payload);
                state.onNewTabDropped?.(
                    result.ok ? result.value.tabId : undefined,
                    event,
                );
                return;
            }
            case "tabset.move":
                model.run("tabset.move", target.payload);
                return;
            case "tab.move":
                model.run("tab.move", target.payload);
        }
    }

    /** hides this layout's outline without ending the drag (the pointer is over a drop zone) */
    private hideIndicator() {
        if (this.indicator.visible || this.indicator.refused) {
            this.target = undefined;
            this.setIndicator({ ...this.indicator, ...noTarget() });
        }
    }

    // *********************************************************************************
    // Drop zones
    // *********************************************************************************

    /**
     * Makes `element` (anywhere in the document) a drop zone for drags of `model`'s layouts. While a
     * drag the zone accepts is over it, the layouts show no outline, and a drop calls `onDrop`
     * instead of moving anything. Returns the function that unregisters the zone.
     */
    static registerDropZone<T extends DockableTypes>(
        model: Model<T>,
        element: Element,
        options: DropZoneOptions<T>,
    ): () => void {
        const zone: DropZone = {
            options: options as unknown as DropZoneOptions<AnyTypes>,
            enterCount: 0,
            over: false,
        };
        DragDropManager.dropZones.add(zone);
        const owner: object = model;
        const accepts = () => {
            const state = DragDropManager.dragState;
            return (
                state !== undefined &&
                state.mainEngine.adapter.model === owner &&
                (zone.options.accepts?.(state.subject) ?? true)
            );
        };
        const onEnter = (event: Event) => {
            if (!accepts()) return;
            // the zone takes the drag: the layouts under or around it must not
            event.stopPropagation();
            event.preventDefault();
            zone.enterCount++;
            DragDropManager.setZoneOver(zone, true);
            DragDropManager.hideIndicators();
        };
        const onOver = (event: Event) => {
            if (!accepts()) return;
            event.stopPropagation();
            event.preventDefault();
            const dataTransfer = (event as DragEvent).dataTransfer;
            if (dataTransfer) {
                dataTransfer.dropEffect = DragDropManager.dragState?.isNewTab()
                    ? "copy"
                    : "move";
            }
            DragDropManager.setZoneOver(zone, true);
            DragDropManager.hideIndicators();
        };
        const onLeave = (event: Event) => {
            if (!zone.over) return;
            event.stopPropagation();
            zone.enterCount = Math.max(0, zone.enterCount - 1);
            if (zone.enterCount === 0) {
                DragDropManager.setZoneOver(zone, false);
                DragDropManager.endExternalDragOutside();
            }
        };
        const onDrop = (event: Event) => {
            const state = DragDropManager.dragState;
            if (!state || !accepts()) return;
            event.stopPropagation();
            event.preventDefault();
            DragDropManager.setZoneOver(zone, false);
            zone.options.onDrop(state.subject, event as DragEvent);
            // the drag is over: the source's dragend (if any) finds nothing left to end
            DragDropManager.endDrag();
        };
        element.addEventListener("dragenter", onEnter);
        element.addEventListener("dragover", onOver);
        element.addEventListener("dragleave", onLeave);
        element.addEventListener("drop", onDrop);
        return () => {
            element.removeEventListener("dragenter", onEnter);
            element.removeEventListener("dragover", onOver);
            element.removeEventListener("dragleave", onLeave);
            element.removeEventListener("drop", onDrop);
            DragDropManager.dropZones.delete(zone);
        };
    }

    /**
     * An external drag's source is outside the page, so no dragend ends it: it ends once it is over
     * no layout and no drop zone.
     */
    private static endExternalDragOutside() {
        const state = DragDropManager.dragState;
        if (
            state?.source === "external" &&
            ![...DragDropManager.dropZones].some((zone) => zone.over) &&
            !state.mainEngine.adapter.getDragDropManager().anyDragging()
        ) {
            DragDropManager.endDrag();
        }
    }

    private static setZoneOver(zone: DropZone, over: boolean) {
        if (zone.over !== over) {
            zone.over = over;
            zone.options.onOverChange?.(over);
        }
    }

    private static hideIndicators() {
        const main = DragDropManager.dragState?.mainEngine.adapter;
        for (const manager of main?.getDragDropManager().managers() ?? []) {
            manager.hideIndicator();
        }
    }

    /** Releases the indicator's listeners. */
    dispose() {
        this.listeners.clear();
    }
}

/**
 * Lost drag fallback: `dragend` is dispatched on the drag source, so it never arrives when the
 * source unmounts mid-drag. A pointer move with no button held, or a new press, ends the drag.
 * Returns the function that removes the guard.
 */
function lostDragGuard(doc: Document): () => void {
    const onPointerDown = () => DragDropManager.endDrag();
    const onPointerMove = (event: PointerEvent) => {
        if (event.buttons === 0) {
            DragDropManager.endDrag();
        }
    };
    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("pointermove", onPointerMove, true);
    return () => {
        doc.removeEventListener("pointerdown", onPointerDown, true);
        doc.removeEventListener("pointermove", onPointerMove, true);
    };
}
