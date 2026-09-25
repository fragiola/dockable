// The `data-layout-path` scheme and DOM id helpers, ported from FlexLayout
// (https://github.com/caplin/FlexLayout): docs/testing-your-layout.md, src/view/Utils.tsx
// (domId, tabButtonPath) and src/view/Splitter.tsx. Copyright (c) 2017 Caplin Systems Ltd.
// MIT licence, see LICENSE.
//
// Every adapter emits the same values, so e2e selectors work across frameworks:
//   /r1/ts0      row / tabset
//   /ts0/tb1     tab button (same tree location as its panel)
//   /ts0/t1      tab panel
//   /ts0/tabstrip
//   /s0          splitter after the first child of the root row (/r0/s1 inside a nested row)
import type { Node } from "./model/Node";
import type { TabNode } from "./model/TabNode";

/** the path of a row, tabset or tab panel (a tab's own path is its panel path) */
export function getNodePath(node: Node): string {
    return node.getPath();
}

/** the path of a tab's button: its node path with the trailing tab segment renamed to a
 * tab-button segment (e.g. /ts0/g0/t0 -> /ts0/g0/tb0) */
export function getTabButtonPath(tab: TabNode): string {
    return tab.getPath().replace(/\/t(\d+)$/, "/tb$1");
}

/** the path of a tab's content panel */
export function getTabPanelPath(tab: TabNode): string {
    return tab.getPath();
}

/** the path of a tabset's tab strip */
export function getTabStripPath(tabset: Node): string {
    return `${tabset.getPath()}/tabstrip`;
}

/** the path of the splitter before child `index` (1-based: the splitter between children 0 and 1
 * has index 1) of a row or border */
export function getSplitterPath(node: Node, index: number): string {
    return `${node.getPath()}/s${index - 1}`;
}

/** the path of the drop indicator */
export const DROP_INDICATOR_PATH = "/outline";

function domId(prefix: string, nodeId: string) {
    return prefix + nodeId.replace(/\s/g, "_"); // aria id references cannot contain whitespace
}

/** the DOM id of a tab's button, referenced by its panel's `aria-labelledby` */
export function getTabButtonId(tab: TabNode): string {
    return domId("dockable-tabbutton-", tab.getId());
}

/** the DOM id of a tab's panel, referenced by its button's `aria-controls` */
export function getTabPanelId(tab: TabNode): string {
    return domId("dockable-tab-", tab.getId());
}
