import { computed, inject, type Signal } from "@angular/core";
import {
    type BorderState,
    DockableBorder,
} from "../directives/borders.directive";
import {
    DockableDragNode,
    type DragNodeState,
} from "../directives/drag-node.directive";
import {
    DockableDragSource,
    DockableDropZone,
    type DragSourceState,
    type DropZoneState,
} from "../directives/drag-source.directive";
import {
    DockableSplitter,
    type SplitterState,
} from "../directives/splitter.directive";
import { DockableTab } from "../directives/tab.directive";
import {
    DockableTabSet,
    type TabSetState,
} from "../directives/tabset.directive";

/** What a part's injection function returns: the part's state, as a signal. */
export interface InjectPartResult<S> {
    state: Signal<S>;
}

function enclosing<D>(directive: D | null, part: string, fn: string): D {
    if (!directive) {
        throw new Error(`${fn} must be used inside [${part}]`);
    }
    return directive;
}

/**
 * The state of the enclosing `[dockableTabSet]` (`active`, `maximized`, the drop target, …), for
 * a component inside it. The directive puts the measurement and the activation on its element.
 */
export function injectTabSet(): InjectPartResult<TabSetState> {
    const tabset = enclosing(
        inject(DockableTabSet, { optional: true }),
        "dockableTabSet",
        "injectTabSet",
    );
    return { state: tabset.state };
}

/** The state of the enclosing `[dockableBorder]` strip (`open`, `overlay`, the drop target, …). */
export function injectBorder(): InjectPartResult<BorderState> {
    const border = enclosing(
        inject(DockableBorder, { optional: true }),
        "dockableBorder",
        "injectBorder",
    );
    return { state: border.state };
}

/**
 * The state of the `[dockableSplitter]` on this element or around it (`dragging`, its orientation,
 * the outline preview). The directive puts the ARIA, the listeners and the structural style on its
 * element.
 */
export function injectSplitter(): InjectPartResult<SplitterState> {
    const splitter = enclosing(
        inject(DockableSplitter, { optional: true }),
        "dockableSplitter",
        "injectSplitter",
    );
    return { state: splitter.state };
}

/** Whether the tab of the enclosing `[dockableTab]` (or `[dockableDragNode]`) is being dragged. */
export function injectDragNode(): InjectPartResult<DragNodeState> {
    const node = inject(DockableDragNode, { optional: true });
    if (node) {
        return { state: node.state };
    }
    const tab = enclosing(
        inject(DockableTab, { optional: true }),
        "dockableDragNode] or [dockableTab",
        "injectDragNode",
    );
    return {
        state: computed(() => ({ dragging: tab.state().dragging })),
    };
}

/** The state of the enclosing `[dockableDragSource]` (`dragging`, `disabled`). */
export function injectDragSource(): InjectPartResult<DragSourceState> {
    const source = enclosing(
        inject(DockableDragSource, { optional: true }),
        "dockableDragSource",
        "injectDragSource",
    );
    return { state: source.state };
}

/** The state of the enclosing `[dockableDropZone]` (`over`, `active`). */
export function injectDropZone(): InjectPartResult<DropZoneState> {
    const zone = enclosing(
        inject(DockableDropZone, { optional: true }),
        "dockableDropZone",
        "injectDropZone",
    );
    return { state: zone.state };
}
