import {
    DockableBorder,
    DockableBorderContent,
    DockableBorders,
} from "./borders.directive";
import { DockableDragGroup } from "./drag-group.directive";
import { DockableDragNode } from "./drag-node.directive";
import { DockableDragSource, DockableDropZone } from "./drag-source.directive";
import {
    DockableDropIndicator,
    DockableEdgeIndicator,
} from "./indicators.directive";
import { DockablePanel } from "./panel.directive";
import { DockablePanels } from "./panels.directive";
import { DockablePopout, DockablePopoutLayout } from "./popout.directive";
import { DockableRoot } from "./root.directive";
import { DockableRow } from "./row.directive";
import { DockableSplitter } from "./splitter.directive";
import { DockableTab } from "./tab.directive";
import { DockableTabList } from "./tab-list.directive";
import { DockableTabSet } from "./tabset.directive";
import { DockableTabSetContent } from "./tabset-content.directive";
import {
    DockableBorderSplitter,
    DockableBordersBar,
    DockableBordersContent,
    DockableRowChild,
    DockableRowSplitter,
    DockableTabListItem,
} from "./templates";
import {
    DockablePopoutTrigger,
    DockableTabOverflowTrigger,
} from "./triggers.directive";

/**
 * Every Dockable directive, for a standalone component's `imports`:
 * `@Component({ imports: [DOCKABLE], … })`.
 */
export const DOCKABLE = [
    DockableRoot,
    DockableRow,
    DockableRowChild,
    DockableRowSplitter,
    DockableTabSet,
    DockableTabList,
    DockableTabListItem,
    DockableTab,
    DockableTabSetContent,
    DockablePanels,
    DockablePanel,
    DockableSplitter,
    DockableDropIndicator,
    DockableEdgeIndicator,
    DockableBorders,
    DockableBordersBar,
    DockableBordersContent,
    DockableBorder,
    DockableBorderContent,
    DockableBorderSplitter,
    DockableDragGroup,
    DockableDragNode,
    DockableDragSource,
    DockableDropZone,
    DockablePopout,
    DockablePopoutLayout,
    DockablePopoutTrigger,
    DockableTabOverflowTrigger,
] as const;
