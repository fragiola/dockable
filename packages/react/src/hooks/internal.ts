import {
    DragDropManager,
    type DragState,
    type DropIndicatorSnapshot,
    type DropLocation,
    type LayoutEngine,
    type MeasurableKind,
} from "@fragiola/dockable";
import * as React from "react";
import { useLayoutContext } from "../context";

/** @internal the engine's drop indicator state, selected: re-renders only when the selection changes */
export function useIndicator<S>(
    engine: LayoutEngine,
    select: (indicator: DropIndicatorSnapshot) => S,
): S {
    const manager = engine.adapter.getDragDropManager();
    const snapshot = () => select(manager.getIndicatorState());
    return React.useSyncExternalStore(manager.subscribe, snapshot, snapshot);
}

/** @internal a callback ref that registers its element with the engine, measured as `kind` */
export function useMeasurable(
    engine: LayoutEngine,
    id: string,
    kind: MeasurableKind,
): React.RefCallback<HTMLElement> {
    return React.useCallback(
        (element: HTMLElement | null) => {
            engine.adapter.registerMeasurable(id, kind, element);
        },
        [engine, id, kind],
    );
}

/** @internal what `TabList` and `Border` read of the current drop; apps read `TabSetState` */
export interface TabSetDropState {
    /** the current drag would drop into or beside this tabset */
    target: boolean;
    /** while it is the target: where the drag would dock */
    location: DropLocation | undefined;
    /** while the drop goes into its tab strip: the insertion index among its tabs */
    index: number | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    refused: boolean;
}

/**
 * Whether the current drag targets (or is refused by) `tabsetId`, from the engine's indicator
 * state. The core keeps the answer the same object until it changes, so tabsets re-render only
 * when their own answer changes, not on every pointer move.
 */
export function useTabSetDropState(
    engine: LayoutEngine,
    tabsetId: string,
): TabSetDropState {
    const manager = engine.adapter.getDragDropManager();
    const snapshot = () => engine.adapter.getDropState(tabsetId);
    return React.useSyncExternalStore(manager.subscribe, snapshot, snapshot);
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

/** The page-wide drag in progress (re-renders when a drag starts or ends). */
export function useDragState(): DragState | undefined {
    return React.useSyncExternalStore(
        DragDropManager.subscribeDrag,
        DragDropManager.getDragState,
        DragDropManager.getDragState,
    );
}
