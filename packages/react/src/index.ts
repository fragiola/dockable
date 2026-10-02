// The whole core, so that a React app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/dockable";
export type { BorderProps, BorderState } from "./Border";
export type {
    BorderContentProps,
    BorderContentState,
} from "./BorderContent";
export type { BordersProps, BordersState } from "./Borders";
export { type DragGroupProps, useDragGroup } from "./DragGroup";
export type { DragSourceProps, DragSourceState } from "./DragSource";
export type { DropIndicatorProps, DropIndicatorState } from "./DropIndicator";
export type { DropZoneProps, DropZoneState } from "./DropZone";
export type {
    EdgeIndicatorProps,
    EdgeIndicatorState,
} from "./EdgeIndicator";
export {
    type DragProps,
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
} from "./hooks";
export type { PanelProps, PanelState } from "./Panel";
export type { PanelsProps } from "./Panels";
export type { PopoutProps, PopoutState } from "./Popout";
export type {
    PopoutTriggerProps,
    PopoutTriggerState,
} from "./PopoutTrigger";
export * as Dockable from "./parts";
export type { RootProps, RootState } from "./Root";
export type { RowProps, RowSplitterProps, RowState } from "./Row";
export type { SplitterProps, SplitterState } from "./Splitter";
export type { TabProps, TabState } from "./Tab";
export type { TabListProps, TabListState } from "./TabList";
export type {
    TabOverflowTriggerProps,
    TabOverflowTriggerState,
} from "./TabOverflowTrigger";
export type { TabSetProps } from "./TabSet";
export type { TabSetContentProps, TabSetContentState } from "./TabSetContent";
export type {
    ButtonPrimitiveProps,
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
} from "./utils/useRender";
