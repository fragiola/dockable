// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx and
// src/view/Utils.tsx (startDrag, enablePointerOnIFrames), with JSX and class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// FlexLayout previews a non-realtime drag with a classed outline div appended to the layout and
// reads its offsetLeft/Top back to commit. The controller instead computes the bounded position
// arithmetically and exposes it as `previewOffset`; the adapter reflects it on the splitter
// element itself (a structural translate), and the commit uses the computed value.
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { BorderLocation, Orientation } from "../geometry/dock";
import { EMPTY_RECT, type Rect } from "../geometry/rect";
import { hasModifier } from "../keyboard/keymap";
import {
    borderSplitSize,
    borderSplitterBounds,
    calculateSplit,
    type SplitChild,
    type SplitInitials,
    splitterBounds,
    splitterInitials,
} from "../split/split";
import { resolveBorder } from "../state/defaults";
import type { AnyBorder, AnyRow } from "../state/tree";
import type { AnyTypes, DockableTypes } from "../state/types";

/** The ARIA attributes of a splitter (`role="separator"`). */
export interface SplitterAria {
    /** the separator's orientation: `"vertical"` for a splitter between side by side children */
    orientation: "horizontal" | "vertical";
    /** row splitters: 0-100 position within the row, to a tenth; border splitters: the border size in px */
    valueNow: number | undefined;
    valueMin: number | undefined;
    valueMax: number | undefined;
    /** the formatted value (`"40.5%"` or `"200px"`), announced in preference to the raw number */
    valueText: string | undefined;
}

/** The drag state of a splitter. */
export interface SplitterState {
    /** true while the splitter is being dragged with the pointer */
    readonly dragging: boolean;
    /**
     * While an outline (non-realtime) drag is in progress: how far, in px along the splitter's
     * axis, the splitter would move if released now (bounded). `undefined` otherwise.
     */
    readonly previewOffset: number | undefined;
}

/** How long the splitter-dragging flag outlives a drag, so the ResizeObserver can fire. */
const DRAGGING_HOLD_MS = 300;
/** Pixels a splitter moves per arrow key press. */
const KEYBOARD_STEP = 10;

const IDLE: SplitterState = { dragging: false, previewOffset: undefined };

/** Disables (or re-enables) pointer events on iframes, so a drag over one keeps its events. */
export function enablePointerOnIFrames(
    enable: boolean,
    currentDocument: Document,
) {
    const iframes = [
        ...currentDocument.getElementsByTagName("iframe"),
        ...currentDocument.getElementsByTagName("webview"),
    ];
    for (const iframe of iframes) {
        (iframe as HTMLElement).style.pointerEvents = enable ? "auto" : "none";
    }
}

/**
 * Starts a pointer drag: captures the pointer (so pointerup/pointercancel fire even if the pointer
 * leaves the window) and reports moves until release or cancel. Returns a function that stops
 * listening without calling either callback.
 */
export function startDrag(
    doc: Document,
    event: PointerEvent,
    captureElement: Element | null,
    drag: (x: number, y: number) => void,
    dragEnd: () => void,
    dragCancel: () => void,
): () => void {
    event.preventDefault();
    const target = captureElement;
    if (target && typeof target.setPointerCapture === "function") {
        try {
            target.setPointerCapture(event.pointerId);
        } catch {
            // an unknown pointer id (synthetic events) cannot be captured
        }
    }
    // only the pointer that started the drag moves or ends it (a second finger does not)
    const pointerId = event.pointerId;
    const pointerMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) {
            return;
        }
        ev.preventDefault();
        drag(ev.clientX, ev.clientY);
    };
    const removeListeners = () => {
        doc.removeEventListener("pointermove", pointerMove);
        doc.removeEventListener("pointerup", pointerUp);
        doc.removeEventListener("pointercancel", pointerCancel);
    };
    const pointerCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) {
            return;
        }
        ev.preventDefault();
        removeListeners();
        dragCancel();
    };
    const pointerUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) {
            return;
        }
        removeListeners();
        dragEnd();
    };
    doc.addEventListener("pointermove", pointerMove);
    doc.addEventListener("pointerup", pointerUp);
    doc.addEventListener("pointercancel", pointerCancel);
    return removeListeners;
}

