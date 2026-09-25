// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx and src/view/TabSet.tsx (drag start/end, tabset activation);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    Actions,
    createSplitterController,
    DragDropManager,
    type DragState,
    type IDraggable,
    type ISplitterAria,
    type ISplitterState,
    type LayoutEngine,
    type Model,
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
    const state: TabSetState = {
        active: node.isActive(),
        maximized: node.isMaximized(),
        hidden: maximizedTabset !== undefined && maximizedTabset !== node,
        empty: node.getChildren().length === 0,
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
