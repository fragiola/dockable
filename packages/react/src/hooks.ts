// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type BorderNode,
    createSplitterController,
    type DockableTypes,
    DragDropManager,
    type DragState,
    type DropLocation,
    type DropZoneOptions,
    type LayoutEngine,
    type LayoutState,
    type Model,
    type NewTabDropped,
    type RowNode,
    type SplitterAria,
    type SplitterController,
    type SplitterState,
    type TabContainer,
    type TabInitOf,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import * as React from "react";
import {
    ModelContext,
    typedEngine,
    typedModel,
    useDockableContext,
    useLayoutContext,
} from "./context";

export interface UseDockableResult<T extends DockableTypes = AnyTypes> {
    /**
     * the model of the enclosing `Dockable.Root`: the layout's data and its rules. Change the layout
     * with `model.run("tab.close", { tabId: tab })`, read it with `model.get`/`model.is`
     */
    model: Model<T>;
    /**
     * the engine of the layout this component renders in (the main layout's, or a popout
     * window's): screen actions (`engine.run("popout", { nodeId: node })`) and view facts (`engine.get`)
     */
    engine: LayoutEngine<T>;
    /** the id of the layout this component renders in: `"main"` or a window's id */
    layoutId: string;
}

/**
 * The model, the engine and the layout of the enclosing `Dockable.Root`. Pass the model's registry
 * as the type argument (`useDockable<Types>()`); a child cannot infer it through context.
 */
export function useDockable<
    T extends DockableTypes = AnyTypes,
>(): UseDockableResult<T> {
    const context = useDockableContext("useDockable");
    const layout = useLayoutContext("useDockable");
    const model = typedModel<T>(context.model);
    return {
        model,
        engine: typedEngine<T>(layout.engine),
        layoutId: layout.layoutId,
    };
}

/**
 * A value selected from the model's state, re-rendering the component only when the selection
 * changes (`isEqual`, `Object.is` by default). The selector runs once per state; keep it pure.
 *
 * ```ts
 * const count = useModelState<Types, number>((state, model) => model.get("all-tabs").length);
 * ```
 */