interface RowSplit {
    readonly children: SplitChild[];
    readonly orientation: Orientation;
    readonly initials: SplitInitials;
    readonly bounds: [number, number];
}

type Drag =
    | { readonly kind: "row"; readonly split: RowSplit }
    | {
          readonly kind: "border";
          readonly location: BorderLocation;
          readonly origin: [number, number];
      };

/**
 * Headless splitter behaviour for the splitter before child `index` of a row (1-based), or for a
 * border's splitter. The adapter forwards native pointer and keyboard events and renders the ARIA
 * values and state. It runs `row.resize` / `border.resize` (transient while a realtime drag moves).
 */
export class SplitterController<T extends DockableTypes = AnyTypes> {
    private readonly engine: LayoutEngine<T>;
    private readonly nodeId: string;
    private readonly index: number;
    private state: SplitterState = IDLE;
    private readonly listeners = new Set<() => void>();
    private element: HTMLElement | null = null;
    private stopDrag: (() => void) | undefined;
    private unregister: (() => void) | undefined;
    private aria: SplitterAria | undefined;
    private draggingTimer: number | undefined;
    private drag: Drag | undefined;
    private horizontal = false;
    private bounds: [number, number] = [0, 0];
    private startPosition = 0;
    private pointerOffset = 0;
    private position = 0;
    // a press without movement (a click to focus the splitter) commits nothing
    private moved = false;

