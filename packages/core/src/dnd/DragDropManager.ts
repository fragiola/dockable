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
//   and every `drop` and `dragend` in the document ends the page's drag state, from the capture
//   phase (a drop the layout still has to run, once its dispatch is over), so content that stops
//   their propagation cannot leave a drag behind (caplin/FlexLayout#527);
// - "add" drags (a consumer element dragged in) and external drags (a foreign drag accepted by
//   `onExternalDrag`) drop through `tab.add`; a native drag that starts in a layout's own content
//   is the content's, never offered to `onExternalDrag` (caplin/FlexLayout#350, #497);
// - drop zones: consumer elements that take a layout drag and hand it to the consumer.

import { elementOf } from "../dom/nodes";
import {
    type DropCandidate,
    type DropGeometry,
    dropCandidates,
} from "../drop/resolve";
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { MeasurableKind } from "../engine/measure";
import { MOVEABLE_ATTRIBUTE } from "../engine/moveables";
import type { DockLocation } from "../geometry/dock";
import { EMPTY_RECT, type Rect, rect, rectEquals } from "../geometry/rect";
import { enablePointerOnIFrames } from "../splitter/SplitterController";
import { borderShown, resolveLayout } from "../state/defaults";
import type { TabInitOf } from "../state/json";
import type { Model } from "../state/model";
import type { AnyTypes, DockableTypes } from "../state/types";
import { type DropCommand, DropCommands } from "./dropCommand";
import { type DropZoneOptions, registerDropZone } from "./dropZones";
import {
    attachedMains,
    type DragEventLike,
    type DragSourceKind,
    DragState,
    type DragSubject,
    endDrag,
    endExternalDragOutside,
    getDragState,
    type NewTabDropped,
    setDragState,
    startAddDrag,
    subscribeDrag,
} from "./session";

/** The MIME type every Dockable drag carries; drags without it are not Dockable's. */
export const DRAG_TYPE = "application/x-dockable";

/** The drop location names. */
export type DropLocation = DockLocation;

/** What a drop outline represents: a drop into or beside a node (`rect`), or at a layout edge. */
export type DropKind = "rect" | "edge";

/** What a drop indicator shows. The same object is returned until it changes. */
export interface DropIndicatorSnapshot {
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
    readonly targetTabsetId: string | undefined;
    /** the insertion index in the target's tab strip, or -1 for a drop on the content area */
    readonly index: number;
    /** the pointer is over a target that refuses the drop (a rule of the layout, a middleware) */
    readonly refused: boolean;
    /** the id of the tabset (or border) that refused the drop, when it was one */
    readonly refusedTabsetId: string | undefined;
    /** an auto-hide border with no tabs that the drag reveals (main layout only) */
    readonly revealedBorder: Exclude<DropLocation, "center"> | undefined;
}

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
 * called when the drag enters a layout, when only `event.dataTransfer.types` is readable. A native
 * drag that starts in the content of one of the model's layouts is the content's: it is not asked.
 */
export type OnExternalDrag<T extends DockableTypes = AnyTypes> = (
    event: DragEventLike,
) => ExternalDrag<T> | undefined;

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
        targetTabsetId: undefined,
        index: -1,
        refused: refused !== undefined,
        refusedTabsetId: refused?.container,
    };
}

/**
 * The drag-and-drop state machine of one layout engine, working on native drag events. The static
 * {@link DragState} is shared across every engine and window of the page, so a drag can cross
 * layouts (popouts participate in the same drag).
 */
export class DragDropManager {
    private readonly engine: LayoutEngine<AnyTypes>;
    /** the rects the drop resolution reads, from this layout's engine */
    private readonly geometry: DropGeometry;
    private dragEnterCount = 0;
    private active = false;
    /** the page's current native drag started in this layout's content (a moveable element) */
    private contentDrag = false;
    private target: DropCommand | undefined;
    private indicator: DropIndicatorSnapshot;
    private readonly listeners = new Set<() => void>();
    private readonly commands: DropCommands;

    constructor(engine: LayoutEngine<AnyTypes>) {
        this.engine = engine;
        this.commands = new DropCommands(engine);
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
        return getDragState();
    }

