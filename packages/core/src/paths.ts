// The `data-layout-path` scheme and DOM id helpers, ported from FlexLayout
// (https://github.com/caplin/FlexLayout): docs/testing-your-layout.md, src/view/Utils.tsx
// (domId, tabButtonPath) and src/view/Splitter.tsx, and Node.setPaths / BorderSet.setPaths.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// Every adapter emits the same values, so e2e selectors work across frameworks:
//   /r1/ts0      row / tabset
//   /ts0/tb1     tab button (same tree location as its panel)
//   /ts0/t1      tab panel
//   /ts0/tabstrip
//   /s0          splitter after the first child of the root row (/r0/s1 inside a nested row)
//   /border/left, /border/left/t0, /border/left/tb0
import type { AnyBorder, AnyRow } from "./state/tree";

/**
 * The path of every node of a layout: rows `/r<i>`, tabsets `/ts<i>` and tabs `/t<i>` by their
 * index in their parent, under `prefix` (`""` for the main layout, `/sublayout<n>` for a window).
 * Borders are `/border/<location>` with their tabs below.
 */
export function computePaths(
    root: AnyRow,
    prefix = "",
    borders: readonly AnyBorder[] = [],
): Map<string, string> {
    const paths = new Map<string, string>();
    const visit = (row: AnyRow, path: string) => {
        paths.set(row.id, path);
        for (const [i, child] of row.children.entries()) {
            if (child.type === "row") {
                visit(child, `${path}/r${i}`);
            } else {
                const tabsetPath = `${path}/ts${i}`;
                paths.set(child.id, tabsetPath);
                for (const [j, tab] of child.children.entries()) {
                    paths.set(tab.id, `${tabsetPath}/t${j}`);
                }
            }
        }
    };
    visit(root, prefix);
    for (const border of borders) {
        const path = `/border/${border.location}`;
        paths.set(border.id, path);
        for (const [j, tab] of border.children.entries()) {
            paths.set(tab.id, `${path}/t${j}`);
        }
    }
    return paths;
}

/** The path of a window layout (`n` is its 1-based position in the state's windows). */
export function windowPath(n: number): string {
    return `/sublayout${n}`;
}

/** The path of a tab's button: its panel path with the trailing tab segment renamed. */
export function getTabButtonPath(tabPath: string): string {
    return tabPath.replace(/\/t(\d+)$/, "/tb$1");
}

/** The path of a tabset's tab strip. */
export function getTabStripPath(tabsetPath: string): string {
    return `${tabsetPath}/tabstrip`;
}

/**
 * The path of the splitter before child `index` (1-based: the splitter between children 0 and 1
 * has index 1) of a row or border.
 */
export function getSplitterPath(nodePath: string, index: number): string {
    return `${nodePath}/s${index - 1}`;
}

/** The path of the drop indicator. */
export const DROP_INDICATOR_PATH = "/outline";

function domId(prefix: string, nodeId: string) {
    return prefix + nodeId.replace(/\s/g, "_"); // aria id references cannot contain whitespace
}

/**
 * The DOM id of a tab's button, referenced by its panel's `aria-labelledby`. `scope` keeps the ids
 * of two layouts on one page apart (their models may both have a `tab-1`):
 * `engine.get("tab-button-dom-id-by-tab-id", { tabId: tab })` passes the engine's own.
 */
export function getTabButtonId(tabId: string, scope = ""): string {
    return domId(`dockable-${scope}tabbutton-`, tabId);
}

/** The DOM id of a tab's panel, referenced by its button's `aria-controls` (see {@link getTabButtonId}). */
export function getTabPanelId(tabId: string, scope = ""): string {
    return domId(`dockable-${scope}tab-`, tabId);
}
