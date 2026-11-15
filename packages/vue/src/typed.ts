import type { DockableTypes } from "@fragiola/dockable";
import type { BorderProps, BorderSlots } from "./Border";
import type { BorderContentProps, BorderContentSlots } from "./BorderContent";
import type { BordersProps, BordersSlots } from "./Borders";
import type { DragGroupProps, DragGroupSlots } from "./DragGroup";
import type { DragSourceProps, DragSourceSlots } from "./DragSource";
import type { DropIndicatorProps, DropIndicatorSlots } from "./DropIndicator";
import type { DropZoneProps, DropZoneSlots } from "./DropZone";
import type { EdgeIndicatorProps, EdgeIndicatorSlots } from "./EdgeIndicator";
import type { PanelProps, PanelSlots } from "./Panel";
import type { PanelsProps, PanelsSlots } from "./Panels";
import type { PopoutProps, PopoutSlots } from "./Popout";
import type { PopoutTriggerProps, PopoutTriggerSlots } from "./PopoutTrigger";
import * as parts from "./parts";
import type { RootProps, RootSlots } from "./Root";
import type { RowProps, RowSlots } from "./Row";
import type { SplitterProps, SplitterSlots } from "./Splitter";
import type { TabProps, TabSlots } from "./Tab";
import type { TabListProps, TabListSlots } from "./TabList";
import type {
    TabOverflowTriggerProps,
    TabOverflowTriggerSlots,
} from "./TabOverflowTrigger";
import type { TabSetProps, TabSetSlots } from "./TabSet";
import type { TabSetContentProps, TabSetContentSlots } from "./TabSetContent";
import type { DockableComponent } from "./utils/primitive";

/** The `Dockable` primitives typed by the registry `T`: nodes, tabs and data in props and slots. */
export interface TypedDockable<T extends DockableTypes> {
    Border: DockableComponent<BorderProps<T>, BorderSlots>;
    BorderContent: DockableComponent<
        BorderContentProps<T>,
        BorderContentSlots<T>
    >;
    Borders: DockableComponent<BordersProps, BordersSlots<T>>;
    DragGroup: DockableComponent<DragGroupProps, DragGroupSlots>;
    DragSource: DockableComponent<DragSourceProps<T>, DragSourceSlots>;
    DropIndicator: DockableComponent<DropIndicatorProps, DropIndicatorSlots>;
    DropZone: DockableComponent<DropZoneProps<T>, DropZoneSlots>;
    EdgeIndicator: DockableComponent<EdgeIndicatorProps, EdgeIndicatorSlots>;
    Panel: DockableComponent<PanelProps<T>, PanelSlots>;
    Panels: DockableComponent<PanelsProps<T>, PanelsSlots<T>>;
    Popout: DockableComponent<PopoutProps, PopoutSlots<T>>;
    PopoutTrigger: DockableComponent<PopoutTriggerProps<T>, PopoutTriggerSlots>;
    Root: DockableComponent<RootProps<T>, RootSlots>;
    Row: DockableComponent<RowProps<T>, RowSlots<T>>;
    Splitter: DockableComponent<SplitterProps<T>, SplitterSlots>;
    Tab: DockableComponent<TabProps<T>, TabSlots>;
    TabList: DockableComponent<TabListProps, TabListSlots<T>>;
    TabOverflowTrigger: DockableComponent<
        TabOverflowTriggerProps,
        TabOverflowTriggerSlots<T>
    >;
    TabSet: DockableComponent<TabSetProps<T>, TabSetSlots>;
    TabSetContent: DockableComponent<TabSetContentProps, TabSetContentSlots>;
}

/**
 * The `Dockable` primitives typed by your registry: what React writes as a type argument
 * (`<Dockable.Panels<Types>>`), which a Vue template cannot pass. The same components, typed:
 *
 * ```ts
 * const Dockable = typedDockable<Types>();
 * // <Dockable.Panels v-slot="{ tab }">: tab.data narrows on tab.component
 * ```
 */
export function typedDockable<T extends DockableTypes>(): TypedDockable<T> {
    return parts as unknown as TypedDockable<T>;
}
