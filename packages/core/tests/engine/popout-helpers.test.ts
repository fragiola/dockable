// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createLayoutEngine, type LayoutEngine, MAIN_LAYOUT } from "../../src";
import { freshModel, recordCommands } from "./fixture";

const engines: LayoutEngine[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.adapter.dispose();
});

function setup(supportsPopout = true) {
    const model = freshModel();
    // popout is opt-in per tab (poppable defaults to false)
    model.run("layout.configure", {
        defaults: { tab: { poppable: true } },
    });
    const commands = recordCommands(model);
    const engine = createLayoutEngine({ model, popout: { supportsPopout } });
    engines.push(engine);
    return { model, engine, commands };
}

describe("popout helpers", () => {
    it('can("popout"): supported, and the model accepts it', () => {
        const { model, engine } = setup();
        expect(engine.can("popout", { nodeId: "t0" })).toBe(true);
        expect(engine.can("popout", { nodeId: "ts1" })).toBe(true);
        model.run("tab.configure", { tabId: "t0", poppable: false });
        expect(engine.can("popout", { nodeId: "t0" })).toBe(false);
        expect(engine.can("popout", { nodeId: "ts0" })).toBe(false); // one tab refuses
        const unsupported = setup(false);
        expect(unsupported.engine.can("popout", { nodeId: "t2" })).toBe(false);
    });

    it('get("popout-mode-by"): dock in a window, popout when it can, else none', () => {
        const { model, engine } = setup();
        expect(engine.get("popout-mode-by", { nodeId: "t0" })).toBe("popout");
        model.run("tab.configure", { tabId: "t0", poppable: false });
        expect(engine.get("popout-mode-by", { nodeId: "t0" })).toBeUndefined();
        engine.run("popout", { nodeId: "t2" });
        expect(engine.get("popout-mode-by", { nodeId: "t2" })).toBe("dock");
        expect(engine.get("popout-mode-by", { nodeId: "missing" })).toBe(
            undefined,
        );
        const unsupported = setup(false);
        expect(
            unsupported.engine.get("popout-mode-by", { nodeId: "t2" }),
        ).toBeUndefined();
    });

    it('run("popout") pops a tab or a whole tabset into a window layout with a command', () => {
        const { model, engine, commands } = setup();
        const result = engine.run("popout", { nodeId: "ts0" });
        expect(commands.map((c) => c.command)).toEqual(["tabset.popout"]);
        const layout = result.ok ? result.value.windowId : "";
        expect(model.get("window-by", { id: layout })).toBeDefined();
        expect(model.get("layout-id-by", { nodeId: "t0" })).toBe(layout);
        expect(model.get("layout-id-by", { nodeId: "t1" })).toBe(layout);
        expect(model.is("node-in-window", { nodeId: "t0" })).toBe(true);
        expect(engine.can("popout", { nodeId: "t0" })).toBe(false);
    });

    it('run("dock-back") moves a tab (or the rest of its window) into the main layout\'s active tabset', () => {
        const { model, engine, commands } = setup();
        engine.run("popout", { nodeId: "ts0" });
        model.run("tabset.activate", { tabsetId: "ts1" });

        engine.run("dock-back", { nodeId: "t0" });
        expect(model.get("node-parent-by", { nodeId: "t0" })?.id).toBe("ts1");
        expect(commands.at(-1)?.command).toBe("batch");

        // what is left is the whole window: it closes
        engine.run("dock-back", { nodeId: "ts0" });
        expect(commands.at(-1)?.command).toBe("window.close");
        const ts1 = model.get("node-by", { id: "ts1" });
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t2", "t0", "t1"],
        );
        expect(model.state.windows).toEqual([]);
        expect(model.get("layout-id-by", { nodeId: "t1" })).toBe(MAIN_LAYOUT);
    });

    it('run("dock-back") keeps a pinned tab pinned: unpinned for the move, pinned again in the target', () => {
        const { model, engine, commands } = setup();
        model.run("tab.pin", { tabId: "t1", value: true });
        engine.run("popout", { nodeId: "ts0" });
        model.run("tabset.activate", { tabsetId: "ts1" });

        expect(engine.run("dock-back", { nodeId: "t1" }).ok).toBe(true);
        expect(commands.at(-1)?.command).toBe("batch");
        const ts1 = model.get("node-by", { id: "ts1" });
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t1", "t2"],
        );
        expect(model.get("node-by", { id: "t1" })).toMatchObject({
            pinned: true,
        });
        expect(model.get("layout-id-by", { nodeId: "t0" })).not.toBe(
            MAIN_LAYOUT,
        );
    });

    it("keeps a window's path number while it is open, whichever window closes first", () => {
        const { model, engine } = setup();
        const first = engine.run("popout", { nodeId: "t0" });
        const second = engine.run("popout", { nodeId: "t2" });
        const one = first.ok ? first.value.windowId : "";
        const two = second.ok ? second.value.windowId : "";
        const pathIn = (layoutId: string, id: string) => {
            const sub = engine.adapter.createPopoutEngine(layoutId);
            engines.push(sub);
            sub.adapter.prepare();
            return sub.get("layout-path-by", { nodeId: id });
        };
        expect(pathIn(one, "t0")).toMatch(/^\/sublayout1\//);
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);

        model.run("window.close", { windowId: one });
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);
        // a new window takes the free number
        const third = engine.run("popout", { nodeId: "t1" });
        const three = third.ok ? third.value.windowId : "";
        expect(pathIn(three, "t1")).toMatch(/^\/sublayout1\//);
    });

    it("does not redraw for a window's rect (window.configure)", () => {
        const { model, engine } = setup();
        const popped = engine.run("popout", { nodeId: "t0" });
        const layoutId = popped.ok ? popped.value.windowId : "";
        engine.adapter.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        let redraws = 0;
        engine.adapter.subscribe(() => redraws++);
        model.run(
            "window.configure",
            {
                windowId: layoutId,
                rect: { x: 1, y: 2, width: 300, height: 200 },
            },
            { transient: true },
        );
        expect(redraws).toBe(0);
        model.run("tab.select", { tabId: "t1" });
        expect(redraws).toBe(1);
    });
});

describe("DOM ids", () => {
    it("are scoped per engine, so two models with the same ids stay apart on one page", () => {
        const a = setup().engine;
        const b = setup().engine;
        expect(a.get("tab-button-dom-id-by", { tabId: "t0" })).not.toBe(
            b.get("tab-button-dom-id-by", { tabId: "t0" }),
        );
        expect(a.get("tab-panel-dom-id-by", { tabId: "t0" })).not.toBe(
            b.get("tab-panel-dom-id-by", { tabId: "t0" }),
        );
        // popout engines share their main engine's scope
        const popped = a.run("popout", { nodeId: "t0" });
        const sub = a.adapter.createPopoutEngine(
            popped.ok ? popped.value.windowId : "",
        );
        engines.push(sub);
        expect(sub.get("tab-button-dom-id-by", { tabId: "t0" })).toBe(
            a.get("tab-button-dom-id-by", { tabId: "t0" }),
        );
    });

    it("take an adapter's scope", () => {
        const engine = createLayoutEngine({
            model: freshModel(),
            idScope: "r1-",
        });
        engines.push(engine);
        expect(engine.get("tab-button-dom-id-by", { tabId: "t 0" })).toBe(
            "dockable-r1-tabbutton-t_0",
        );
        expect(engine.get("tab-panel-dom-id-by", { tabId: "t0" })).toBe(
            "dockable-r1-tab-t0",
        );
    });
});
