// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx and
// src/view/Utils.tsx (startDrag, enablePointerOnIFrames), with JSX and class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// FlexLayout previews a non-realtime drag with a classed outline div appended to the layout and
// reads its offsetLeft/Top back to commit. The controller instead computes the bounded position
// arithmetically and exposes it as `previewOffset`; the adapter reflects it on the splitter
// element itself (a structural translate), and the commit uses the computed value.
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { BorderLocation } from "../geometry/dock";
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
    /** row splitters: 0-100 position within the row; border splitters: the border size in px */
    valueNow: number | undefined;
    valueMin: number | undefined;
    valueMax: number | undefined;
    /** the formatted value (`"40%"` or `"200px"`), announced in preference to the raw number */
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
    private draggingTimer: number | undefined;
    private bounds: [number, number] = [0, 0];
    private startPosition = 0;
    private pointerOffset = 0;
    private position = 0;
    // a press without movement (a click to focus the splitter) commits nothing
    private moved = false;
    private initials: SplitInitials = {
        initialSizes: [],
        sum: 0,
        startPosition: 0,
    };
    private children: SplitChild[] = [];

    private readonly onTouchStart = (event: TouchEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    constructor(engine: LayoutEngine<T>, nodeId: string, index: number) {
        this.engine = engine;
        this.nodeId = nodeId;
        this.index = index;
    }

    private row(): AnyRow | undefined {
        const node = this.engine.adapter.model.get("node-by-id", {
            nodeId: this.nodeId,
        });
        return node?.type === "row" ? (node as unknown as AnyRow) : undefined;
    }

    private border(): AnyBorder | undefined {
        const node = this.engine.adapter.model.get("node-by-id", {
            nodeId: this.nodeId,
        });
        return node?.type === "border"
            ? (node as unknown as AnyBorder)
            : undefined;
    }

    /** true when the splitter sits between side by side children (it moves along x) */
    isHorizontal = (): boolean => {
        const border = this.border();
        if (border) {
            return border.location === "left" || border.location === "right";
        }
        return this.engine.adapter.rowOrientation(this.nodeId) === "horizontal";
    };

    /** true when the splitter must not render: row splitters hide while a tabset is maximized */
    isHidden(): boolean {
        return (
            !this.border() &&
            this.engine.adapter.model.get("maximized-tabset-by-layout-id", {
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
        if (this.element) {
            this.element.removeEventListener("touchstart", this.onTouchStart);
            this.engine.adapter.registerSplitter(
                this.element,
                this.isHorizontal,
                false,
            );
        }
        this.element = element;
        if (element) {
            element.addEventListener("touchstart", this.onTouchStart, {
                passive: false,
            });
            if (!this.border()) {
                this.engine.adapter.registerSplitter(
                    element,
                    this.isHorizontal,
                );
            }
        }
    }

    /** The current drag state. The same object is returned until it changes. */
    getState = (): SplitterState => this.state;

    /** Calls `listener` when the state changes. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** the row's children as the split math sees them: measured rects and size ranges */
    private splitChildren(row: AnyRow): SplitChild[] {
        return row.children.map((child) => ({
            rect: this.engine.adapter.rect(
                child.type === "row" ? "row" : "tabset",
                child.id,
            ) ?? {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
            range: this.engine.get("size-limits-by-node-id", {
                nodeId: child.id,
            }),
        }));
    }

    /** The ARIA values, computed from the current geometry. */
    getAria(): SplitterAria {
        const horizontal = this.isHorizontal();
        const aria: SplitterAria = {
            orientation: horizontal ? "vertical" : "horizontal",
            valueNow: undefined,
            valueMin: undefined,
            valueMax: undefined,
            valueText: undefined,
        };
        const border = this.border();
        if (border) {
            const resolved = resolveBorder(
                this.engine.adapter.model.state.defaults,
                border,
            );
            aria.valueNow = Math.round(resolved.size);
            aria.valueMin = Math.round(resolved.minSize);
            aria.valueMax = Math.round(resolved.maxSize);
            aria.valueText = `${aria.valueNow}px`;
            return aria;
        }
        const row = this.row();
        const rowRect = row
            ? this.engine.adapter.rect("row", row.id)
            : undefined;
        const prev = row?.children[this.index - 1];
        const prevRect = prev
            ? this.engine.adapter.rect(
                  prev.type === "row" ? "row" : "tabset",
                  prev.id,
              )
            : undefined;
        const extent = rowRect
            ? horizontal
                ? rowRect.width
                : rowRect.height
            : 0;
        if (rowRect && prevRect && extent > 0) {
            aria.valueNow = Math.round(
                ((horizontal
                    ? prevRect.x + prevRect.width - rowRect.x
                    : prevRect.y + prevRect.height - rowRect.y) /
                    extent) *
                    100,
            );
            aria.valueMin = 0;
            aria.valueMax = 100;
            aria.valueText = `${aria.valueNow}%`;
        }
        return aria;
    }

    /** the border's splitter bounds, with its size limits (`limits`) or without */
    private borderBounds(border: AnyBorder, limits: boolean): [number, number] {
        const state = this.engine.adapter.model.state;
        const strip = this.engine.adapter.rect("borderheader", border.id);
        const layout = this.engine.adapter.rect("row", state.root.id);
        if (!strip || !layout) {
            return [0, 0];
        }
        const resolved = resolveBorder(state.defaults, border);
        return borderSplitterBounds(
            border.location as BorderLocation,
            strip,
            layout,
            this.engine.get("size-limits-by-node-id", {
                nodeId: state.root.id,
            }),
            this.engine.get("splitter-size"),
            limits
                ? { minSize: resolved.minSize, maxSize: resolved.maxSize }
                : undefined,
        );
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
        const border = this.border();
        const row = this.row();
        if (border) {
            this.bounds = this.borderBounds(border, true);
        } else if (row) {
            this.children = this.splitChildren(row);
            const orientation = this.engine.adapter.rowOrientation(row.id);
            const size = this.engine.get("splitter-size");
            this.initials = splitterInitials(
                this.children,
                orientation,
                size,
                this.index,
            );
            this.bounds = splitterBounds(
                this.children,
                orientation,
                size,
                this.index,
            );
        } else {
            return;
        }

        const doc = element.ownerDocument;
        this.engine.adapter.setSplitterDragging(true);
        enablePointerOnIFrames(false, doc);

        const r = this.engine.adapter.rectInLayout(element);
        const domRect = this.engine.adapter.getDomRect();
        const horizontal = this.isHorizontal();
        this.startPosition = horizontal ? r.x : r.y;
        this.position = this.startPosition;
        this.moved = false;
        this.pointerOffset = horizontal
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
        const border = this.border();
        const row = this.row();
        if (border) {
            // moving towards the border's edge shrinks it; bottom/right borders grow the other way
            const grow =
                border.location === "bottom" || border.location === "right"
                    ? -delta
                    : delta;
            const resolved = resolveBorder(
                this.engine.adapter.model.state.defaults,
                border,
            );
            const size = Math.max(
                resolved.minSize,
                Math.min(resolved.maxSize, resolved.size + grow),
            );
            this.engine.adapter.model.run("border.resize", {
                borderId: border.id,
                size,
            });
        } else if (row) {
            const children = this.splitChildren(row);
            const orientation = this.engine.adapter.rowOrientation(row.id);
            const size = this.engine.get("splitter-size");
            const initials = splitterInitials(
                children,
                orientation,
                size,
                this.index,
            );
            // an unmeasured row (all zero rects) cannot be split
            if (initials.sum <= 0) {
                this.engine.adapter.setSplitterDragging(false);
                return;
            }
            const bounds = splitterBounds(
                children,
                orientation,
                size,
                this.index,
            );
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
                    rowId: row.id,
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
            this.clearTimer(this.draggingTimer);
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
        const pointer = this.isHorizontal() ? x - domRect.x : y - domRect.y;
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
        const doc =
            this.element?.ownerDocument ?? this.engine.get("owner-document");
        if (doc) {
            enablePointerOnIFrames(true, doc);
        }
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
            const doc =
                this.element?.ownerDocument ??
                this.engine.get("owner-document");
            if (doc) {
                enablePointerOnIFrames(true, doc);
            }
            this.engine.adapter.setSplitterDragging(false);
            this.setState(IDLE);
        }
    }

    private updateLayout(transient: boolean) {
        const border = this.border();
        const row = this.row();
        if (border) {
            const size = borderSplitSize(
                border.location as BorderLocation,
                this.borderBounds(border, false),
                this.position,
            );
            this.engine.adapter.model.run(
                "border.resize",
                { borderId: border.id, size },
                { transient },
            );
        } else if (row) {
            // an unmeasured row (all zero rects) cannot be split
            if (this.initials.sum <= 0) {
                return;
            }
            const weights = calculateSplit(
                this.children,
                this.engine.adapter.rowOrientation(row.id),
                this.index,
                this.position,
                this.initials,
            );
            if (weights.length === row.children.length) {
                this.engine.adapter.model.run(
                    "row.resize",
                    { rowId: row.id, weights },
                    { transient },
                );
            }
        }
    }

    private getBoundPosition(p: number) {
        const [min, max] = this.bounds;
        return Math.min(max, Math.max(min, p));
    }

    private holdDraggingFlag() {
        const win =
            this.element?.ownerDocument.defaultView ??
            this.engine.get("owner-window");
        if (this.draggingTimer !== undefined) {
            this.clearTimer(this.draggingTimer);
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

    private clearTimer(timer: number) {
        const win =
            this.element?.ownerDocument.defaultView ??
            this.engine.get("owner-window");
        win?.clearTimeout(timer);
    }

    private setState(state: SplitterState) {
        if (
            state.dragging === this.state.dragging &&
            state.previewOffset === this.state.previewOffset
        ) {
            return;
        }
        this.state = state;
        for (const listener of [...this.listeners]) {
            listener();
        }
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
