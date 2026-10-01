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
    type DropSubjectKind,
    dropCandidates,
} from "../drop/resolve";
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { DockLocation } from "../geometry/dock";
import { EMPTY_RECT, type Rect, rect, rectEquals } from "../geometry/rect";
import { enablePointerOnIFrames } from "../splitter/SplitterController";
import { resolveBorder, resolveLayout, resolveTabset } from "../state/defaults";
import type { TabInit, TabInitOf } from "../state/json";
import type { Model } from "../state/model";
import type { AnyState } from "../state/tree";
import type {
    AnyTypes,
    DockableTypes,
    TabOf,
    TabsetNode,
} from "../state/types";

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
    element: Element;
    model: object;
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
        return sameModel(this.mainEngine.adapter.model, model)
            ? (this.subject as unknown as DragSubject<T>)
            : undefined;
    }
}

/** whether two models (of any registries) are the same object */
function sameModel(a: object, b: object): boolean {
    return a === b;
}

function hasOwnPayload(event: DragEventLike): boolean {
    const types = event.dataTransfer?.types;
    return !!types && Array.from(types).includes(DRAG_TYPE);
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

/** A command a drop runs, as the manager prepares it. */
type DropCommand =
    | { command: "tab.move"; payload: PayloadOf<AnyTypes, "tab.move"> }
    | { command: "tabset.move"; payload: PayloadOf<AnyTypes, "tabset.move"> }
    | { command: "tab.add"; payload: PayloadOf<AnyTypes, "tab.add"> };

/**
 * The drag-and-drop state machine of one layout engine, working on native drag events. The static
 * {@link DragState} is shared across every engine and window of the page, so a drag can cross
 * layouts (popouts participate in the same drag).
 */
export class DragDropManager<T extends DockableTypes = AnyTypes> {
    private static dragState: DragState | undefined = undefined;
    private static readonly dragListeners = new Set<() => void>();
    private static readonly dropZones = new Set<DropZone>();
    /** the managers of the main layouts attached to the page, by model (latest last) */
    private static readonly attachedMains = new WeakMap<
        object,
        DragDropManager<AnyTypes>[]
    >();

    private readonly engine: LayoutEngine<T>;
    private dragEnterCount = 0;
    private dragging = false;
    private active = false;
    private target: DropCommand | "self" | undefined;
    private indicator: DropIndicatorState;
    private readonly listeners = new Set<() => void>();
    private removeLostDragGuard: (() => void) | undefined;
    /** the model's answers during the current drag, by candidate (the state does not change mid-drag) */
    private verdicts = new Map<string, boolean>();
    private verdictsFor: DragState | undefined;
    private verdictsState: unknown;

    constructor(engine: LayoutEngine<T>) {
        this.engine = engine;
        this.indicator = this.idleIndicator();
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
     * page (a sidebar item, a palette entry): {@link startAddDrag} on the manager of the model's
     * attached main layout. Returns false, starting nothing, when no layout of `model` is attached.
     */
    static startAddDrag<T extends DockableTypes>(
        model: Model<T>,
        event: DragEventLike,
        tab: TabInitOf<T>,
        onDrop?: NewTabDropped,
        dragImage?: Element | null,
    ): boolean {
        const managers = DragDropManager.attachedMains.get(model);
        const manager = managers?.[managers.length - 1] as
            | DragDropManager<T>
            | undefined;
        if (!manager) {
            return false;
        }
        manager.startAddDrag(event, tab, onDrop, dragImage);
        return true;
    }

    /** Ends the page's drag, if any (a drag source's `dragend`). */
    static endDrag() {
        DragDropManager.dragState?.mainEngine.adapter
            .getDragDropManager()
            .onDragEnded();
    }

    private static setDragState(state: DragState | undefined) {
        if (DragDropManager.dragState === state) {
            return;
        }
        DragDropManager.dragState = state;
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
        if (
            prev.visible === next.visible &&
            rectEquals(prev.rect, next.rect) &&
            prev.location === next.location &&
            prev.kind === next.kind &&
            prev.dragging === next.dragging &&
            prev.dragNodeId === next.dragNodeId &&
            prev.showEdges === next.showEdges &&
            prev.tabDragSpeed === next.tabDragSpeed &&
            prev.targetNodeId === next.targetNodeId &&
            prev.targetTabSetId === next.targetTabSetId &&
            prev.index === next.index &&
            prev.refused === next.refused &&
            prev.refusedTabSetId === next.refusedTabSetId &&
            prev.revealedBorder === next.revealedBorder
        ) {
            return;
        }
        this.indicator = next;
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    // *********************************************************************************
    // Starting and ending a drag
    // *********************************************************************************

    /** center drops are not offered for a tabset that can never merge (cannot close, or holds pinned tabs) */
    private isExcludeCenter(subject: DragSubject<AnyTypes>): boolean {
        if (subject.kind !== "tabset") {
            return false;
        }
        const tabset = subject.tabset;
        const flags = resolveTabset(this.state().defaults, tabset);
        return (
            !flags.enableClose ||
            tabset.children.some((tab) => tab.pinned === true)
        );
    }

    private state(): AnyState {
        return this.engine.adapter.model.state as unknown as AnyState;
    }

    private begin(
        event: DragEventLike,
        source: DragSourceKind,
        subject: DragSubject<AnyTypes>,
        onNewTabDropped?: NewTabDropped,
    ) {
        DragDropManager.setDragState(
            new DragState(
                this.engine.adapter.main as unknown as LayoutEngine<AnyTypes>,
                source,
                subject,
                onNewTabDropped,
            ),
        );
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
        this.dragEnterCount = 0;
        this.installLostDragGuard();
    }

    /**
     * Starts dragging a tab or a whole tabset of this layout (by id). Call from the source's
     * `dragstart`. `dragImage` is the element the browser snapshots; with none, the browser default.
     */
    startDrag = (
        event: DragEventLike,
        id: string,
        dragImage?: Element | null,
    ) => {
        const node = this.engine.adapter.model.get("node", { node: id });
        if (node?.type !== "tab" && node?.type !== "tabset") {
            return;
        }
        const subject: DragSubject<AnyTypes> =
            node.type === "tab"
                ? { kind: "tab", tab: node as unknown as TabOf<AnyTypes> }
                : {
                      kind: "tabset",
                      tabset: node as unknown as TabsetNode<AnyTypes>,
                  };
        this.begin(event, "internal", subject);
        if (!dragImage) {
            return;
        }
        let x = 10;
        let y = 10;
        const parent = this.engine.adapter.model.get("parent", { node: id });
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
     * Starts dragging a new tab from a consumer element (a sidebar item, a palette entry). Call
     * from the element's `dragstart`, and {@link onDragEnded} from its `dragend`. A drop runs
     * `tab.add`, then calls `onDrop` with the new tab's id.
     */
    startAddDrag = (
        event: DragEventLike,
        tab: TabInitOf<T>,
        onDrop?: NewTabDropped,
        dragImage?: Element | null,
    ) => {
        this.begin(
            event,
            "add",
            { kind: "new", tab: tab as TabInitOf<AnyTypes> },
            onDrop,
        );
        if (dragImage) {
            event.dataTransfer?.setDragImage(dragImage, 10, 10);
        }
    };

    /** Asks the main engine's `onExternalDrag` whether a foreign drag can be dropped here. */
    private startExternalDrag(event: DragEventLike) {
        const external = this.engine.adapter.getOnExternalDrag()?.(event);
        if (!external) {
            return;
        }
        DragDropManager.setDragState(
            new DragState(
                this.engine.adapter.main as unknown as LayoutEngine<AnyTypes>,
                "external",
                { kind: "new", tab: external.tab as TabInitOf<AnyTypes> },
                external.onDrop,
            ),
        );
        this.installLostDragGuard();
    }

    /** Ends the drag. Called on `dragend` from the drag source, or by the lost drag fallback. */
    onDragEnded = () => {
        this.clearDragMain();
        this.removeLostDragGuard?.();
        DragDropManager.setDragState(undefined);
    };

    /**
     * Lost drag fallback: `dragend` is dispatched on the drag source, so it never arrives when the
     * source unmounts mid-drag. A pointer move with no button held, or a new press, ends a drag
     * that is still registered.
     */
    private installLostDragGuard() {
        this.removeLostDragGuard?.();
        const doc = this.engine.get("owner-document");
        if (!doc) {
            return;
        }
        const state = DragDropManager.dragState;
        const end = () => {
            remove();
            if (DragDropManager.dragState === state) {
                this.onDragEnded();
            }
        };
        const onPointerMove = (event: PointerEvent) => {
            if (event.buttons === 0) {
                end();
            }
        };
        const remove = () => {
            doc.removeEventListener("pointerdown", end, true);
            doc.removeEventListener("pointermove", onPointerMove, true);
            if (this.removeLostDragGuard === remove) {
                this.removeLostDragGuard = undefined;
            }
        };
        doc.addEventListener("pointerdown", end, true);
        doc.addEventListener("pointermove", onPointerMove, true);
        this.removeLostDragGuard = remove;
    }

    /**
     * Attaches the native drag listeners to a layout root, and the document listeners that end the
     * page's drag on every `dragend` and `drop` (a drop into an input, a drag released outside).
     * Returns the function that detaches them.
     */
    attach(element: HTMLElement): () => void {
        const doc = element.ownerDocument;
        const onDragEnter = (event: DragEvent) => this.onDragEnterRaw(event);
        const onDragLeave = (event: DragEvent) => this.onDragLeaveRaw(event);
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
            if (DragDropManager.dragState) {
                DragDropManager.dragState.mainEngine.adapter
                    .getDragDropManager()
                    .onDragEnded();
            }
        };
        doc.addEventListener("dragend", onDocumentEnd);
        doc.addEventListener("drop", onDocumentEnd);
        const self = this as unknown as DragDropManager<AnyTypes>;
        const main = this.engine.adapter.main === this.engine;
        if (main) {
            const managers =
                DragDropManager.attachedMains.get(this.engine.adapter.model) ??
                [];
            managers.push(self);
            DragDropManager.attachedMains.set(
                this.engine.adapter.model,
                managers,
            );
        }
        return () => {
            if (main) {
                const managers = DragDropManager.attachedMains.get(
                    this.engine.adapter.model,
                );
                const index = managers?.indexOf(self) ?? -1;
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
    private managers(): DragDropManager<T>[] {
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

    /** decides which layout is the active drop target: the one the pointer is in */
    updateActive(event: DragEventLike) {
        const managers = this.managers();
        // windows first: a popout is its own document, so at most one layout has the pointer
        const found = [...managers.slice(1), managers[0]].find(
            (manager) => manager && manager.getDragEnterCount() > 0,
        );
        for (const manager of managers) {
            manager.setActive(manager === found, event);
        }
    }

    setActive(active: boolean, event: DragEventLike) {
        if (this.active !== active) {
            this.active = active;
            if (this.active) {
                this.onDragEnter(event);
            } else {
                this.onDragLeave(event);
            }
        }
    }

    /** `dragenter` on the layout root */
    onDragEnterRaw = (event: DragEventLike) => {
        const state = DragDropManager.dragState;
        if (state && state.source !== "external" && isForeignDrag(event)) {
            // a drag that is not Dockable's while a stale state lingers (its dragend never came)
            state.mainEngine.adapter.getDragDropManager().onDragEnded();
        }
        // ask onExternalDrag once per entry into this layout: dragenter also bubbles from every
        // child the pointer crosses, which the enter count already tracks
        if (
            !DragDropManager.dragState &&
            this.dragEnterCount === 0 &&
            !hasOwnPayload(event)
        ) {
            this.startExternalDrag(event);
        }
        this.dragEnterCount++;
        this.updateActive(event);
    };

    /** `dragleave` on the layout root */
    onDragLeaveRaw = (event: DragEventLike) => {
        this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
        this.updateActive(event);
    };

    clearDragMain() {
        this.setPointerOnAllWindows(true);
        for (const manager of this.managers()) {
            manager.clearDragLocal();
        }
    }

    clearDragLocal() {
        this.dragEnterCount = 0;
        this.active = false;
        this.clearDragLocalVisuals();
    }

    clearDragLocalVisuals() {
        this.dragging = false;
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

    /** whether the page's drag is one this layout takes */
    private belongsToDrag(event?: DragEventLike): boolean {
        const state = DragDropManager.dragState;
        if (!state) {
            return false;
        }
        if (event && state.source !== "external" && isForeignDrag(event)) {
            return false; // not Dockable's drag
        }
        if (
            sameModel(state.mainEngine.adapter.model, this.engine.adapter.model)
        ) {
            return true;
        }
        return this.isGroupTransfer(state);
    }

    /** a drag of a tab of another model whose layout is in this layout's drag group */
    private isGroupTransfer(state: DragState): boolean {
        const group = this.engine.adapter.getDragGroup();
        return (
            group !== undefined &&
            state.source === "internal" &&
            state.subject.kind === "tab" &&
            !sameModel(
                state.mainEngine.adapter.model,
                this.engine.adapter.model,
            ) &&
            group.has(state.mainEngine)
        );
    }

    onDragEnter = (event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        const state = DragDropManager.dragState;
        if (!state) {
            return;
        }
        event.preventDefault();
        this.target = undefined;
        this.dragging = true;
        this.setPointerOnAllWindows(false);

        const layout = this.engine.layoutId;
        const settings = resolveLayout(this.state().defaults);
        const showEdges =
            this.engine.adapter.model.get("maximized-tabset", { layout }) ===
                undefined && settings.edgeDock;
        const root = this.engine.adapter.getFreshDomRect();
        // the outline starts as a 1x1 rect at the pointer (a view may animate from it)
        this.setIndicator({
            visible: false,
            rect: rect(event.clientX - root.x, event.clientY - root.y, 1, 1),
            location: "center",
            kind: "rect",
            dragging: true,
            dragNodeId: state.dragId,
            showEdges,
            tabDragSpeed: this.engine.adapter.getTabDragSpeed(),
            targetNodeId: undefined,
            targetTabSetId: undefined,
            index: -1,
            refused: false,
            refusedTabSetId: undefined,
            revealedBorder: undefined,
        });
    };

    /** the rects the drop resolution reads, from this layout's engine */
    private geometry(): DropGeometry {
        const engine = this.engine;
        return {
            node: (id) =>
                engine.adapter.rect("row", id) ??
                engine.adapter.rect("tabset", id),
            tabStrip: (id) => engine.adapter.rect("tabstrip", id),
            content: (id) => engine.adapter.rect("tabsetcontent", id),
            tabButton: (id) => engine.adapter.rect("tabbutton", id),
            borderStrip: (id) => engine.adapter.rect("borderheader", id),
            borderContent: (id) => engine.adapter.rect("bordercontent", id),
        };
    }

    /** the command a drop at `candidate` runs for the page's drag */
    private commandFor(
        state: DragState,
        candidate: DropCandidate,
    ): DropCommand {
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
        if (
            !sameModel(
                state.mainEngine.adapter.model,
                this.engine.adapter.model,
            )
        ) {
            // a drag group transfer: the target adds the tab (with its id when it is free)
            const tab = subject.tab;
            const { type: _type, ...fields } = tab;
            const payload = this.engine.adapter.model.get("node", {
                node: tab.id,
            })
                ? { ...fields, id: undefined }
                : fields;
            return {
                command: "tab.add",
                payload: { ...(payload as TabInit), ...placement },
            };
        }
        return {
            command: "tab.move",
            payload: { tabId: subject.tab.id, ...placement },
        };
    }

    /** whether the model accepts a command (asked once per candidate during a drag) */
    private accepts(state: DragState, command: DropCommand): boolean {
        // the subject is the drag's: within one drag and one state, the placement decides
        const model = this.engine.adapter.model as unknown as Model<AnyTypes>;
        if (this.verdictsFor !== state || this.verdictsState !== model.state) {
            this.verdictsFor = state;
            this.verdictsState = model.state;
            this.verdicts = new Map();
        }
        const { to, location, index } = command.payload;
        const key = `${command.command}|${to}|${location}|${index}`;
        let verdict = this.verdicts.get(key);
        if (verdict === undefined) {
            // a tab of another model of the drag group: asked as its transfer will run, with the
            // same `meta.transfer` (TransferMeta), so a rule on it holds during the hover too
            const subject = state.subject;
            const transfer =
                subject.kind === "tab" &&
                !sameModel(
                    state.mainEngine.adapter.model,
                    this.engine.adapter.model,
                )
                    ? {
                          meta: {
                              transfer: {
                                  tabId: subject.tab.id,
                                  from: state.mainEngine.adapter.model,
                                  to: this.engine.adapter.model,
                              },
                          },
                      }
                    : undefined;
            verdict =
                command.command === "tab.move"
                    ? model.can("tab.move", command.payload)
                    : command.command === "tabset.move"
                      ? model.can("tabset.move", command.payload)
                      : model.can("tab.add", command.payload, transfer) &&
                        // a transfer also closes the tab in its own model: that must be allowed too
                        (transfer === undefined ||
                            subject.kind !== "tab" ||
                            state.mainEngine.adapter.model.can(
                                "tab.close",
                                { tabId: subject.tab.id },
                                transfer,
                            ));
            this.verdicts.set(key, verdict);
        }
        return verdict;
    }

    onDragOver = (event: DragEventLike) => {
        if (!this.belongsToDrag(event) || !this.active) {
            return;
        }
        const state = DragDropManager.dragState;
        if (!state) {
            return;
        }
        const root = this.engine.adapter.getFreshDomRect();
        const x = event.clientX - root.x;
        const y = event.clientY - root.y;

        const revealedBorder = this.borderToReveal(x, y);
        if (revealedBorder !== this.indicator.revealedBorder) {
            this.setIndicator({ ...this.indicator, revealedBorder });
        }
        const subject = state.subject;
        const kind: DropSubjectKind =
            subject.kind === "tab"
                ? {
                      kind: "tab",
                      id: subject.tab.id,
                      pinned: subject.tab.pinned === true,
                  }
                : subject.kind === "tabset"
                  ? { kind: "tabset", id: subject.tabset.id }
                  : { kind: "new", pinned: subject.tab.pinned === true };
        const candidates = dropCandidates(
            this.state(),
            this.engine.layoutId,
            this.geometry(),
            kind,
            x,
            y,
            { excludeCenter: this.isExcludeCenter(subject) },
        );
        let accepted: DropCandidate | undefined;
        let refused: DropCandidate | undefined;
        let command: DropCommand | "self" | undefined;
        for (const candidate of candidates) {
            if (candidate.self) {
                accepted = candidate;
                command = "self";
                break;
            }
            const next = this.commandFor(state, candidate);
            if (this.accepts(state, next)) {
                accepted = candidate;
                command = next;
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
                visible: false,
                targetNodeId: undefined,
                targetTabSetId: undefined,
                index: -1,
                refused: refused !== undefined,
                refusedTabSetId: refused?.container,
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
        });
    };

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
        const state = this.state();
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

    onDragLeave = (_event: DragEventLike) => {
        if (!this.belongsToDrag()) {
            return;
        }
        this.clearDragLocalVisuals();
        // an external drag's source is outside the page, so no dragend ends it: it ends when it
        // has left every layout
        const external = DragDropManager.dragState?.source === "external";
        if (this.engine.is("main-layout") || external) {
            const anyDragging = this.managers().some((manager) =>
                manager.isDragging(),
            );
            if (!anyDragging) {
                this.clearDragMain();
                if (external && !DragDropManager.isOverAnyZone()) {
                    this.onDragEnded();
                }
            }
        }
    };

    /** `drop` on the layout root: runs the command of the target found during the hover */
    onDrop = (event: DragEventLike) => {
        const state = DragDropManager.dragState;
        const target = this.target;
        if (state && this.belongsToDrag(event) && this.active) {
            event.preventDefault();
            if (target && target !== "self") {
                this.runDrop(state, target, event);
            }
            this.clearDragMain();
            this.removeLostDragGuard?.();
            if (
                !sameModel(
                    state.mainEngine.adapter.model,
                    this.engine.adapter.model,
                )
            ) {
                // a drag from another layout of the group: clear the source's layouts too
                state.mainEngine.adapter.getDragDropManager().clearDragMain();
            }
            DragDropManager.setDragState(undefined);
        }
        // whatever the drop was, this layout's hover state is over
        this.clearDragLocal();
    };

    private runDrop(
        state: DragState,
        target: DropCommand,
        event: DragEventLike,
    ) {
        const model = this.engine.adapter.model as unknown as Model<AnyTypes>;
        if (
            this.isGroupTransfer(state) &&
            state.subject.kind === "tab" &&
            target.command === "tab.add"
        ) {
            const group = this.engine.adapter.getDragGroup();
            group?.transferTab(
                state.mainEngine,
                this.engine as unknown as LayoutEngine<AnyTypes>,
                state.subject.tab.id,
                target.payload.to,
                target.payload.location ?? "center",
                target.payload.index ?? -1,
            );
            return;
        }
        if (target.command === "tab.add") {
            const result = model.run("tab.add", target.payload);
            state.onNewTabDropped?.(
                result.ok ? result.value.tabId : undefined,
                event,
            );
        } else if (target.command === "tabset.move") {
            model.run("tabset.move", target.payload);
        } else {
            model.run("tab.move", target.payload);
        }
    }

    /** Hides this layout's outline without ending the drag (the pointer is over a drop zone). */
    hideIndicator() {
        this.target = undefined;
        if (this.indicator.visible || this.indicator.refused) {
            this.setIndicator({
                ...this.indicator,
                visible: false,
                targetNodeId: undefined,
                targetTabSetId: undefined,
                index: -1,
                refused: false,
                refusedTabSetId: undefined,
            });
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
            element,
            model,
            options: options as unknown as DropZoneOptions<AnyTypes>,
            enterCount: 0,
            over: false,
        };
        DragDropManager.dropZones.add(zone);
        const accepts = () => {
            const state = DragDropManager.dragState;
            return (
                state !== undefined &&
                sameModel(state.mainEngine.adapter.model, model) &&
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
            DragDropManager.hideIndicators(model);
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
            DragDropManager.hideIndicators(model);
        };
        const onLeave = (event: Event) => {
            if (!zone.over) return;
            event.stopPropagation();
            zone.enterCount = Math.max(0, zone.enterCount - 1);
            if (zone.enterCount === 0) {
                DragDropManager.setZoneOver(zone, false);
                DragDropManager.endExternalDragOutside(model);
            }
        };
        const onDrop = (event: Event) => {
            const state = DragDropManager.dragState;
            if (!accepts() || !state) return;
            event.stopPropagation();
            event.preventDefault();
            DragDropManager.setZoneOver(zone, false);
            zone.options.onDrop(state.subject, event as DragEvent);
            // the drag is over: the source's dragend (if any) finds nothing left to end
            state.mainEngine.adapter.getDragDropManager().clearDragMain();
            DragDropManager.setDragState(undefined);
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

    private static isOverAnyZone(): boolean {
        for (const zone of DragDropManager.dropZones) {
            if (zone.over) return true;
        }
        return false;
    }

    /** an external drag that leaves a drop zone for no layout and no zone is over */
    private static endExternalDragOutside(model: object) {
        const state = DragDropManager.dragState;
        if (
            state?.source !== "external" ||
            state.mainEngine.adapter.model !== model ||
            DragDropManager.isOverAnyZone()
        ) {
            return;
        }
        const manager = state.mainEngine.adapter.getDragDropManager();
        if (manager.managers().some((m) => m.isDragging())) return;
        manager.onDragEnded();
    }

    private static setZoneOver(zone: DropZone, over: boolean) {
        if (zone.over !== over) {
            zone.over = over;
            zone.options.onOverChange?.(over);
        }
    }

    private static hideIndicators(model: object) {
        const state = DragDropManager.dragState;
        if (state?.mainEngine.adapter.model !== model) {
            return;
        }
        for (const manager of state.mainEngine.adapter
            .getDragDropManager()
            .managers()) {
            manager.hideIndicator();
        }
    }

    getDragEnterCount() {
        return this.dragEnterCount;
    }

    isDragging() {
        return this.dragging;
    }

    /** Detaches the lost drag guard. */
    dispose() {
        this.removeLostDragGuard?.();
        this.listeners.clear();
    }
}