    /** Calls `listener` when a drag starts or ends. Returns the unsubscribe function. */
    static subscribeDrag(listener: () => void): () => void {
        return subscribeDrag(listener);
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
        return startAddDrag(model, event, tab, onDrop, dragImage);
    }

    /** Ends the page's drag, if any (a drag source's `dragend`, or the lost drag fallback). */
    static endDrag() {
        endDrag();
    }

    // *********************************************************************************
    // Indicator state
    // *********************************************************************************

    /** The drop indicator of this layout. The same object is returned until it changes. */
    getIndicatorState = (): DropIndicatorSnapshot => this.indicator;

    /** Calls `listener` when the indicator changes. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private idleIndicator(): DropIndicatorSnapshot {
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
            targetTabsetId: undefined,
            index: -1,
            refused: false,
            refusedTabsetId: undefined,
            revealedBorder: undefined,
        };
    }

    private setIndicator(next: DropIndicatorSnapshot) {
        const prev = this.indicator;
        let key: keyof DropIndicatorSnapshot;
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
        // a fresh start for every layout of the model, popouts included: a drop a layout never saw
        // must not leave it "active" (caplin/FlexLayout#527)
        this.clearDragMain();
        setDragState(
            new DragState(this.engine.adapter.main, source, subject, onDrop),
            this.engine.get("owner-document"),
        );
    }

    /** @internal */
    begin(
        event: DragEventLike,
        source: DragSourceKind,
        subject: DragSubject,
        onDrop?: NewTabDropped,
    ) {
        this.setDrag(source, subject, onDrop);
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.setData(DRAG_TYPE, getDragState()?.dragId ?? "");
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
        // whatever received the drop, the drag is over. In the capture phase, so content that stops
        // the event's propagation (an editor taking a text or file drop) cannot keep it from the
        // layout (caplin/FlexLayout#527)
        const view = doc.defaultView;
        const onDocumentEnd = () => {
            this.contentDrag = false;
            this.clearDragLocal();
            endDrag();
        };
        // where each native drag starts: one from this layout's own content (selected text, a list
        // item of the app's own drag and drop) is the content's, not an external drag
        const onDocumentDragStart = (event: DragEvent) => {
            const moveable = elementOf(event.target)?.closest(
                `[${MOVEABLE_ATTRIBUTE}]`,
            );
            this.contentDrag = !!moveable && element.contains(moveable);
        };
        // a drag cancelled at its start sends no dragend: forget it once it is seen cancelled, or
        // else on the next press or pointer move with no button held (a native drag sends none)
        const onDocumentDragStarted = (event: DragEvent) => {
            if (event.defaultPrevented) {
                this.contentDrag = false;
            }
        };
        const onDocumentPointer = (event: PointerEvent) => {
            if (
                this.contentDrag &&
                (event.type === "pointerdown" || event.buttons === 0)
            ) {
                this.contentDrag = false;
            }
        };
        const onDocumentDrop = (event: DragEvent) => {
            this.contentDrag = false;
            const state = getDragState();
            if (!state || !this.active || !this.belongsToDrag(event)) {
                // a drop this layout does not run: only its hover state is left to clear
                this.clearDragLocal();
                return;
            }
            // the drop is still to be run, by the root or a drop zone, which end the drag. Content
            // that stops the drop's propagation keeps it from both, and a drag from outside the page
            // sends no dragend: a drag still in place once the event is dispatched is over
            view?.setTimeout(() => {
                if (getDragState() === state) {
                    this.clearDragMain();
                    endDrag();
                }
            }, 0);
        };
        doc.addEventListener("dragstart", onDocumentDragStart, true);
        doc.addEventListener("dragstart", onDocumentDragStarted);
        doc.addEventListener("pointerdown", onDocumentPointer, true);
        doc.addEventListener("pointermove", onDocumentPointer, true);
        doc.addEventListener("dragend", onDocumentEnd, true);
        doc.addEventListener("drop", onDocumentDrop, true);
        doc.addEventListener("drop", onDocumentEnd);
        const model = this.engine.adapter.model;
        const main = this.engine.adapter.main === this.engine;
        if (main) {
            const managers = attachedMains.get(model) ?? [];
            managers.push(this);
            attachedMains.set(model, managers);
        }
        return () => {
            if (main) {
                const managers = attachedMains.get(model);
                const index = managers?.indexOf(this) ?? -1;
                if (index >= 0) {
                    managers?.splice(index, 1);
                }
            }
            element.removeEventListener("dragenter", onDragEnter);
            element.removeEventListener("dragleave", onDragLeave);
            element.removeEventListener("dragover", onDragOver);
            element.removeEventListener("drop", onDrop);
            doc.removeEventListener("dragstart", onDocumentDragStart, true);
            doc.removeEventListener("dragstart", onDocumentDragStarted);
            doc.removeEventListener("pointerdown", onDocumentPointer, true);
            doc.removeEventListener("pointermove", onDocumentPointer, true);
            doc.removeEventListener("dragend", onDocumentEnd, true);
            doc.removeEventListener("drop", onDocumentDrop, true);
            doc.removeEventListener("drop", onDocumentEnd);
            this.clearDragLocal();
        };
    }

