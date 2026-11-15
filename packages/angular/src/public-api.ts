// The whole core, so that an Angular app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.spec.ts fails on one.
export * from "@fragiola/dockable";
export {
    type BorderContentState,
    type BorderState,
    type BordersState,
    DockableBorder,
    DockableBorderContent,
    DockableBorders,
} from "./lib/borders.directive";
export type {
    DockableContext,
    LayoutContext,
} from "./lib/context";
export { DOCKABLE } from "./lib/dockable";
export {
    DockableDragGroup,
    injectDragGroup,
} from "./lib/drag-group.directive";
export {
    DockableDragNode,
    type DragNodeState,
} from "./lib/drag-node.directive";
export {
    DockableDragSource,
    DockableDropZone,
    type DragSourceState,
    type DropZoneDrop,
    type DropZoneState,
    type NewTabDrop,
} from "./lib/drag-source.directive";
export {
    DockableDropIndicator,
    DockableEdgeIndicator,
    type DropIndicatorState,
    type EdgeIndicatorState,
} from "./lib/indicators.directive";
export {
    type InjectDockableResult,
    type InjectModelStateOptions,
    type InjectPartResult,
    type InjectTabOverflowResult,
    injectBorder,
    injectDockable,
    injectDragNode,
    injectDragSource,
    injectDropZone,
    injectModelState,
    injectSplitter,
    injectTabOverflow,
    injectTabSet,
} from "./lib/inject";
export { DockablePanel, type PanelState } from "./lib/panel.directive";
export {
    DockablePanels,
    type PanelsContext,
    type RenderOnDemand,
} from "./lib/panels.directive";
export {
    DockablePopout,
    DockablePopoutLayout,
    type PopoutContext,
    type PopoutState,
} from "./lib/popout.directive";
export {
    DockableRoot,
    type PopoutEvent,
    type RootState,
} from "./lib/root.directive";
export { DockableRow, type RowState } from "./lib/row.directive";
export {
    DockableSplitter,
    type SplitterState,
} from "./lib/splitter.directive";
export { DockableTab, type TabState } from "./lib/tab.directive";
export {
    DockableTabList,
    type TabListState,
} from "./lib/tab-list.directive";
export {
    DockableTabSet,
    type TabSetState,
} from "./lib/tabset.directive";
export {
    DockableTabSetContent,
    type TabSetContentState,
} from "./lib/tabset-content.directive";
export {
    type BorderSplitterContext,
    type BorderTemplateContext,
    DockableBorderSplitter,
    DockableBordersBar,
    DockableBordersContent,
    DockableRowChild,
    DockableRowSplitter,
    DockableTabListItem,
    type RowChildContext,
    type RowSplitterContext,
    type RowSplitterProps,
    type TabListItemContext,
    type TypedBy,
} from "./lib/templates";
export {
    DockablePopoutTrigger,
    DockableTabOverflowTrigger,
    type PopoutTriggerState,
    type TabOverflowTriggerState,
} from "./lib/triggers.directive";