export function useModelState<T extends DockableTypes = AnyTypes, S = unknown>(
    selector: (state: LayoutState<T>, model: Model<T>) => S,
    isEqual: (a: S, b: S) => boolean = Object.is,
): S {
    const erased = React.useContext(ModelContext);
    if (!erased) {
        throw new Error("useModelState must be used inside Dockable.Root");
    }
    const model = typedModel<T>(erased);
    const latest = React.useRef({ selector, isEqual });
    latest.current = { selector, isEqual };
    // the last selection, and what it was computed from: a new state, model or selector (a closure
    // over new props) selects again
    const cache = React.useRef<
        | {
              state: LayoutState<T>;
              value: S;
              model: Model<T>;
              selector: typeof selector;
          }
        | undefined
    >(undefined);
    const subscribe = React.useCallback(
        (onChange: () => void) => model.subscribe(() => onChange()),
        [model],
    );
    const getSnapshot = (): S => {
        const state = model.state;
        const current = latest.current.selector;
        const previous = cache.current;
        if (
            previous?.state === state &&
            previous.model === model &&
            previous.selector === current
        ) {
            return previous.value;
        }
        const value = current(state, model);
        const kept =
            previous !== undefined &&
            previous.model === model &&
            latest.current.isEqual(previous.value, value)
                ? previous.value
                : value;
        cache.current = { state, value: kept, model, selector: current };
        return kept;
    };
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface TabSetState {
    /** the tabset is its layout's active tabset */
    active: boolean;
    /** the tabset is maximized */
    maximized: boolean;
    /** another tabset of the layout is maximized, so this one is hidden */
    hidden: boolean;
    /** the tabset has no tabs */
    empty: boolean;
    /** the current drag would drop into or beside this tabset (its content or its strip) */
    dropTarget: boolean;
    /** while it is the drop target: where the drag would dock relative to it */
    dropLocation: DropLocation | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    dropRefused: boolean;
    /**
     * while the drag aims at this tabset's strip: the index among its tabs the tab would be
     * inserted at (its length for the end), else `undefined`
     */
    dropIndex: number | undefined;
}

/** @internal what `TabList` and `Border` read of the current drop; apps read `TabSetState` */
export interface TabSetDropState {
    /** the current drag would drop into or beside this tabset */
    target: boolean;
    /** while it is the target: where the drag would dock */
    location: DropLocation | undefined;
    /** while it is the target: the drop goes into its tab strip, at `index` */
    strip: boolean;
    /** for a strip drop: the insertion index among the tabset's children, else -1 */
    index: number;
    /** the current drag is over this tabset, but a drop rule refuses it */
    refused: boolean;
}

const NO_DROP: TabSetDropState = {
    target: false,
    location: undefined,
    strip: false,
    index: -1,
    refused: false,
};

const DROP_LOCATIONS: readonly DropLocation[] = [
    "center",
    "top",
    "bottom",
    "left",
    "right",
];

/**
 * Whether the current drag targets (or is refused by) `tabsetId`, from the engine's indicator
 * state. The snapshot is a string, so tabsets re-render only when their own answer changes, not
 * on every pointer move.
 */
export function useTabSetDropState<T extends DockableTypes>(
    engine: LayoutEngine<T>,
    tabsetId: string,
): TabSetDropState {
    const manager = engine.adapter.getDragDropManager();
    const key = React.useSyncExternalStore(
        manager.subscribe,
        () => {
            const indicator = manager.getIndicatorState();
            if (indicator.refused && indicator.refusedTabSetId === tabsetId) {
                return "refused";
            }
            if (indicator.visible && indicator.targetTabSetId === tabsetId) {
                // a strip drop targets the tabset itself, at an index
                const strip =
                    indicator.location === "center" &&
                    indicator.index >= 0 &&
                    indicator.targetNodeId === tabsetId;
                return strip
                    ? `${indicator.location}:${indicator.index}`
                    : indicator.location;
            }
            return "";
        },
        () => "",
    );
    return React.useMemo(() => {
        if (key === "") return NO_DROP;
        if (key === "refused") return { ...NO_DROP, refused: true };
        const [name, index] = key.split(":");
        const location = DROP_LOCATIONS.find((l) => l === name);
        return {
            target: true,
            location,
            strip: index !== undefined,
            index: index === undefined ? -1 : Number(index),
            refused: false,
        };
    }, [key]);
}

export interface UseTabSetResult {
    /** what the tabset shows as `data-*` */
    state: TabSetState;
    /** what goes on the tabset's element */
    props: {
        /** callback ref (measured as the tabset) */
        ref: React.RefCallback<HTMLElement>;
        /** makes the tabset active on a primary pointer press */
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    };
}

function isAuxEvent(event: React.PointerEvent | React.MouseEvent) {
    return (
        event.button !== 0 ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
    );
}

/**
 * The lower layer of `Dockable.TabSet`: its state, and the props for its element (the measurement
 * ref and the activation handler).
 */
export function useTabSet<T extends DockableTypes>(
    node: TabsetNode<T>,
): UseTabSetResult {
    const { model } = useDockableContext("useTabSet");
    const { engine, layoutId } = useLayoutContext("useTabSet");
    const id = node.id;
    const drop = useTabSetDropState(engine, id);
    const active =
        model.get("active-tabset-by-layout-id", { layoutId })?.id === id;
    const state: TabSetState = {
        active,
        maximized:
            model.get("maximized-tabset-by-layout-id", { layoutId })?.id === id,
        hidden: model.is("node-hidden-by-maximize", { nodeId: id }),
        empty: node.children.length === 0,
        dropTarget: drop.target,
        dropLocation: drop.location,
        dropRefused: drop.refused,
        dropIndex: drop.strip ? drop.index : undefined,
    };
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.adapter.registerMeasurable(id, "tabset", element);
        },
        [engine, id],
    );
    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (
            !isAuxEvent(event) &&
            model.get("active-tabset-by-layout-id", { layoutId })?.id !== id
        ) {
            model.run("tabset.activate", { tabsetId: id });
        }
    };
    return { state, props: { ref, onPointerDown } };
}

