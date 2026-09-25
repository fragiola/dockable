// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx and
// src/view/Utils.tsx (startDrag, enablePointerOnIFrames), with JSX and class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// FlexLayout previews a non-realtime drag with a classed outline div appended to the layout and
// reads its offsetLeft/Top back to commit. The controller instead computes the bounded position
// arithmetically and exposes it as `previewOffset`; the adapter reflects it on the splitter
// element itself (a structural translate), and the commit uses the computed value.
import type { LayoutEngine } from "../engine/LayoutEngine";
import { hasModifier } from "../keyboard/keymap";
import { Actions } from "../model/Actions";
import { BorderNode } from "../model/BorderNode";
import { DockLocation } from "../model/DockLocation";
import { Orientation } from "../model/Orientation";
import type { RowNode } from "../model/RowNode";

/** The ARIA attributes of a splitter (`role="separator"`). */
export interface ISplitterAria {
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
export interface ISplitterState {
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

const IDLE: ISplitterState = { dragging: false, previewOffset: undefined };

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
 * Starts a pointer drag: captures the pointer (so pointerup/pointercancel fire even if the
 * pointer leaves the window) and reports moves until release or cancel. Returns a function that
 * stops listening without calling either callback.
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
 * border's splitter. The adapter forwards native pointer and keyboard events and renders the
 * ARIA values and state.
 */
export class SplitterController {
    private readonly engine: LayoutEngine;
    private readonly node: RowNode | BorderNode;
    private readonly index: number;
    private state: ISplitterState = IDLE;
    private readonly listeners = new Set<() => void>();
    private element: HTMLElement | null = null;
    private stopDrag: (() => void) | undefined;
    private draggingTimer: number | undefined;
    private bounds: [number, number] = [0, 0];
    private startPosition = 0;
    private pointerOffset = 0;
    private position = 0;
    // a press without movement (e.g. a click to focus the splitter) commits nothing
    private moved = false;
    private initials: {
        initialSizes: number[];
        sum: number;
        startPosition: number;
    } = {
        initialSizes: [],
        sum: 0,
        startPosition: 0,
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    constructor(
        engine: LayoutEngine,
        node: RowNode | BorderNode,
        index: number,
    ) {
        this.engine = engine;
        this.node = node;
        this.index = index;
    }

    /** true when the splitter sits between side by side children (it moves along x) */
    isHorizontal = (): boolean => {
        return this.node.getOrientation() === Orientation.HORZ;
    };

    /** true when the splitter must not render: row splitters are hidden while a tabset is maximized */
    isHidden(): boolean {
        return (
            !(this.node instanceof BorderNode) &&
            this.engine
                .getModel()
                .getMaximizedTabset(this.engine.getLayoutId()) !== undefined
        );
    }

    /**
     * Attaches the splitter element (or detaches with `null`). Registers it for splitter-size
     * discovery and installs the non-passive touchstart guard (Android needs it to prevent
     * default touch handling).
     */
    attach(element: HTMLElement | null) {
        if (this.element === element) {
            return;
        }
        if (this.element) {
            this.element.removeEventListener("touchstart", this.onTouchStart);
            this.engine.registerSplitter(
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
            if (!(this.node instanceof BorderNode)) {
                this.engine.registerSplitter(element, this.isHorizontal);
            }
        }
    }

    /** The current drag state. The same object is returned until it changes. */
    getState = (): ISplitterState => this.state;

    /** Calls `listener` when the state changes. Returns the unsubscribe function. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** The ARIA values, computed from the model's current geometry. */
    getAria(): ISplitterAria {
        const horizontal = this.isHorizontal();
        const aria: ISplitterAria = {
            orientation: horizontal ? "vertical" : "horizontal",
            valueNow: undefined,
            valueMin: undefined,
            valueMax: undefined,
            valueText: undefined,
        };
        // row splitters report a 0-100 percentage position within the row; border splitters report
        // the border size in px (with min/max as the range)
        if (this.node instanceof BorderNode) {
            aria.valueNow = Math.round(this.node.getSize());
            aria.valueMin = Math.round(this.node.getMinSize());
            aria.valueMax = Math.round(this.node.getMaxSize());
            aria.valueText = `${aria.valueNow}px`;
        } else {
            const rowRect = this.node.getRect();
            const prev = this.node.getChildren()[this.index - 1];
            const extent = horizontal ? rowRect.width : rowRect.height;
            if (prev && extent > 0) {
                const prevRect = prev.getRect();
                aria.valueNow = Math.round(
                    ((horizontal
                        ? prevRect.getRight() - rowRect.x
                        : prevRect.getBottom() - rowRect.y) /
                        extent) *
                        100,
                );
                aria.valueMin = 0;
                aria.valueMax = 100;
                aria.valueText = `${aria.valueNow}%`;
            }
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
        const node = this.node;
        if (node instanceof BorderNode) {
            this.bounds = node.getSplitterBounds(true);
        } else {
            this.initials = node.getSplitterInitials(this.index);
            this.bounds = node.getSplitterBounds(this.index);
        }

        const doc = element.ownerDocument;
        this.engine.setSplitterDragging(true);
        enablePointerOnIFrames(false, doc);

        const r = this.engine.getBoundingClientRect(element);
        const domRect = this.engine.getDomRect();
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
            previewOffset: this.engine.isRealtimeResize() ? undefined : 0,
        });
    };

    /** Arrow keys move the splitter by 10px. Call from the splitter's `keydown`. */
    onKeyDown = (event: KeyboardEvent) => {
        if (hasModifier(event)) {
            return; // modified arrows are left for keymap bindings (e.g. tabset cycling)
        }
        let delta = 0;
        if (this.isHorizontal()) {
            // vertical separator: left/right arrows
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
        this.engine.setSplitterDragging(true);
        const node = this.node;
        if (node instanceof BorderNode) {
            // moving towards the border edge shrinks it; bottom/right borders grow the other way
            const location = node.getLocation();
            const grow =
                location === DockLocation.BOTTOM ||
                location === DockLocation.RIGHT
                    ? -delta
                    : delta;
            const size = Math.max(
                node.getMinSize(),
                Math.min(node.getMaxSize(), node.getSize() + grow),
            );
            this.engine.doAction(Actions.adjustBorderSplit(node.getId(), size));
        } else {
            const initials = node.getSplitterInitials(this.index);
            // an unmeasured row (all zero rects) cannot be split: skip rather than emitting
            // Infinity/NaN weights from a division by the zero sum
            if (initials.sum <= 0) {
                this.engine.setSplitterDragging(false);
                return;
            }
            const bounds = node.getSplitterBounds(this.index);
            const pos = Math.max(
                bounds[0],
                Math.min(bounds[1], initials.startPosition + delta),
            );
            const weights = node.calculateSplit(
                this.index,
                pos,
                initials.initialSizes,
                initials.sum,
                initials.startPosition,
            );
            this.engine.doAction(Actions.adjustWeights(node.getId(), weights));
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
        const domRect = this.engine.getDomRect();
        const pointer = this.isHorizontal() ? x - domRect.x : y - domRect.y;
        this.position = this.getBoundPosition(pointer - this.pointerOffset);
        this.moved = true;

        if (this.engine.isRealtimeResize()) {
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
        // commit an in-progress realtime resize so the undo snapshot taken at drag start is
        // flushed here rather than leaking into the next action; a non-realtime drag only moved
        // the preview, so a cancelled drag leaves the model untouched
        if (
            this.state.dragging &&
            this.moved &&
            this.engine.isRealtimeResize()
        ) {
            this.updateLayout(false);
        }
        this.finishDrag();
    }

    private finishDrag() {
        const doc =
            this.element?.ownerDocument ?? this.engine.getCurrentDocument();
        if (doc) {
            enablePointerOnIFrames(true, doc);
        }
        // keep the flag until the ResizeObserver has fired
        this.holdDraggingFlag();
        this.setState(IDLE);
    }

    /**
     * clean up a drag interrupted by unmount or a new pointerdown. Like a cancel, a realtime drag
     * that already moved is committed (else the model keeps adjusting weights and an undo manager
     * keeps the pre-drag snapshot pending); an outline drag commits nothing.
     */
    private cancelDrag() {
        if (this.stopDrag) {
            this.stopDrag();
            this.stopDrag = undefined;
        }
        if (this.state.dragging) {
            if (this.moved && this.engine.isRealtimeResize()) {
                this.updateLayout(false);
            }
            const doc =
                this.element?.ownerDocument ?? this.engine.getCurrentDocument();
            if (doc) {
                enablePointerOnIFrames(true, doc);
            }
            this.engine.setSplitterDragging(false);
            this.setState(IDLE);
        }
    }

    private updateLayout(adjusting: boolean) {
        const node = this.node;
        const value = this.position;
        if (node instanceof BorderNode) {
            const size = node.calculateSplit(node, value);
            this.engine.doAction(
                Actions.adjustBorderSplit(node.getId(), size).setAdjusting(
                    adjusting,
                ),
            );
        } else {
            const init = this.initials;
            // an unmeasured row (all zero rects) cannot be split: skip rather than emitting
            // Infinity/NaN weights from a division by the zero sum
            if (init.sum <= 0) {
                return;
            }
            const weights = node.calculateSplit(
                this.index,
                value,
                init.initialSizes,
                init.sum,
                init.startPosition,
            );
            this.engine.doAction(
                Actions.adjustWeights(node.getId(), weights).setAdjusting(
                    adjusting,
                ),
            );
        }
    }

    private getBoundPosition(p: number) {
        const [min, max] = this.bounds;
        return Math.min(max, Math.max(min, p));
    }

    private holdDraggingFlag() {
        const win =
            this.element?.ownerDocument.defaultView ??
            this.engine.getCurrentWindow();
        if (this.draggingTimer !== undefined) {
            this.clearTimer(this.draggingTimer);
        }
        if (!win) {
            this.engine.setSplitterDragging(false);
            return;
        }
        this.draggingTimer = win.setTimeout(() => {
            this.draggingTimer = undefined;
            this.engine.setSplitterDragging(false);
        }, DRAGGING_HOLD_MS);
    }

    private clearTimer(timer: number) {
        const win =
            this.element?.ownerDocument.defaultView ??
            this.engine.getCurrentWindow();
        win?.clearTimeout(timer);
    }

    private setState(state: ISplitterState) {
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

/** Creates a {@link SplitterController} for the splitter before child `index` (1-based) of `node`. */
export function createSplitterController(
    engine: LayoutEngine,
    node: RowNode | BorderNode,
    index: number,
): SplitterController {
    return new SplitterController(engine, node, index);
}
