import {
    DockableBorder,
    DockableBorderContent,
    DockableBorders,
} from "./directives/borders.directive";
import { DockableDragGroup } from "./directives/drag-group.directive";
import { DockableDragNode } from "./directives/drag-node.directive";
import {
    DockableDragSource,
    DockableDropZone,
} from "./directives/drag-source.directive";
import {
    DockableDropIndicator,
    DockableEdgeIndicator,
} from "./directives/indicators.directive";
import { DockablePanel } from "./directives/panel.directive";
import { DockablePanels } from "./directives/panels.directive";
import {
    DockablePopout,
    DockablePopoutLayout,
} from "./directives/popout.directive";
import { DockableRoot } from "./directives/root.directive";
import { DockableRow } from "./directives/row.directive";
import { DockableSplitter } from "./directives/splitter.directive";
import { DockableTab } from "./directives/tab.directive";
import { DockableTabList } from "./directives/tab-list.directive";
import { DockableTabSet } from "./directives/tabset.directive";
import { DockableTabSetContent } from "./directives/tabset-content.directive";
import {
    DockableBorderSplitter,
    DockableBordersBar,
    DockableBordersContent,
    DockableRowChild,
    DockableRowSplitter,
    DockableTabListItem,
} from "./directives/templates.directive";
import {
    DockablePopoutTrigger,
    DockableTabOverflowTrigger,
} from "./directives/triggers.directive";

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