export interface BorderState {
    /** the side of the layout the border is on */
    location: "top" | "bottom" | "left" | "right";
    /** the direction its tabs run: `"vertical"` for a left or right border */
    orientation: "horizontal" | "vertical";
    /** a tab is selected, so the border's panel is open */
    open: boolean;
    /** the panel opens over the layout (`mode: "overlay"`) instead of beside it */
    overlay: boolean;
    /** the border has no tabs */
    empty: boolean;
    /** a left border's tab direction (the `tabDirection` prop): `"up"` (default) or `"down"` */
    tabDirection: "up" | "down" | undefined;
    /** the current drag would drop into this border (its strip or its open panel) */
    dropTarget: boolean;
    /** the current drag is over this border, but a drop rule refuses it */
    dropRefused: boolean;
}

export interface UseBorderOptions {
    /** a left border's tab direction; default `"up"` */
    tabDirection?: "up" | "down" | undefined;
}

export interface UseBorderResult {
    /** what the border shows as `data-*` */
    state: BorderState;
    /** what goes on the border's strip */
    props: {
        /** callback ref (measured as the border's tab header) */
        ref: React.RefCallback<HTMLElement>;
    };
}

/** The lower layer of `Dockable.Border`: its state, and the props for its strip. */
export function useBorder<T extends DockableTypes>(
    node: BorderNode<T>,
    options: UseBorderOptions = {},
): UseBorderResult {
    const { model } = useDockableContext("useBorder");
    const { engine } = useLayoutContext("useBorder");
    const id = node.id;
    const drop = useTabSetDropState(engine, id);
    const location = node.location;
    const vertical = location === "left" || location === "right";
    const state: BorderState = {
        location,
        orientation: vertical ? "vertical" : "horizontal",
        open: node.selected !== -1,
        overlay: model.is("border-overlay", { borderId: id }),
        empty: node.children.length === 0,
        tabDirection:
            location === "left" ? (options.tabDirection ?? "up") : undefined,
        dropTarget: drop.target,
        dropRefused: drop.refused,
    };
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.adapter.registerMeasurable(id, "borderheader", element);
        },
        [engine, id],
    );
    return { state, props: { ref } };
}

export interface UseTabOverflowResult<T extends DockableTypes = AnyTypes> {
    /** some of the container's tabs do not fit, so they are hidden */
    overflowing: boolean;
    /** the hidden tabs, in model order: what an overflow menu lists */
    hiddenTabs: TabOf<T>[];
    /** the tabs that stay in the strip, in model order */
    visibleTabs: TabOf<T>[];
}

/**
 * Tab overflow of a tabset or a border: which of its tabs are hidden because they do not fit in
 * its `Dockable.TabList` (the engine measures the list, the tabs and the
 * `Dockable.TabOverflowTrigger`). The selected tab is never hidden.
 */
export function useTabOverflow<T extends DockableTypes>(
    container: TabContainer<T>,
): UseTabOverflowResult<T> {
    const { engine } = useLayoutContext("useTabOverflow");
    const id = container.id;
    const hiddenIds = React.useSyncExternalStore(
        engine.adapter.subscribeOverflow,
        () => engine.adapter.getHiddenTabs(id),
        () => engine.adapter.getHiddenTabs(id),
    );
    const hiddenSet = new Set(hiddenIds);
    return {
        overflowing: hiddenIds.length > 0,
        hiddenTabs: container.children.filter((tab) => hiddenSet.has(tab.id)),
        visibleTabs: container.children.filter((tab) => !hiddenSet.has(tab.id)),
    };
}

/** Whether tab overflow hides a tab of `containerId` (only its own changes re-render). */
export function useTabHidden(containerId: string, tabId: string): boolean {
    const { engine } = useLayoutContext("useTabHidden");
    return React.useSyncExternalStore(
        engine.adapter.subscribeOverflow,
        () => engine.adapter.getHiddenTabs(containerId).includes(tabId),
        () => false,
    );
}

export interface UseSplitterState extends SplitterState {
    /** `"vertical"` for a splitter between side by side children (the separator's orientation) */
    orientation: SplitterAria["orientation"];
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
}

export interface UseSplitterResult {
    /** what the splitter shows as `data-*` */
    state: UseSplitterState;
    /**
     * what goes on the splitter's element: the ref, `role="separator"` and its ARIA values, focus,
     * the pointer and key handlers, and the structural style (hidden, and the outline preview)
     */
    props: {
        ref: React.RefCallback<HTMLElement>;
        role: "separator";
        tabIndex: 0;
        "aria-orientation": SplitterAria["orientation"];
        "aria-valuenow": number | undefined;
        "aria-valuemin": number | undefined;
        "aria-valuemax": number | undefined;
        "aria-valuetext": string | undefined;
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
        style: React.CSSProperties;
    };
    /** the headless controller behind it (drag and keyboard resizing), for a custom gesture */
    controller: SplitterController;
}