    private readonly onTouchStart = (event: TouchEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    constructor(engine: LayoutEngine<T>, nodeId: string, index: number) {
        this.engine = engine;
        this.nodeId = nodeId;
        this.index = index;
    }

    private target(): AnyRow | AnyBorder | undefined {
        const node = this.engine.adapter.model.get("node-by", {
            id: this.nodeId,
        });
        return node?.type === "row" || node?.type === "border"
            ? (node as unknown as AnyRow | AnyBorder)
            : undefined;
    }

    /** true when the splitter sits between side by side children (it moves along x) */
    isHorizontal = (): boolean => {
        const target = this.target();
        if (target?.type === "border") {
            return target.location === "left" || target.location === "right";
        }
        return this.engine.adapter.rowOrientation(this.nodeId) === "horizontal";
    };

    /** true when the splitter must not render: row splitters hide while a tabset is maximized */
    isHidden(): boolean {
        return (
            this.target()?.type !== "border" &&
            this.engine.adapter.model.get("maximized-tabset", {
                layoutId: this.engine.layoutId,
            }) !== undefined
        );
    }

    /**
     * Attaches the splitter element (or detaches with `null`). Registers it for splitter-size
     * discovery and installs the non-passive touchstart guard (Android needs it).
     */
    attach(element: HTMLElement | null) {
        if (this.element === element) {
            return;
        }
        this.element?.removeEventListener("touchstart", this.onTouchStart);
        this.unregister?.();
        this.unregister = undefined;
        this.element = element;
        if (element) {
            element.addEventListener("touchstart", this.onTouchStart, {
                passive: false,
            });
            if (this.target()?.type !== "border") {
                const unregister = this.engine.adapter.registerSplitter(
                    element,
                    this.isHorizontal,
                );
                const unsubscribe = this.engine.adapter.subscribeGeometry(
                    this.onGeometry,
                );
                this.unregister = () => {
                    unregister();
                    unsubscribe();
                };
            }
        }
    }

    /** The current drag state. The same object is returned until it changes. */
    getState = (): SplitterState => this.state;

    /** Calls `listener` when the state or the ARIA values change. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private rect(node: { type: string; id: string }): Rect | undefined {
        return this.engine.adapter.rect(
            node.type === "row" ? "row" : "tabset",
            node.id,
        );
    }

    /** the row's children as the split math sees them, and where this splitter can move */
    private rowSplit(row: AnyRow): RowSplit {
        const children = row.children.map((child) => ({
            rect: this.rect(child) ?? EMPTY_RECT,
            range: this.engine.get("flex-by", { nodeId: child.id }),
        }));
        const orientation = this.engine.adapter.rowOrientation(row.id);
        const size = this.engine.get("splitter-size");
        return {
            children,
            orientation,
            initials: splitterInitials(children, orientation, size, this.index),
            bounds: splitterBounds(children, orientation, size, this.index),
        };
    }

    /** the border's splitter bounds, and the unconstrained ones its size is measured from */
    private borderSplit(border: AnyBorder): {
        bounds: [number, number];
        origin: [number, number];
    } {
        const state = this.engine.adapter.model.state;
        const strip = this.engine.adapter.rect("borderheader", border.id);
        const layout = this.engine.adapter.rect("row", state.root.id);
        if (!strip || !layout) {
            return { bounds: [0, 0], origin: [0, 0] };
        }
        const range = this.engine.get("flex-by", {
            nodeId: state.root.id,
        });
        const size = this.engine.get("splitter-size");
        const resolved = resolveBorder(state.defaults, border);
        return {
            bounds: borderSplitterBounds(
                border.location,
                strip,
                layout,
                range,
                size,
                resolved,
            ),
            origin: borderSplitterBounds(
                border.location,
                strip,
                layout,
                range,
                size,
            ),
        };
    }

    /**
     * The ARIA values: a row splitter's position in the measured row, a border splitter's size. The
     * same object is returned until they change; `subscribe` hears when a measure changes them.
     */
    getAria = (): SplitterAria => {
        const next = this.measureAria();
        const previous = this.aria;
        if (
            previous &&
            previous.orientation === next.orientation &&
            previous.valueNow === next.valueNow &&
            previous.valueMin === next.valueMin &&
            previous.valueMax === next.valueMax
        ) {
            return previous;
        }
        this.aria = next;
        return next;
    };

    private measureAria(): SplitterAria {
        const horizontal = this.isHorizontal();
        const aria: SplitterAria = {
            orientation: horizontal ? "vertical" : "horizontal",
            valueNow: undefined,
            valueMin: undefined,
            valueMax: undefined,
            valueText: undefined,
        };
        const target = this.target();
        if (target?.type === "border") {
            const resolved = resolveBorder(
                this.engine.adapter.model.state.defaults,
                target,
            );
            aria.valueNow = Math.round(resolved.size);
            aria.valueMin = Math.round(resolved.minSize);
            aria.valueMax = Math.round(resolved.maxSize);
            aria.valueText = `${aria.valueNow}px`;
            return aria;
        }
        const rowRect = target && this.engine.adapter.rect("row", target.id);
        const prev = target?.children[this.index - 1];
        const prevRect = prev && this.rect(prev);
        const extent = rowRect
            ? horizontal
                ? rowRect.width
                : rowRect.height
            : 0;
        if (rowRect && prevRect && extent > 0) {
            const position = horizontal
                ? prevRect.x + prevRect.width - rowRect.x
                : prevRect.y + prevRect.height - rowRect.y;
            // to a tenth of a percent: one 10px key step changes it on rows up to 10000px
            aria.valueNow = Math.round((position / extent) * 1000) / 10;
            aria.valueMin = 0;
            aria.valueMax = 100;
            aria.valueText = `${aria.valueNow}%`;
        }
        return aria;
    }

    /** Starts a pointer drag. Call from the splitter's `pointerdown`. */
    onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) {
            return; // only the primary button (or a touch/pen contact) drags
        }
        event.stopPropagation();
        // the attached element, not event.currentTarget: adapters that delegate events (React)
        // report the delegation root as the current target
        const element =
            this.element ?? (event.currentTarget as HTMLElement | null);
        if (!element) {
            return;
        }
        this.cancelDrag();
        const target = this.target();
        if (target?.type === "border") {
            const { bounds, origin } = this.borderSplit(target);
            this.bounds = bounds;
            this.drag = { kind: "border", location: target.location, origin };
            this.horizontal =
                target.location === "left" || target.location === "right";
        } else if (target) {
            const split = this.rowSplit(target);
            this.bounds = split.bounds;
            this.drag = { kind: "row", split };
            this.horizontal = split.orientation === "horizontal";
        } else {
            return;
        }

