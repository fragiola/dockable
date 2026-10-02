// Type fixtures (compiled by `pnpm typecheck`, never run): the engine's verbs are typed by their
// keys, a command never runs through `engine.run`, and the surface is the verbs plus `adapter`.
import type { LayoutEngine } from "../../src/engine/LayoutEngine";
import type { Model } from "../../src/state/model";

/** Uses values, so fixtures do not trip noUnusedLocals. */
function use(..._values: unknown[]): void {}

/** `true` when `A` and `B` are the same union. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// the engine's whole surface: the verbs, the layout it draws, and the adapter's side
export const engineSurface: Same<
    keyof LayoutEngine,
    "layoutId" | "run" | "can" | "check" | "get" | "is" | "adapter"
> = true;

export function actions(engine: LayoutEngine): void {
    const popped = engine.run("popout", { nodeId: "t0" });
    if (popped.ok) {
        const window: string = popped.value.windowId;
        use(window);
    }
    const docked = engine.check("dock-back", { nodeId: "t0" });
    if (docked.ok) {
        const tabs: string[] = docked.value.tabIds;
        use(tabs);
    }
    const allowed: boolean = engine.can("focus-tabset", { direction: "next" });
    use(allowed, engine.run("measure-and-position"));
    engine.run("close-overlay-border", { borderId: "left" });

    // @ts-expect-error: a command changes the layout through model.run, never engine.run
    engine.run("tab.close", { tabId: "t0" });
    // @ts-expect-error: popout takes `nodeId` (a tab or a tabset)
    engine.run("popout", { tabId: "t0" });
    // @ts-expect-error: the old payload field
    engine.run("dock-back", { node: "t0" });
    // @ts-expect-error: popout needs its payload
    engine.run("popout");
    // @ts-expect-error: a direction is "next" or "previous"
    engine.run("focus-tabset", { direction: 1 });
}

export function reads(engine: LayoutEngine): void {
    const path: string = engine.get("layout-path-by", {
        nodeId: "ts0",
    });
    const panel: string = engine.get("tab-panel-dom-id-by", {
        tabId: "t0",
    });
    const min: number = engine.get("flex-by", {
        nodeId: "ts0",
    }).minWidth;
    const size: number = engine.get("splitter-size");
    const doc: Document | undefined = engine.get("owner-document");
    const supported: boolean = engine.is("popout-supported");
    const visible: boolean = engine.is("tab-panel-visible", { tabId: "t0" });
    use(path, panel, min, size, doc, supported, visible);
    const grow: number = engine.get("flex-by", { nodeId: "ts0" }).grow;
    const top: number | undefined = engine.get("overlay-placement-by", {
        borderId: "left",
    })?.top;
    const shown: boolean = engine.is("border-shown", { borderId: "left" });
    const tabbable: boolean = engine.is("tab-tabbable", { tabId: "t0" });
    const mode: "popout" | "dock" | undefined = engine.get("popout-mode-by", {
        nodeId: "t0",
    });
    use(grow, top, shown, tabbable, mode);

    // @ts-expect-error: not a view fact
    engine.get("node-parent-by", { nodeId: "t0" });
    // @ts-expect-error: tab-panel-visible needs the tab's id
    engine.is("tab-panel-visible");
    // @ts-expect-error: an old key
    engine.get("path", { node: "ts0" });
    // @ts-expect-error: an old key
    engine.get("layout-path-by-node-id", { nodeId: "ts0" });
    // @ts-expect-error: layout-path-by needs its payload
    engine.get("layout-path-by");
    // @ts-expect-error: tab-panel-dom-id-by takes `tabId`
    engine.get("tab-panel-dom-id-by", { nodeId: "t0" });
    // @ts-expect-error: flex-by replaced size-limits-by
    engine.get("size-limits-by", { nodeId: "ts0" });
    // @ts-expect-error: border-shown takes `borderId`
    engine.is("border-shown", { nodeId: "left" });
}

export function adapter(engine: LayoutEngine): void {
    const model: Model = engine.adapter.model;
    const main: LayoutEngine = engine.adapter.main;
    use(model, main, engine.adapter.getDragDropManager());
}
