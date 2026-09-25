// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    Actions,
    createSplitterController,
    DragDropManager,
    type DragState,
    type DropLocation,
    type IDraggable,
    type IDropZoneOptions,
    type IJsonTabNode,
    type ISplitterAria,
    type ISplitterState,
    LayoutEngine,
    type Model,
    type NewTabDropped,
    type Node,
    type RowNode,
    type SplitterController,
    type TabSetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { type GetLabel, useDockableContext, useLayoutContext } from "./context";

export interface UseDockableResult {
    /** the engine of the layout this component renders in (the main layout or a popout's) */
    engine: LayoutEngine;
    /** the main layout's engine */
    mainEngine: LayoutEngine;
    model: Model;
    /** the id of the layout this component renders in */
    layoutId: string;
    getLabel: GetLabel | undefined;
}

/**
 * The lower layer: the engine, model and layout of the enclosing `Dockable.Root`. Dispatch
 * actions with `engine.doAction(Actions.x(...))` so they go through `onAction`.
 */
export function useDockable(): UseDockableResult {
    const context = useDockableContext("useDockable");
    const layout = useLayoutContext("useDockable");
    return {
        engine: layout.engine,
        mainEngine: context.engine,
        model: context.model,
        layoutId: layout.layoutId,
        getLabel: context.getLabel,
    };
}

export interface TabSetState {
    /** the tabset is the model's active tabset */
    active: boolean;
    /** the tabset is maximized */
    maximized: boolean;
    /** another tabset of the layout is maximized, so this one is hidden */
    hidden: boolean;
    /** the tabset has no tabs */
    empty: boolean;
    /** the current drag would drop into or beside this tabset (its content, strip or a group) */
    dropTarget: boolean;
    /** while it is the drop target: where the drag would dock relative to it */
    dropLocation: DropLocation | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    dropRefused: boolean;
}

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

/**
 * Whether the current drag targets (or is refused by) `tabsetId`, from the engine's indicator
 * state. The snapshot is a string, so tabsets re-render only when their own answer changes, not
 * on every pointer move.
 */
export function useTabSetDropState(
    engine: LayoutEngine,
    tabsetId: string,
): TabSetDropState {
    const manager = engine.getDragDropManager();
    const key = React.useSyncExternalStore(
        manager.subscribe,
        () => {
            const indicator = manager.getIndicatorState();
            if (indicator.refused && indicator.refusedTabSetId === tabsetId) {
                return "refused";
            }
            if (indicator.visible && indicator.targetTabSetId === tabsetId) {
                const strip =
                    indicator.location === "center" && indicator.index >= 0;
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
        const [location, index] = key.split(":");
        return {
            target: true,
            location: location as DropLocation,
            strip: index !== undefined,
            index: index === undefined ? -1 : Number(index),
            refused: false,
        };
    }, [key]);
}

export interface UseTabSetResult {
    state: TabSetState;
    /** callback ref for the tabset's element (measured as the tabset) */
    ref: React.RefCallback<HTMLElement>;
    /** makes the tabset active on a primary pointer press */
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
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

/** The lower layer of `Dockable.TabSet`: its state, measurement ref and activation handler. */
export function useTabSet(node: TabSetNode): UseTabSetResult {
    const { engine, layoutId } = useLayoutContext("useTabSet");
    const maximizedTabset = node.getModel().getMaximizedTabset(layoutId);
    const drop = useTabSetDropState(engine, node.getId());
    const state: TabSetState = {
        active: node.isActive(),
        maximized: node.isMaximized(),
        hidden: maximizedTabset !== undefined && maximizedTabset !== node,
        empty: node.getChildren().length === 0,
        dropTarget: drop.target,
        dropLocation: drop.location,
        dropRefused: drop.refused,
    };
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            engine.registerMeasurable(node, "tabset", element);
        },
        [engine, node],
    );
    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (!isAuxEvent(event) && !node.isActive()) {
            engine.doAction(Actions.setActiveTabset(node.getId(), layoutId));
        }
    };
    return { state, ref, onPointerDown };
}

export interface UseSplitterResult {
    controller: SplitterController;
    state: ISplitterState;
    aria: ISplitterAria;
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
    /** callback ref for the splitter's element */
    ref: React.RefCallback<HTMLElement>;
}

/**
 * The lower layer of `Dockable.Splitter`: a headless controller for the splitter before child
 * `index` (1-based) of `node`, its drag state and ARIA values.
 */
