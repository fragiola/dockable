import type { DragDropManager, OnExternalDrag } from "../dnd/DragDropManager";
import type { DragGroup } from "../dnd/DragGroup";
import type { EdgeBand, Orientation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";
import type { KeyEventLike } from "../keyboard/keymap";
import type { PopoutManager } from "../popout/PopoutManager";
import type { Model } from "../state/model";
import type { AnyTypes, DockableTypes } from "../state/types";
import type { LayoutEngine, LayoutEngineSettings } from "./LayoutEngine";
import type { MeasurableKind } from "./measure";
import type { MoveableOptions } from "./moveables";

/**
 * What only an adapter (React today; Angular and Vue next) calls on an engine: the render cycle,
 * element registration, moveable elements, measured geometry, overlay borders, and the drag and
 * popout machinery. An app never needs it: it uses `run`, `can`, `check`, `get` and `is`.
 *
 * The adapter's side of the cycle:
 * 1. call `prepare()` before rendering a layout (paths and size ranges are computed as the render reads them);
 * 2. render the structure, registering elements with `registerMeasurable`, `registerTabPanel`
 *    and `registerSplitter`;
 * 3. run `engine.run("measure-and-position")` after every commit (a layout effect in React);
 * 4. re-render when the revision from `subscribe`/`getSnapshot` changes.
 */
export interface LayoutEngineAdapter<T extends DockableTypes = AnyTypes> {
    /** the model this engine draws */
    readonly model: Model<T>;
    /**
     * the main layout's engine (this one, for the main engine). It owns the popout windows, the
     * drag and drop state and the view state every engine of the model shares
     */
    readonly main: LayoutEngine<T>;
    /** the page-unique scope of this layout's DOM ids and window names */
    readonly idScope: string;
    /** the engine of the layout a node is in: a popout's, or the main one */
    engineOf(id: string): LayoutEngine<T>;
    /** the engine of a popout window's layout (it shares this main engine's view state) */
    createPopoutEngine(layoutId: string): LayoutEngine<T>;
    /** updates the options an adapter passes on every render */
    setOptions(options: LayoutEngineSettings<T>): void;

    /** calls `listener` when adapters should re-render; returns its remover */
    subscribe(listener: () => void): () => void;
    /** the render revision: a number that changes whenever adapters should re-render */
    getSnapshot(): number;
    /**
     * prepares the layout for rendering; the `data-layout-path` of every node and the size ranges
     * rows and tabsets are rendered with are computed as the render reads them. Call before rendering
     */
    prepare(): void;
    /** the orientation of a row of this layout */
    rowOrientation(rowId: string): Orientation;

    /**
     * attaches the layout's root element (the containing block panels are positioned in) and
     * starts observing it and its window. Idempotent; another element detaches the previous one
     */
    attachRoot(element: HTMLElement): void;
    /** detaches the root element and releases every observer and listener */
    detachRoot(): void;
    /** detaches and forgets everything; the engine must not be used afterwards */
    dispose(): void;

    /** registers (or, with `null`, unregisters) an element whose geometry the engine measures */
    registerMeasurable(
        id: string,
        kind: MeasurableKind,
        element: HTMLElement | null,
    ): void;
    /**
     * registers (or unregisters) a tab container's tab list for tab overflow: when its tabs do
     * not fit, the engine hides the ones that do not (keeping the selected one) and reports them
     * through `getHiddenTabs`. `vertical` is the direction the tabs run
     */
    registerTabList(
        containerId: string,
        element: HTMLElement | null,
        vertical?: boolean,
    ): void;
    /**
     * registers (or unregisters) the overflow trigger of a tab container: the space it takes is
     * reserved in the strip
     */
    registerOverflowTrigger(
        containerId: string,
        element: HTMLElement | null,
    ): void;
    /** the ids of a container's tabs hidden by tab overflow (the same array until it changes) */
    getHiddenTabs(containerId: string): readonly string[];
    /** calls `listener` when a container's hidden tabs change; returns its remover */
    subscribeOverflow(listener: () => void): () => void;
    /** registers (or unregisters) the element a tab's content panel is positioned with */
    registerTabPanel(tabId: string, element: HTMLElement | null): void;
    /**
     * registers a splitter element; returns its remover. Its thickness (its width while
     * `isHorizontal()`, its height otherwise) becomes the splitter size of every layout of the model
     */
    registerSplitter(
        element: HTMLElement,
        isHorizontal: () => boolean,
    ): () => void;
    /** calls `listener` after a measure pass changed a measured rect of this layout; returns its remover */
    subscribeGeometry(listener: () => void): () => void;
    /** the registered elements (tests and debugging) */
    getRegistrations(): {
        measurables: ReadonlyMap<
            string,
            { kind: MeasurableKind; id: string; element: HTMLElement }
        >;
        tabPanels: ReadonlyMap<string, HTMLElement>;
        splitters: ReadonlyMap<HTMLElement, () => boolean>;
    };

    /** a measured rect of a node of this layout, relative to the layout root */
    rect(kind: MeasurableKind, id: string): Rect | undefined;
    /** an element's rect relative to the layout root */
    rectInLayout(element: HTMLElement): Rect;
    /** the layout root's rect in viewport coordinates (cached for a measure pass) */
    getDomRect(): Rect;
    /** the layout root's rect in viewport coordinates, measured now */
    getFreshDomRect(): Rect;
    /**
     * the edge drop bands of this layout's root row, relative to the layout root: where a drop
     * docks to an edge, and where an edge indicator goes. Empty when edge docking is off
     */
    edgeBands(): EdgeBand[];

    /**
     * the element that hosts a tab's content (`<div data-dockable-moveable>`), created on first
     * use and kept for as long as the tab exists, so moving a tab never remounts its content
     */
    getMoveableElement(tabId: string): HTMLElement;
    /**
     * moves the tab's moveable element into `panel`. The same element is re-parented, never
     * cloned, so content state survives moves between panels and documents
     */
    attachMoveable(
        tabId: string,
        panel: HTMLElement,
        options?: MoveableOptions,
    ): void;
    /**
     * parks the tab's moveable element in the hidden moveables home when its panel goes away, so
     * its content is never destroyed by unmounting a panel
     */
    releaseMoveable(
        tabId: string,
        panel?: HTMLElement,
        options?: MoveableOptions,
    ): void;
    /** hands a tab's moveable element over (a drag group transfer); undefined if none */
    takeMoveable(tabId: string): HTMLElement | undefined;
    /** adopts another model's moveable element for a tab (a drag group transfer) */
    adoptMoveable(tabId: string, element: HTMLElement | undefined): void;
    /**
     * whether a tab's content should be rendered: once rendered it stays rendered; before that,
     * when its content area has a size and it is selected (or `renderOnDemand` is off)
     */
    shouldRender(tabId: string, renderOnDemand?: boolean): boolean;

    /**
     * call on every `pointerdown` of the document (capture phase): a press in the main layout's
     * area outside an open overlay panel closes that panel. Returns true when a panel closed
     */
    handleOverlayPointerDown(event: {
        target: EventTarget | null;
        clientX: number;
        clientY: number;
    }): boolean;
    /**
     * call on every `keydown` with the close key: with focus in an open overlay panel or on its
     * tab button, the key closes the panel. Returns true (and prevents the default) when it did
     */
    handleOverlayKeyDown(
        event: KeyEventLike & { preventDefault(): void },
        key: string | undefined,
    ): boolean;

    /** whether splitters resize live (else they preview and commit on release) */
    isRealtimeResize(): boolean;
    /** marks a splitter drag of the model as started or ended */
    setSplitterDragging(dragging: boolean): void;
    /** the drag-and-drop state machine of this layout */
    getDragDropManager(): DragDropManager;
    /** the drag group this layout exchanges tabs in (the main engine's), if any */
    getDragGroup(): DragGroup | undefined;
    /** the handler that accepts foreign drags (set on the main engine) */
    getOnExternalDrag(): OnExternalDrag<T> | undefined;
    /** seconds a view may take to animate the drop outline */
    getTabDragSpeed(): number;
    /** the popout windows of the model (owned by the main engine) */
    getPopoutManager(): PopoutManager<T>;
}