    // *********************************************************************************
    // Native drag events on the layout root
    // *********************************************************************************

    /** @internal the managers of every layout of this model: the main one and the popout windows' */
    managers(): DragDropManager[] {
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

    /** @internal a drag is over one of this model's layouts */
    anyDragging(): boolean {
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
        const state = getDragState();
        if (state && state.source !== "external" && isForeignDrag(event)) {
            // a drag that is not Dockable's while a stale state lingers (its dragend never came)
            endDrag();
        }
        // ask onExternalDrag once per entry into this layout: dragenter also bubbles from every
        // child the pointer crosses, which the enter count already tracks. A drag that started in
        // the content of a layout of this model is not external (caplin/FlexLayout#350, #497)
        if (
            !getDragState() &&
            this.dragEnterCount === 0 &&
            !hasOwnPayload(event) &&
            !this.managers().some((manager) => manager.contentDrag)
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

    /** @internal */
    clearDragMain() {
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

    /**
     * whether the page's drag is one this layout takes: its model's, or a tab of another model
     * whose layout is in this layout's drag group
     */
    private belongsToDrag(event?: DragEventLike): boolean {
        const state = getDragState();
        if (
            !state ||
            (event && state.source !== "external" && isForeignDrag(event))
        ) {
            return false;
        }
        return (
            !this.commands.fromOtherModel(state) ||
            (state.source === "internal" &&
                state.subject.kind === "tab" &&
                this.engine.adapter.getDragGroup()?.has(state.mainEngine) ===
                    true)
        );
    }

    /** the pointer entered this layout during a drag it takes */
    private activate(event: DragEventLike) {
        const state = getDragState();
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
        const external = getDragState()?.source === "external";
        if (
            (this.engine.is("main-layout") || external) &&
            !this.anyDragging()
        ) {
            this.clearDragMain();
            endExternalDragOutside();
        }
    }

    /** `dragover` on the layout root */
    private onDragOver(event: DragEventLike) {
        const state = getDragState();
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
            command = this.commands.commandFor(state, candidate);
            if (!command || this.commands.accepts(state, command)) {
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
            targetTabsetId: accepted.container,
            index: accepted.index,
            refused: false,
            refusedTabsetId: undefined,
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
    ): DropIndicatorSnapshot["revealedBorder"] {
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
        return border &&
            !borderShown(state.defaults, border, false) &&
            borderShown(state.defaults, border, true)
            ? location
            : undefined;
    }

    /** `drop` on the layout root: runs the command of the target found during the hover */
    private onDrop(event: DragEventLike) {
        const state = getDragState();
        if (state && this.active && this.belongsToDrag(event)) {
            event.preventDefault();
            if (this.target) {
                this.commands.runDrop(state, this.target, event);
            }
            this.clearDragMain();
            if (this.commands.fromOtherModel(state)) {
                // a drag from another layout of the group: clear the source's layouts too
                state.mainEngine.adapter.getDragDropManager().clearDragMain();
            }
            setDragState(undefined);
        }
        // whatever the drop was, this layout's hover state is over
        this.clearDragLocal();
    }

    /** @internal hides this layout's outline without ending the drag (the pointer is over a drop zone) */
    hideIndicator() {
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
        return registerDropZone(model, element, options);
    }

    /** Releases the indicator's listeners. */
    dispose() {
        this.listeners.clear();
    }
}