        const doc = element.ownerDocument;
        this.engine.adapter.setSplitterDragging(true);
        enablePointerOnIFrames(false, doc);

        const r = this.engine.adapter.rectInLayout(element);
        const domRect = this.engine.adapter.getDomRect();
        this.startPosition = this.horizontal ? r.x : r.y;
        this.position = this.startPosition;
        this.moved = false;
        this.pointerOffset = this.horizontal
            ? event.clientX - domRect.x - r.x
            : event.clientY - domRect.y - r.y;

        this.stopDrag = startDrag(
            doc,
            event,
            element,
            (x, y) => this.onDragMove(x, y),
            () => this.onDragEnd(),
            () => this.onDragCancel(),
        );
        this.setState({
            dragging: true,
            previewOffset: this.engine.adapter.isRealtimeResize()
                ? undefined
                : 0,
        });
    };

    /** Arrow keys move the splitter by 10px. Call from the splitter's `keydown`. */
    onKeyDown = (event: KeyboardEvent) => {
        if (hasModifier(event)) {
            return; // modified arrows are left for keymap bindings (e.g. tabset cycling)
        }
        let delta = 0;
        if (this.isHorizontal()) {
            if (event.key === "ArrowLeft") delta = -KEYBOARD_STEP;
            if (event.key === "ArrowRight") delta = KEYBOARD_STEP;
        } else {
            if (event.key === "ArrowUp") delta = -KEYBOARD_STEP;
            if (event.key === "ArrowDown") delta = KEYBOARD_STEP;
        }
        if (delta === 0) {
            return;
        }
        event.preventDefault();
        this.engine.adapter.setSplitterDragging(true);
        const target = this.target();
        if (target?.type === "border") {
            // moving towards the border's edge shrinks it; bottom/right borders grow the other way
            const grow =
                target.location === "bottom" || target.location === "right"
                    ? -delta
                    : delta;
            const resolved = resolveBorder(
                this.engine.adapter.model.state.defaults,
                target,
            );
            const size = Math.max(
                resolved.minSize,
                Math.min(resolved.maxSize, resolved.size + grow),
            );
            this.engine.adapter.model.run("border.resize", {
                borderId: target.id,
                size,
            });
        } else if (target) {
            const { children, orientation, initials, bounds } =
                this.rowSplit(target);
            // an unmeasured row (all zero rects) cannot be split
            if (initials.sum <= 0) {
                this.engine.adapter.setSplitterDragging(false);
                return;
            }
            const pos = Math.max(
                bounds[0],
                Math.min(bounds[1], initials.startPosition + delta),
            );
            const weights = calculateSplit(
                children,
                orientation,
                this.index,
                pos,
                initials,
            );
            if (weights.length > 0) {
                this.engine.adapter.model.run("row.resize", {
                    rowId: target.id,
                    weights,
                });
            }
        }
        // keep the flag long enough for the ResizeObserver to fire
        this.holdDraggingFlag();
    };

    /** Stops any drag in progress and releases every listener and timer. */
    dispose() {
        this.cancelDrag();
        if (this.draggingTimer !== undefined) {
            this.view()?.clearTimeout(this.draggingTimer);
            this.draggingTimer = undefined;
        }
        this.attach(null);
        this.listeners.clear();
    }

    private onDragMove(x: number, y: number) {
        if (!this.state.dragging) {
            return;
        }
        const domRect = this.engine.adapter.getDomRect();
        const pointer = this.horizontal ? x - domRect.x : y - domRect.y;
        this.position = this.getBoundPosition(pointer - this.pointerOffset);
        this.moved = true;
        if (this.engine.adapter.isRealtimeResize()) {
            this.updateLayout(true);
        } else {
            this.setState({
                dragging: true,
                previewOffset: this.position - this.startPosition,
            });
        }
    }

    private onDragEnd() {
        this.stopDrag = undefined;
        if (this.state.dragging && this.moved) {
            this.updateLayout(false);
        }
        this.finishDrag();
    }

    private onDragCancel() {
        this.stopDrag = undefined;
        // a realtime drag that moved already changed the layout: commit it, so an undo stack
        // closes the gesture; an outline drag only moved the preview
        if (
            this.state.dragging &&
            this.moved &&
            this.engine.adapter.isRealtimeResize()
        ) {
            this.updateLayout(false);
        }
        this.finishDrag();
    }

    private finishDrag() {
        this.restoreIFrames();
        this.holdDraggingFlag();
        this.setState(IDLE);
    }

    /** cleans up a drag interrupted by unmount or a new pointerdown (like a cancel) */
    private cancelDrag() {
        if (this.stopDrag) {
            this.stopDrag();
            this.stopDrag = undefined;
        }
        if (this.state.dragging) {
            if (this.moved && this.engine.adapter.isRealtimeResize()) {
                this.updateLayout(false);
            }
            this.restoreIFrames();
            this.engine.adapter.setSplitterDragging(false);
            this.setState(IDLE);
        }
    }

    private restoreIFrames() {
        const doc =
            this.element?.ownerDocument ?? this.engine.get("owner-document");
        if (doc) {
            enablePointerOnIFrames(true, doc);
        }
    }

    private updateLayout(transient: boolean) {
        const drag = this.drag;
        if (drag?.kind === "border") {
            this.engine.adapter.model.run(
                "border.resize",
                {
                    borderId: this.nodeId,
                    size: borderSplitSize(
                        drag.location,
                        drag.origin,
                        this.position,
                    ),
                },
                { transient },
            );
        } else if (drag) {
            const { children, orientation, initials } = drag.split;
            const weights = calculateSplit(
                children,
                orientation,
                this.index,
                this.position,
                initials,
            );
            // an unmeasured row (all zero rects) cannot be split
            if (weights.length > 0) {
                this.engine.adapter.model.run(
                    "row.resize",
                    { rowId: this.nodeId, weights },
                    { transient },
                );
            }
        }
    }

    private getBoundPosition(p: number) {
        const [min, max] = this.bounds;
        return Math.min(max, Math.max(min, p));
    }

    private view(): Window | undefined {
        return (
            this.element?.ownerDocument.defaultView ??
            this.engine.get("owner-window")
        );
    }

    private holdDraggingFlag() {
        const win = this.view();
        if (this.draggingTimer !== undefined) {
            win?.clearTimeout(this.draggingTimer);
        }
        if (!win) {
            this.engine.adapter.setSplitterDragging(false);
            return;
        }
        this.draggingTimer = win.setTimeout(() => {
            this.draggingTimer = undefined;
            this.engine.adapter.setSplitterDragging(false);
        }, DRAGGING_HOLD_MS);
    }

    /** a measure moved rects: the position this splitter announces may have changed */
    private readonly onGeometry = () => {
        const previous = this.aria;
        if (this.getAria() !== previous) {
            this.notify();
        }
    };

    private notify() {
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    private setState(state: SplitterState) {
        if (
            state.dragging === this.state.dragging &&
            state.previewOffset === this.state.previewOffset
        ) {
            return;
        }
        this.state = state;
        this.notify();
    }
}

/** Creates a {@link SplitterController} for the splitter before child `index` (1-based) of a row or border. */
export function createSplitterController<T extends DockableTypes = AnyTypes>(
    engine: LayoutEngine<T>,
    nodeId: string,
    index: number,
): SplitterController<T> {
    return new SplitterController<T>(engine, nodeId, index);
}
