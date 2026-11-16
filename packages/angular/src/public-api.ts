// The whole core, so that an Angular app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.spec.ts fails on one.
export * from "@fragiola/dockable";
export type {
    DockableContext,
    LayoutContext,
} from "./lib/context";
export {
    type BorderContentState,
    type BorderState,
    type BordersState,
    DockableBorder,
    DockableBorderContent,
    DockableBorders,
} from "./lib/directives/borders.directive";
export {
    DockableDragGroup,
    injectDragGroup,
} from "./lib/directives/drag-group.directive";
export {
    DockableDragNode,
    type DragNodeState,
} from "./lib/directives/drag-node.directive";
export {
    DockableDragSource,
    DockableDropZone,
    type DragSourceState,
    type DropZoneDrop,
    type DropZoneState,
    type NewTabDrop,
} from "./lib/directives/drag-source.directive";
export {
    DockableDropIndicator,
    DockableEdgeIndicator,
    type DropIndicatorState,
    type EdgeIndicatorState,
} from "./lib/directives/indicators.directive";
export {
    DockablePanel,
    type PanelState,
} from "./lib/directives/panel.directive";
export {
    DockablePanels,
    type PanelsContext,
    type RenderOnDemand,
} from "./lib/directives/panels.directive";
export {
    DockablePopout,
    DockablePopoutLayout,
    type PopoutContext,
    type PopoutState,
} from "./lib/directives/popout.directive";
export {
    DockableRoot,
    type PopoutEvent,
    type RootState,
} from "./lib/directives/root.directive";
export { DockableRow, type RowState } from "./lib/directives/row.directive";
export {
    DockableSplitter,
    type SplitterState,
} from "./lib/directives/splitter.directive";
export { DockableTab, type TabState } from "./lib/directives/tab.directive";
export {
    DockableTabList,
    type TabListState,
} from "./lib/directives/tab-list.directive";
export {
    DockableTabSet,
    type TabSetState,
} from "./lib/directives/tabset.directive";
export {
    DockableTabSetContent,
    type TabSetContentState,
} from "./lib/directives/tabset-content.directive";
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
} from "./lib/directives/templates.directive";
export {
    DockablePopoutTrigger,
    DockableTabOverflowTrigger,
    type PopoutTriggerState,
    type TabOverflowTriggerState,
} from "./lib/directives/triggers.directive";
export { DOCKABLE } from "./lib/dockable";
export {
    type InjectDockableResult,
    injectDockable,
} from "./lib/inject/inject-dockable";
export {
    type InjectModelStateOptions,
    injectModelState,
} from "./lib/inject/inject-model-state";
export {
    type InjectPartResult,
    injectBorder,
    injectDragNode,
    injectDragSource,
    injectDropZone,
    injectSplitter,
    injectTabSet,
} from "./lib/inject/inject-part";
export {
    type InjectTabOverflowResult,
    injectTabOverflow,
} from "./lib/inject/inject-tab-overflow";