export function useSplitter(node: RowNode, index: number): UseSplitterResult {
    const { engine } = useLayoutContext("useSplitter");
    const controller = React.useMemo(
        () => createSplitterController(engine, node, index),
        [engine, node, index],
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
    return {
        controller,
        state,
        aria: controller.getAria(),
        hidden: controller.isHidden(),
        ref,
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

export interface UseDragNodeResult {
    /** whether the element is draggable: the node's `enableDrag` */
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: (event: React.DragEvent<HTMLElement>) => void;
    /** callback ref for the element used as the drag image (the dragged element by default) */
    ref: React.RefCallback<HTMLElement>;
    /** this node is being dragged */
    dragging: boolean;
}

/**
 * The lower layer of a draggable part: wires a node (a tab, tabset or group) to the core's
 * drag-and-drop machine. Spread `draggable`, `onDragStart` and `onDragEnd` on the element and
 * attach `ref` to the element the browser should snapshot as the drag image.
 */
export function useDragNode(
    node: Node & IDraggable & { isEnableDrag(): boolean },
): UseDragNodeResult {
    const { engine } = useLayoutContext("useDragNode");
    const imageRef = React.useRef<HTMLElement | null>(null);
    const dragState = useDragState();
    const draggable = node.isEnableDrag();

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (!node.isEnableDrag()) {
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // a tab drag must not also start a tabset drag
        engine
            .getDragDropManager()
            .setDragNode(
                event.nativeEvent,
                node,
                imageRef.current ?? event.currentTarget,
            );
    };
    const onDragEnd = () => {
        engine.getDragDropManager().onDragEnded();
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        draggable,
        onDragStart,
        onDragEnd,
        ref,
        dragging:
            dragState?.dragNode !== undefined &&
            dragState.dragNode.getId() === node.getId(),
    };
}

export interface UseDragSourceOptions {
    /** the model of the layout the new tab is dropped into (its `Dockable.Root` must be mounted) */
    model: Model;
    /**
     * the tab a drop creates. A function is called at each drag start, so every drop can get a
     * fresh name or config.
     */
    json: IJsonTabNode | (() => IJsonTabNode);
    /** called after the drop with the created tab, or `undefined` when `onAction` vetoed it */
    onDrop?: NewTabDropped | undefined;
    /** no drag starts while true */
    disabled?: boolean | undefined;
}

export interface UseDragSourceResult {
    /** whether the element is draggable */
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: (event: React.DragEvent<HTMLElement>) => void;
    /** callback ref for the element used as the drag image (the dragged element by default) */
    ref: React.RefCallback<HTMLElement>;
    /** a drag started by this source is in progress */
    dragging: boolean;
}

/**
 * The lower layer of `Dockable.DragSource`: turns any element, inside or outside the layout (a
 * sidebar item, a palette entry), into a source of new tabs. Dropping it on the layout dispatches
 * `Actions.addTab(json, …)` through the engine, so `onAction` and `onAllowDrop` apply. Spread
 * `draggable`, `onDragStart` and `onDragEnd` on the element.
 */
export function useDragSource(
    options: UseDragSourceOptions,
): UseDragSourceResult {
    const { model, json, onDrop, disabled = false } = options;
    const imageRef = React.useRef<HTMLElement | null>(null);
    const started = React.useRef<DragState | undefined>(undefined);
    const dragState = useDragState();

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        const engine = LayoutEngine.of(model);
        if (disabled || !engine) {
            // no layout to drop into (not mounted yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        const manager = engine.getDragDropManager();
        manager.addTabWithDragAndDrop(
            event.nativeEvent,
            typeof json === "function" ? json() : json,
            onDrop,
            imageRef.current ?? event.currentTarget,
        );
        started.current = DragDropManager.getDragState();
    };
    const onDragEnd = () => {
        if (
            started.current !== undefined &&
            DragDropManager.getDragState() === started.current
        ) {
            LayoutEngine.of(model)?.getDragDropManager().onDragEnded();
        }
        started.current = undefined;
    };
    const ref = React.useCallback((element: HTMLElement | null) => {
        imageRef.current = element;
    }, []);

    return {
        draggable: !disabled,
        onDragStart,
        onDragEnd,
        ref,
        dragging: dragState !== undefined && dragState === started.current,
    };
}

export interface UseDropZoneOptions {
    /** the model whose drags the zone takes */
    model: Model;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: IDropZoneOptions["accepts"];
    /**
     * called when the drag is dropped on the zone, with the dragged node. Nothing is moved: dispatch
     * the action you want (e.g. `Actions.deleteTab`). For a new-tab drag (a `Dockable.DragSource`
     * or a foreign drag) the node is a temporary tab that is not in the model.
     */
    onDrop: IDropZoneOptions["onDrop"];
}

export interface UseDropZoneResult {
    /** callback ref for the zone's element */
    ref: React.RefCallback<HTMLElement>;
    /** a drag the zone takes is over it */
    over: boolean;
    /** a drag the zone would take is in progress */
    active: boolean;
}

/**
 * The lower layer of `Dockable.DropZone`: makes an element, inside or outside the layout, a place
 * where a drag of the layout can be dropped for the consumer to handle (a trash can, an "open to
 * the right" pad). Attach `ref` to the element.
 */
export function useDropZone(options: UseDropZoneOptions): UseDropZoneResult {
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
            accepts: (dragNode) => latest.current.accepts?.(dragNode) ?? true,
            onDrop: (dragNode, event) => latest.current.onDrop(dragNode, event),
            onOverChange: setOver,
        });
        return () => {
            unregister();
            setOver(false);
        };
    }, [model, element]);

    const dragNode = dragState?.dragNode;
    const active =
        dragNode !== undefined &&
        dragState?.mainEngine.getModel() === model &&
        (options.accepts?.(dragNode) ?? true);
    return { ref: setElement, over: over && active, active };
}
