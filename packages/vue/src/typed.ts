import type { DockableTypes } from "@fragiola/dockable";
import type { BorderProps, BorderSlots } from "./components/border";
import type {
    BorderContentProps,
    BorderContentSlots,
} from "./components/border-content";
import type { BordersProps, BordersSlots } from "./components/borders";
import type { DragGroupProps, DragGroupSlots } from "./components/drag-group";
import type {
    DragSourceProps,
    DragSourceSlots,
} from "./components/drag-source";
import type {
    DropIndicatorProps,
    DropIndicatorSlots,
} from "./components/drop-indicator";
import type { DropZoneProps, DropZoneSlots } from "./components/drop-zone";
import type {
    EdgeIndicatorProps,
    EdgeIndicatorSlots,
} from "./components/edge-indicator";
import type { PanelProps, PanelSlots } from "./components/panel";
import type { PanelsProps, PanelsSlots } from "./components/panels";
import type { PopoutProps, PopoutSlots } from "./components/popout";
import type {
    PopoutTriggerProps,
    PopoutTriggerSlots,
} from "./components/popout-trigger";
import type { RootProps, RootSlots } from "./components/root";
import type { RowProps, RowSlots } from "./components/row";
import type { SplitterProps, SplitterSlots } from "./components/splitter";
import type { TabProps, TabSlots } from "./components/tab";
import type { TabListProps, TabListSlots } from "./components/tab-list";
import type {
    TabOverflowTriggerProps,
    TabOverflowTriggerSlots,
} from "./components/tab-overflow-trigger";
import type { TabSetProps, TabSetSlots } from "./components/tabset";
import type {
    TabSetContentProps,
    TabSetContentSlots,
} from "./components/tabset-content";
import * as parts from "./parts";
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
    Root: DockableComponent<RootProps<T>, RootSlots<T>>;
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
