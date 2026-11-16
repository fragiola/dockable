// The whole core, so that a React app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/dockable";
export type { BorderProps, BorderState } from "./components/border";
export type {
    BorderContentProps,
    BorderContentState,
} from "./components/border-content";
export type { BordersProps, BordersState } from "./components/borders";
export { type DragGroupProps, useDragGroup } from "./components/drag-group";
export type {
    DragSourceProps,
    DragSourceState,
} from "./components/drag-source";
export type {
    DropIndicatorProps,
    DropIndicatorState,
} from "./components/drop-indicator";
export type { DropZoneProps, DropZoneState } from "./components/drop-zone";
export type {
    EdgeIndicatorProps,
    EdgeIndicatorState,
} from "./components/edge-indicator";
export type { PanelProps, PanelState } from "./components/panel";
export type { PanelsProps } from "./components/panels";
export type { PopoutProps, PopoutState } from "./components/popout";
export type {
    PopoutTriggerProps,
    PopoutTriggerState,
} from "./components/popout-trigger";
export type { RootProps, RootState } from "./components/root";
export type { RowProps, RowSplitterProps, RowState } from "./components/row";
export type { SplitterProps, SplitterState } from "./components/splitter";
export type { TabProps, TabState } from "./components/tab";
export type { TabListProps, TabListState } from "./components/tab-list";
export type {
    TabOverflowTriggerProps,
    TabOverflowTriggerState,
} from "./components/tab-overflow-trigger";
export type { TabSetProps } from "./components/tabset";
export type {
    TabSetContentProps,
    TabSetContentState,
} from "./components/tabset-content";
export { type UseBorderResult, useBorder } from "./hooks/use-border";
export { type UseDockableResult, useDockable } from "./hooks/use-dockable";
export {
    type DragProps,
    type UseDragNodeResult,
    useDragNode,
} from "./hooks/use-drag-node";
export {
    type UseDragSourceOptions,
    type UseDragSourceResult,
    useDragSource,
} from "./hooks/use-drag-source";
export {
    type UseDropZoneOptions,
    type UseDropZoneResult,
    useDropZone,
} from "./hooks/use-drop-zone";
export {
    type UseModelStateOptions,
    useModelState,
} from "./hooks/use-model-state";
export { type UseSplitterResult, useSplitter } from "./hooks/use-splitter";
export {
    type UseTabOverflowResult,
    useTabOverflow,
} from "./hooks/use-tab-overflow";
export {
    type TabSetState,
    type UseTabSetResult,
    useTabSet,
} from "./hooks/use-tabset";
export * as Dockable from "./parts";
export type {
    ButtonPrimitiveProps,
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
} from "./utils/use-render";
