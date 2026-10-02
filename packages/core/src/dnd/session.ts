// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/DragDropManager.tsx
// (the page's drag state), with React, JSX and class names removed. Copyright (c) 2017 Caplin
// Systems Ltd. MIT licence, see LICENSE.
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { TabInitOf } from "../state/json";
import type { Model } from "../state/model";
import type {
    AnyTypes,
    DockableTypes,
    TabOf,
    TabsetNode,
} from "../state/types";
import type { DragDropManager } from "./DragDropManager";
import type { DropZoneOptions } from "./dropZones";

/** What is being dragged. */
export type DragSubject<T extends DockableTypes = AnyTypes> =
    /** a tab of the layout */
    | { readonly kind: "tab"; readonly tab: TabOf<T> }
    /** a whole tabset of the layout */
    | { readonly kind: "tabset"; readonly tabset: TabsetNode<T> }
    /** a new tab (a drag source, or a foreign drag) */
    | { readonly kind: "new"; readonly tab: TabInitOf<T> };

/** The subset of a native `DragEvent` the manager uses. */
export type DragEventLike = Pick<
    DragEvent,
    "clientX" | "clientY" | "dataTransfer" | "target" | "preventDefault"
>;

/** Called after an add or external drag was dropped: the new tab's id, or undefined when refused. */
export type NewTabDropped = (
    tabId: string | undefined,
    event: DragEventLike,
) => void;

export interface DropZone {
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

let dragState: DragState | undefined;
const dragListeners = new Set<() => void>();
export const dropZones = new Set<DropZone>();
let removeLostDragGuard: (() => void) | undefined;
/** the managers of the main layouts attached to the page, by model (latest last) */
export const attachedMains = new WeakMap<object, DragDropManager[]>();

export function getDragState(): DragState | undefined {
    return dragState;
}

export function subscribeDrag(listener: () => void): () => void {
    dragListeners.add(listener);
    return () => {
        dragListeners.delete(listener);
    };
}

export function startAddDrag<T extends DockableTypes>(
    model: Model<T>,
    event: DragEventLike,
    tab: TabInitOf<T>,
    onDrop?: NewTabDropped,
    dragImage?: Element | null,
): boolean {
    const managers = attachedMains.get(model);
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

export function endDrag() {
    const state = dragState;
    if (state) {
        state.mainEngine.adapter.getDragDropManager().clearDragMain();
        setDragState(undefined);
    }
}

export function setDragState(state: DragState | undefined, doc?: Document) {
    if (dragState === state) {
        return;
    }
    dragState = state;
    removeLostDragGuard?.();
    removeLostDragGuard = state && doc ? lostDragGuard(doc) : undefined;
    if (state === undefined) {
        for (const zone of dropZones) {
            setZoneOver(zone, false);
            zone.enterCount = 0;
        }
    }
    for (const listener of [...dragListeners]) {
        listener();
    }
}

/**
 * An external drag's source is outside the page, so no dragend ends it: it ends once it is over
 * no layout and no drop zone.
 */
export function endExternalDragOutside() {
    const state = dragState;
    if (
        state?.source === "external" &&
        ![...dropZones].some((zone) => zone.over) &&
        !state.mainEngine.adapter.getDragDropManager().anyDragging()
    ) {
        endDrag();
    }
}

export function setZoneOver(zone: DropZone, over: boolean) {
    if (zone.over !== over) {
        zone.over = over;
        zone.options.onOverChange?.(over);
    }
}

/**
 * Lost drag fallback: `dragend` is dispatched on the drag source, so it never arrives when the
 * source unmounts mid-drag. A pointer move with no button held, or a new press, ends the drag.
 * Returns the function that removes the guard.
 */
function lostDragGuard(doc: Document): () => void {
    const onPointerDown = () => endDrag();
    const onPointerMove = (event: PointerEvent) => {
        if (event.buttons === 0) {
            endDrag();
        }
    };
    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("pointermove", onPointerMove, true);
    return () => {
        doc.removeEventListener("pointerdown", onPointerDown, true);
        doc.removeEventListener("pointermove", onPointerMove, true);
    };
}
