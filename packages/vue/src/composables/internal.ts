import {
    type ContainerDropState,
    DragDropManager,
    type DragState,
    type DropIndicatorSnapshot,
    type LayoutEngine,
    type MeasurableKind,
} from "@fragiola/dockable";
import type { ComputedRef } from "vue";
import { useLayoutContext } from "../context";
import { registerElement } from "../utils/registration";
import { type ElementRef, elementRef, useExternal } from "../utils/render";

/** @internal the engine's drop indicator state, selected: triggers only when the selection changes */
export function useIndicator<S>(
    engine: LayoutEngine,
    select: (indicator: DropIndicatorSnapshot) => S,
): ComputedRef<S> {
    const manager = engine.adapter.getDragDropManager();
    return useExternal(manager.subscribe, () =>
        select(manager.getIndicatorState()),
    );
}

/** @internal a template ref that registers its element with the engine, measured as `kind` */
export function useMeasurable(
    engine: LayoutEngine,
    id: () => string,
    kind: MeasurableKind,
): ElementRef {
    return elementRef(
        (element) => {
            const nodeId = id();
            return registerElement(
                engine,
                `${kind}:${nodeId}`,
                element,
                (registered) =>
                    engine.adapter.registerMeasurable(nodeId, kind, registered),
            );
        },
        () => [id()],
    );
}

/** @internal what the current drag means for a tab container (the core's answer, stable) */
export function useDropState(
    engine: LayoutEngine,
    containerId: () => string,
): ComputedRef<ContainerDropState> {
    const manager = engine.adapter.getDragDropManager();
    return useExternal(manager.subscribe, () =>
        engine.adapter.getDropState(containerId()),
    );
}

/** @internal whether tab overflow hides a tab of its container (only its own changes trigger) */
export function useTabHidden(
    containerId: () => string,
    tabId: () => string,
): ComputedRef<boolean> {
    const { engine } = useLayoutContext("useTabHidden");
    return useExternal(engine.adapter.subscribeOverflow, () =>
        engine.adapter.getHiddenTabs(containerId()).includes(tabId()),
    );
}

/** @internal the page-wide drag in progress (triggers when a drag starts or ends) */
export function useDragState(): ComputedRef<DragState | undefined> {
    return useExternal(
        DragDropManager.subscribeDrag,
        DragDropManager.getDragState,
    );
}
