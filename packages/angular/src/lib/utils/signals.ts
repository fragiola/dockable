import { effect, type Signal, untracked } from "@angular/core";
import {
    type ContainerDropState,
    DragDropManager,
    type DragState,
    type DropIndicatorSnapshot,
    type LayoutEngine,
    type MeasurableKind,
} from "@fragiola/dockable";
import type { DockableContext } from "../context";
import { fromStore } from "./helpers";

/** The element each key of an engine was last registered with. */
const owners = new WeakMap<object, Map<string, HTMLElement>>();

/**
 * Registers `element` with the engine (`register(element)`) and returns its remover, which
 * unregisters (`register(null)`) only while `element` is still the one registered under `key`:
 * when a node moves to another parent (a tab dropped into another tabset), its new element can be
 * registered before its old one is destroyed, and the old remover must not unregister the new one.
 */
export function registerElement(
    engine: object,
    key: string,
    element: HTMLElement,
    register: (element: HTMLElement | null) => void,
): () => void {
    let registered = owners.get(engine);
    if (!registered) {
        registered = new Map();
        owners.set(engine, registered);
    }
    const map = registered;
    map.set(key, element);
    register(element);
    return () => {
        if (map.get(key) === element) {
            map.delete(key);
            register(null);
        }
    };
}

/**
 * Registers the host element with the engine, measured as `kind` for the node `id()`, for as long
 * as the directive lives (again when the engine or the id changes); the layout is measured after.
 */
export function bindMeasurable(
    context: DockableContext,
    engine: Signal<LayoutEngine>,
    element: HTMLElement,
    id: () => string,
    kind: MeasurableKind,
): void {
    effect((onCleanup) => {
        const current = engine();
        const nodeId = id();
        untracked(() => {
            onCleanup(
                registerElement(
                    current,
                    `${kind}:${nodeId}`,
                    element,
                    (registered) =>
                        current.adapter.registerMeasurable(
                            nodeId,
                            kind,
                            registered,
                        ),
                ),
            );
            context.scheduleMeasure(current);
        });
    });
}

/** The engine's drop indicator state, selected. */
export function indicatorSignal<S>(
    engine: Signal<LayoutEngine>,
    select: (indicator: DropIndicatorSnapshot) => S,
): Signal<S> {
    return fromStore(
        () => engine().adapter.getDragDropManager().subscribe,
        () => select(engine().adapter.getDragDropManager().getIndicatorState()),
    );
}

/** What the current drag means for a tab container (the core's answer, stable). */
export function dropStateSignal(
    engine: Signal<LayoutEngine>,
    containerId: () => string,
): Signal<ContainerDropState> {
    return fromStore(
        () => engine().adapter.getDragDropManager().subscribe,
        () => engine().adapter.getDropState(containerId()),
    );
}

/** The page-wide drag in progress (changes when a drag starts or ends). */
export function dragStateSignal(): Signal<DragState | undefined> {
    return fromStore(
        () => DragDropManager.subscribeDrag,
        DragDropManager.getDragState,
    );
}

/** The ids of a container's tabs hidden by tab overflow. */
export function hiddenTabsSignal(
    engine: Signal<LayoutEngine>,
    containerId: () => string,
): Signal<readonly string[]> {
    return fromStore(
        () => engine().adapter.subscribeOverflow,
        () => engine().adapter.getHiddenTabs(containerId()),
    );
}
