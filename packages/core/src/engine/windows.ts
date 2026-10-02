// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// (popping out and the screen rect a window opens at), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { BatchEntry, CommandResult } from "../commands/types";
import type { Rect } from "../geometry/rect";
import type { Model } from "../state/model";
import {
    type DockableTypes,
    MAIN_LAYOUT,
    type TabContainer,
} from "../state/types";
import { type Measure, tabContainerOf } from "./measure";
import { notFound, refused } from "./results";

/** What popping out and docking back read from their engine. */
export interface WindowsHost<T extends DockableTypes> {
    isSupportsPopout(): boolean;
    ownerWindow(): Window | undefined;
    windowsOf(id: string): Windows<T>;
}

/** Pops a layout's nodes out into windows, and docks them back. */
export class Windows<T extends DockableTypes> {
    private readonly model: Model<T>;
    readonly measure: Measure<T>;
    private readonly host: WindowsHost<T>;

    constructor(model: Model<T>, measure: Measure<T>, host: WindowsHost<T>) {
        this.model = model;
        this.measure = measure;
        this.host = host;
    }

    /** Pops a node (a tab, or a whole tabset) out into a window, at its place on screen. */
    popout(id: string, dryRun: boolean): CommandResult<{ windowId: string }> {
        if (!this.host.isSupportsPopout()) {
            return refused("popout windows are not supported here");
        }
        const node = this.model.get("node-by", { id });
        if (node?.type === "tabset") {
            // a dry run asks the model only: where the window would open does not change the answer
            return dryRun
                ? this.model.check("tabset.popout", { tabsetId: id })
                : this.model.run("tabset.popout", {
                      tabsetId: id,
                      ...this.screenRectOf("tabset", node),
                  });
        }
        if (node?.type !== "tab") {
            return notFound(`"${id}" is not a tab or a tabset`);
        }
        if (dryRun) {
            return this.model.check("tab.popout", { tabId: id });
        }
        const container = tabContainerOf(this.model, id);
        return this.model.run("tab.popout", {
            tabId: id,
            ...(container ? this.screenRectOf("content", container) : {}),
        });
    }

    /** where a tabset, or a container's content area, is on screen (for a window to open there) */
    private screenRectOf(
        kind: "tabset" | "content",
        node: TabContainer<T>,
    ): { rect?: Rect } {
        const windows = this.host.windowsOf(node.id);
        const rect =
            kind === "tabset"
                ? windows.measure.rect("tabset", node.id)
                : windows.measure.contentRect(node);
        return rect ? { rect: windows.getScreenRect(rect) } : {};
    }

    /**
     * Docks a node (a tab, or a tabset) of a window back into the main layout's default tabset (its
     * active one, else its first). When it is all its window holds, the window closes (`window.close`);
     * otherwise its tabs move (`tab.move`).
     */
    dockBack(id: string, dryRun: boolean): CommandResult<{ tabIds: string[] }> {
        const layout = this.model.get("layout-id-by", { nodeId: id });
        if (layout === undefined || layout === MAIN_LAYOUT) {
            return refused(`"${id}" is not in a window`);
        }
        const execute = dryRun ? this.model.check : this.model.run;
        const node = this.model.get("node-by", { id });
        const tabs =
            node?.type === "tabset" ? node.children.map((t) => t.id) : [id];
        const docked = (
            result: CommandResult<unknown>,
            moved: string[] = tabs,
        ): CommandResult<{ tabIds: string[] }> =>
            result.ok ? { ok: true, value: { tabIds: moved } } : result;
        const all = this.model
            .get("tabs", { layoutId: layout })
            .map((t) => t.id);
        if (all.length === tabs.length) {
            return docked(execute("window.close", { windowId: layout }));
        }
        const target = this.model.get("default-tabset");
        if (!target) {
            // no tabset to dock into: closing the window docks all of it
            return docked(execute("window.close", { windowId: layout }), all);
        }
        // a pinned tab may not leave its tabset: it is unpinned for the move and pinned again
        const commands: BatchEntry<T>[] = [];
        for (const tab of tabs) {
            const node = this.model.get("node-by", { id: tab });
            const pinned = node?.type === "tab" && node.pinned === true;
            if (pinned) {
                commands.push({
                    command: "tab.pin",
                    payload: { tabId: tab, value: false },
                });
            }
            commands.push({
                command: "tab.move",
                payload: { tabId: tab, to: target.id, index: -1 },
            });
            if (pinned) {
                commands.push({
                    command: "tab.pin",
                    payload: { tabId: tab, value: true },
                });
            }
        }
        return docked(execute("batch", { commands }));
    }

    /** a layout-relative rect in screen coordinates (for opening popout windows) */
    private getScreenRect(inRect: Rect): Rect {
        const win = this.host.ownerWindow();
        if (!win) {
            return inRect;
        }
        const layoutRect = this.measure.getDomRect();
        // measure window chrome; fall back to typical sizes under zoom
        const measuredNavHeight = win.outerHeight - win.innerHeight;
        const measuredNavWidth = win.outerWidth - win.innerWidth;
        const navHeight =
            measuredNavHeight >= 0 && measuredNavHeight <= 200
                ? measuredNavHeight
                : 60;
        const navWidth =
            measuredNavWidth >= 0 && measuredNavWidth <= 100
                ? measuredNavWidth
                : 2;
        return {
            x:
                win.screenX +
                win.scrollX +
                navWidth / 2 +
                layoutRect.x +
                inRect.x,
            y:
                win.screenY +
                win.scrollY +
                (navHeight - navWidth / 2) +
                layoutRect.y +
                inRect.y,
            width: inRect.width + navWidth,
            height: inRect.height + navHeight,
        };
    }
}
