// The whole core, so that a Vue app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/dockable";
export type {
    BorderProps,
    BorderSlots,
    BorderState,
} from "./components/border";
export type {
    BorderContentProps,
    BorderContentSlots,
    BorderContentState,
} from "./components/border-content";
export type {
    BordersProps,
    BordersSlots,
    BordersState,
} from "./components/borders";
export {
    type DragGroupProps,
    type DragGroupSlots,
    useDragGroup,
} from "./components/drag-group";
export type {
    DragSourceProps,
    DragSourceSlots,
    DragSourceState,
} from "./components/drag-source";
export type {
    DropIndicatorProps,
    DropIndicatorSlots,
    DropIndicatorState,
} from "./components/drop-indicator";
export type { DropZoneProps, DropZoneSlots } from "./components/drop-zone";
export type {
    EdgeIndicatorProps,
    EdgeIndicatorSlots,
    EdgeIndicatorState,
} from "./components/edge-indicator";
export type { PanelProps, PanelSlots, PanelState } from "./components/panel";
export type { PanelsProps, PanelsSlots } from "./components/panels";
export type {
    PopoutProps,
    PopoutSlots,
    PopoutState,
} from "./components/popout";
export type {
    PopoutTriggerProps,
    PopoutTriggerSlots,
    PopoutTriggerState,
} from "./components/popout-trigger";
export type { RootProps, RootSlots, RootState } from "./components/root";
export type {
    RowProps,
    RowSlots,
    RowSplitterProps,
    RowState,
} from "./components/row";
export type { SplitterProps, SplitterSlots } from "./components/splitter";
export type { TabProps, TabSlots, TabState } from "./components/tab";
export type {
    TabListProps,
    TabListSlots,
    TabListState,
} from "./components/tab-list";
export type {
    TabOverflowTriggerProps,
    TabOverflowTriggerSlots,
    TabOverflowTriggerState,
} from "./components/tab-overflow-trigger";
export type { TabSetProps, TabSetSlots } from "./components/tabset";
export type {
    TabSetContentProps,
    TabSetContentSlots,
    TabSetContentState,
} from "./components/tabset-content";
export { type UseBorderResult, useBorder } from "./composables/use-border";
export {
    type UseDockableResult,
    useDockable,
} from "./composables/use-dockable";
export {
    type DragProps,
    type UseDragNodeResult,
    useDragNode,
} from "./composables/use-drag-node";
export {
    type UseDragSourceOptions,
    type UseDragSourceResult,
    useDragSource,
} from "./composables/use-drag-source";
export {
    type DropZoneState,
    type UseDropZoneOptions,
    type UseDropZoneResult,
    useDropZone,
} from "./composables/use-drop-zone";
export {
    type UseModelStateOptions,
    useModelState,
} from "./composables/use-model-state";
export {
    type SplitterElementProps,
    type SplitterState,
    type UseSplitterResult,
    useSplitter,
} from "./composables/use-splitter";
export {
    type UseTabOverflowResult,
    useTabOverflow,
} from "./composables/use-tab-overflow";
export {
    type TabSetElementProps,
    type TabSetState,
    type UseTabSetResult,
    useTabSet,
} from "./composables/use-tabset";
export * as Dockable from "./parts";
export { type TypedDockable, typedDockable } from "./typed";
export type {
    DockableComponent,
    PrimitiveProps,
    SlotFunction,
} from "./utils/primitive";
export type {
    AsProp,
    ElementRef,
    RenderSlot,
    RenderSlotProps,
} from "./utils/render";
