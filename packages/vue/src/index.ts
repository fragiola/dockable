// The whole core, so that a Vue app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/dockable";
export type { BorderProps, BorderSlots, BorderState } from "./Border";
export type {
    BorderContentProps,
    BorderContentSlots,
    BorderContentState,
} from "./BorderContent";
export type { BordersProps, BordersSlots, BordersState } from "./Borders";
export {
    type DragProps,
    type DropZoneState,
    type SplitterElementProps,
    type SplitterState,
    type TabSetElementProps,
    type TabSetState,
    type UseBorderResult,
    type UseDockableResult,
    type UseDragNodeResult,
    type UseDragSourceOptions,
    type UseDragSourceResult,
    type UseDropZoneOptions,
    type UseDropZoneResult,
    type UseModelStateOptions,
    type UseSplitterResult,
    type UseTabOverflowResult,
    type UseTabSetResult,
    useBorder,
    useDockable,
    useDragNode,
    useDragSource,
    useDropZone,
    useModelState,
    useSplitter,
    useTabOverflow,
    useTabSet,
} from "./composables";
export {
    type DragGroupProps,
    type DragGroupSlots,
    useDragGroup,
} from "./DragGroup";
export type {
    DragSourceProps,
    DragSourceSlots,
    DragSourceState,
} from "./DragSource";
export type {
    DropIndicatorProps,
    DropIndicatorSlots,
    DropIndicatorState,
} from "./DropIndicator";
export type { DropZoneProps, DropZoneSlots } from "./DropZone";
export type {
    EdgeIndicatorProps,
    EdgeIndicatorSlots,
    EdgeIndicatorState,
} from "./EdgeIndicator";
export type { PanelProps, PanelSlots, PanelState } from "./Panel";
export type { PanelsProps, PanelsSlots } from "./Panels";
export type { PopoutProps, PopoutSlots, PopoutState } from "./Popout";
export type {
    PopoutTriggerProps,
    PopoutTriggerSlots,
    PopoutTriggerState,
} from "./PopoutTrigger";
export * as Dockable from "./parts";
export type { RootProps, RootSlots, RootState } from "./Root";
export type {
    RowProps,
    RowSlots,
    RowSplitterProps,
    RowState,
} from "./Row";
export type { SplitterProps, SplitterSlots } from "./Splitter";
export type { TabProps, TabSlots, TabState } from "./Tab";
export type { TabListProps, TabListSlots, TabListState } from "./TabList";
export type {
    TabOverflowTriggerProps,
    TabOverflowTriggerSlots,
    TabOverflowTriggerState,
} from "./TabOverflowTrigger";
export type { TabSetProps, TabSetSlots } from "./TabSet";
export type {
    TabSetContentProps,
    TabSetContentSlots,
    TabSetContentState,
} from "./TabSetContent";
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