/**
 * The lower layer of `Dockable.Splitter`: the splitter before child `index` (1-based) of `node` (a
 * row, or a border with no index). Spread `props` on the separator element.
 */
export function useSplitter<T extends DockableTypes>(
    node: RowNode<T> | BorderNode<T>,
    index = 0,
): UseSplitterResult {
    const { engine } = useLayoutContext("useSplitter");
    const id = node.id;
    const controller = React.useMemo(
        () => createSplitterController(engine, id, index),
        [engine, id, index],
    );
    React.useEffect(() => () => controller.dispose(), [controller]);
    const state = React.useSyncExternalStore(
        controller.subscribe,
        controller.getState,
        controller.getState,
    );
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            controller.attach(element);
        },
        [controller],
    );
    const aria = controller.getAria();
    const hidden = controller.isHidden();
    const style: React.CSSProperties = {};
    if (node.type === "border") {
        // an overlay border's content ignores presses (pointer-events: none), except its splitter
        style.pointerEvents = "auto";
    }
    if (hidden) {
        style.display = "none";
    }
    if (state.previewOffset !== undefined) {
        style.transform =
            aria.orientation === "vertical"
                ? `translateX(${state.previewOffset}px)`
                : `translateY(${state.previewOffset}px)`;
    }
    return {
        state: { ...state, orientation: aria.orientation, hidden },
        props: {
            ref,
            role: "separator",
            tabIndex: 0,
            "aria-orientation": aria.orientation,
            "aria-valuenow": aria.valueNow,
            "aria-valuemin": aria.valueMin,
            "aria-valuemax": aria.valueMax,
            "aria-valuetext": aria.valueText,
            onPointerDown: (event) =>
                controller.onPointerDown(event.nativeEvent),
            onKeyDown: (event) => {
                controller.onKeyDown(event.nativeEvent);
                if (event.nativeEvent.defaultPrevented) {
                    event.preventDefault();
                }
            },
            style,
        },
        controller,
    };
}

/** The page-wide drag in progress (re-renders when a drag starts or ends). */
export function useDragState(): DragState | undefined {
    return React.useSyncExternalStore(
        DragDropManager.subscribeDrag,
        DragDropManager.getDragState,
        DragDropManager.getDragState,
    );
}

/** What goes on a draggable element. */
export interface DragProps {
    /** whether the element is draggable */
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: (event: React.DragEvent<HTMLElement>) => void;
    /**
     * callback ref for the element the browser snapshots as the drag image: the dragged element
     * itself, unless you attach it to another one
     */
    ref: React.RefCallback<HTMLElement>;
}

export interface UseDragNodeResult {
    state: {
        /** this node is being dragged */
        dragging: boolean;
    };
    /** what goes on the dragged element (`draggable` is the node's `enableDrag`) */
    props: DragProps;
}

/**
 * The lower layer of a draggable part: wires a tab or a tabset to the core's drag-and-drop
 * machine. Spread `props` on the dragged element.
 */
export function useDragNode<T extends DockableTypes>(
    node: TabOf<T> | TabsetNode<T>,
): UseDragNodeResult {
    const { model } = useDockableContext("useDragNode");
    const { engine } = useLayoutContext("useDragNode");
    const imageRef = React.useRef<HTMLElement | null>(null);
    const dragState = useDragState();
    const id = node.id;
    const enabled = () => {
        const current = model.get("node-by-id", { nodeId: id });
        if (current?.type === "tab") {
            return (
                model.get("tab-settings-by-id", { tabId: id })?.enableDrag ??
                false
            );
        }
        if (current?.type === "tabset") {
            return (
                model.get("tabset-settings-by-id", { tabsetId: id })
                    ?.enableDrag ?? false
            );
        }
        return false;
    };

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (!enabled()) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        engine.adapter
            .getDragDropManager()
            .startDrag(
                event.nativeEvent,
                id,
                imageRef.current ?? event.currentTarget,
            );
    };
    const onDragEnd = () => {
        engine.adapter.getDragDropManager().onDragEnded();
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        state: {
            // this model's drag only: models of a drag group may share ids
            dragging:
                dragState !== undefined &&
                dragState.subjectOf(model) !== undefined &&
                dragState.dragId === id,
        },
        props: { draggable: enabled(), onDragStart, onDragEnd, ref },
    };
}

export interface UseDragSourceOptions<T extends DockableTypes = AnyTypes> {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model<T>;
    /**
     * the tab a drop creates (a `tab.add` init, checked against the registry). A function is called
     * at each drag start, so every drop can get fresh data.
     */
    tab: TabInitOf<T> | (() => TabInitOf<T>);
    /** called after the drop with the new tab's id, or `undefined` when the add was refused */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
}

export interface UseDragSourceResult {
    state: {
        /** a drag started by this source is in progress */
        dragging: boolean;
    };
    /** what goes on the source element (`draggable` is false while `disabled`) */
    props: DragProps;
}

/**
 * The lower layer of `Dockable.DragSource`: turns any element, inside or outside the layout (a
 * sidebar item, a palette entry), into a source of new tabs. Dropping it on the layout runs
 * `tab.add` through the model's middleware. Spread `props` on the element.
 */
export function useDragSource<T extends DockableTypes>(
    options: UseDragSourceOptions<T>,
): UseDragSourceResult {
    const { model, tab, onDrop, disabled = false } = options;
    const imageRef = React.useRef<HTMLElement | null>(null);
    const started = React.useRef<DragState | undefined>(undefined);
    const dragState = useDragState();

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (
            disabled ||
            !DragDropManager.startAddDrag(
                model,
                event.nativeEvent,
                typeof tab === "function" ? tab() : tab,
                onDrop,
                imageRef.current ?? event.currentTarget,
            )
        ) {
            // no layout to drop into (not mounted yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        started.current = DragDropManager.getDragState();
    };
    const onDragEnd = () => {
        if (
            started.current !== undefined &&
            DragDropManager.getDragState() === started.current
        ) {
            DragDropManager.endDrag();
        }
        started.current = undefined;
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        state: {
            dragging: dragState !== undefined && dragState === started.current,
        },
        props: { draggable: !disabled, onDragStart, onDragEnd, ref },
    };
}

export interface UseDropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** the model whose drags the zone takes */
    model: Model<T>;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: DropZoneOptions<T>["accepts"];
    /**
     * called when the drag is dropped on the zone, with what is dragged: `{ kind: "tab", tab }`,
     * `{ kind: "tabset", tabset }` or, for a new tab (a `Dockable.DragSource` or a foreign drag),
     * `{ kind: "new", tab }`. Nothing is moved: run the command you want (`tab.close`).
     */
    onDrop: DropZoneOptions<T>["onDrop"];
}

export interface UseDropZoneResult {
    state: {
        /** a drag the zone takes is over it */
        over: boolean;
        /** a drag the zone would take is in progress */
        active: boolean;
    };
    /** what goes on the zone's element */
    props: {
        /** callback ref */
        ref: React.RefCallback<HTMLElement>;
    };
}

/**
 * The lower layer of `Dockable.DropZone`: makes an element, inside or outside the layout, a place
 * where a drag of the layout can be dropped for the consumer to handle (a trash can, an "open to
 * the right" pad). Spread `props` on the element.
 */
export function useDropZone<T extends DockableTypes>(
    options: UseDropZoneOptions<T>,
): UseDropZoneResult {
    const { model } = options;
    const latest = React.useRef(options);
    latest.current = options;
    const [element, setElement] = React.useState<HTMLElement | null>(null);
    const [over, setOver] = React.useState(false);
    const dragState = useDragState();

    React.useLayoutEffect(() => {
        if (!element) {
            return;
        }
        const unregister = DragDropManager.registerDropZone(model, element, {
            accepts: (drag) => latest.current.accepts?.(drag) ?? true,
            onDrop: (drag, event) => latest.current.onDrop(drag, event),
            onOverChange: setOver,
        });
        return () => {
            unregister();
            setOver(false);
        };
    }, [model, element]);

    const subject = dragState?.subjectOf(model);
    const active =
        subject !== undefined && (options.accepts?.(subject) ?? true);
    return {
        state: { over: over && active, active },
        props: { ref: setElement },
    };
}
