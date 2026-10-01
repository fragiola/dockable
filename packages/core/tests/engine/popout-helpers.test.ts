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
    // popout is opt-in per tab (enablePopout defaults to false)
    model.run("layout.configure", {
        defaults: { tab: { enablePopout: true } },
    });
    const commands = recordCommands(model);
    const engine = createLayoutEngine({ model, popout: { supportsPopout } });
    engines.push(engine);
    return { model, engine, commands };
}

describe("popout helpers", () => {
    it("canPopout: supported, and the model accepts it", () => {
        const { model, engine } = setup();
        expect(engine.can("popout", { node: "t0" })).toBe(true);
        expect(engine.can("popout", { node: "ts1" })).toBe(true);
        model.run("tab.configure", { tab: "t0", enablePopout: false });
        expect(engine.can("popout", { node: "t0" })).toBe(false);
        expect(engine.can("popout", { node: "ts0" })).toBe(false); // one tab refuses
        const unsupported = setup(false);
        expect(unsupported.engine.can("popout", { node: "t2" })).toBe(false);
    });

    it("popout() pops a tab or a whole tabset into a window layout with a command", () => {
        const { model, engine, commands } = setup();
        const result = engine.run("popout", { node: "ts0" });
        expect(commands.map((c) => c.command)).toEqual(["tabset.popout"]);
        const layout = result.ok ? result.value.window : "";
        expect(model.get("window", { window: layout })).toBeDefined();
        expect(model.get("layout-id", { node: "t0" })).toBe(layout);
        expect(model.get("layout-id", { node: "t1" })).toBe(layout);
        expect(model.is("in-window", { node: "t0" })).toBe(true);
        expect(engine.can("popout", { node: "t0" })).toBe(false);
    });

    it("dockBack() moves a tab (or the rest of its window) into the main layout's active tabset", () => {
        const { model, engine, commands } = setup();
        engine.run("popout", { node: "ts0" });
        model.run("tabset.activate", { tabset: "ts1" });

        engine.run("dock-back", { node: "t0" });
        expect(model.get("parent", { node: "t0" })?.id).toBe("ts1");
        expect(commands.at(-1)?.command).toBe("batch");

        // what is left is the whole window: it closes
        engine.run("dock-back", { node: "ts0" });
        expect(commands.at(-1)?.command).toBe("window.close");
        const ts1 = model.get("node", { node: "ts1" });
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t2", "t0", "t1"],
        );
        expect(model.state.windows).toEqual([]);
        expect(model.get("layout-id", { node: "t1" })).toBe(MAIN_LAYOUT);
    });

    it("dockBack() keeps a pinned tab pinned: unpinned for the move, pinned again in the target", () => {
        const { model, engine, commands } = setup();
        model.run("tab.pin", { tab: "t1", value: true });
        engine.run("popout", { node: "ts0" });
        model.run("tabset.activate", { tabset: "ts1" });

        expect(engine.run("dock-back", { node: "t1" }).ok).toBe(true);
        expect(commands.at(-1)?.command).toBe("batch");
        const ts1 = model.get("node", { node: "ts1" });
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t1", "t2"],
        );
        expect(model.get("node", { node: "t1" })).toMatchObject({
            pinned: true,
        });
        expect(model.get("layout-id", { node: "t0" })).not.toBe(MAIN_LAYOUT);
    });

    it("keeps a window's path number while it is open, whichever window closes first", () => {
        const { model, engine } = setup();
        const first = engine.run("popout", { node: "t0" });
        const second = engine.run("popout", { node: "t2" });
        const one = first.ok ? first.value.window : "";
        const two = second.ok ? second.value.window : "";
        const pathIn = (layoutId: string, id: string) => {
            const sub = engine.adapter.createPopoutEngine(layoutId);
            engines.push(sub);
            sub.adapter.prepare();
            return sub.get("path", { node: id });
        };
        expect(pathIn(one, "t0")).toMatch(/^\/sublayout1\//);
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);

        model.run("window.close", { window: one });
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);
        // a new window takes the free number
        const third = engine.run("popout", { node: "t1" });
        const three = third.ok ? third.value.window : "";
        expect(pathIn(three, "t1")).toMatch(/^\/sublayout1\//);
    });

    it("does not redraw for a window's rect (window.configure)", () => {
        const { model, engine } = setup();
        const popped = engine.run("popout", { node: "t0" });
        const layoutId = popped.ok ? popped.value.window : "";
        engine.adapter.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        let redraws = 0;
        engine.adapter.subscribe(() => redraws++);
        model.run(
            "window.configure",
            { window: layoutId, rect: { x: 1, y: 2, width: 300, height: 200 } },
            { transient: true },
        );
        expect(redraws).toBe(0);
        model.run("tab.select", { tab: "t1" });
        expect(redraws).toBe(1);
    });
});

describe("DOM ids", () => {
    it("are scoped per engine, so two models with the same ids stay apart on one page", () => {
        const a = setup().engine;
        const b = setup().engine;
        expect(a.get("tab-button-id", { tab: "t0" })).not.toBe(
            b.get("tab-button-id", { tab: "t0" }),
        );
        expect(a.get("tab-panel-id", { tab: "t0" })).not.toBe(
            b.get("tab-panel-id", { tab: "t0" }),
        );
        // popout engines share their main engine's scope
        const popped = a.run("popout", { node: "t0" });
        const sub = a.adapter.createPopoutEngine(
            popped.ok ? popped.value.window : "",
        );
        engines.push(sub);
        expect(sub.get("tab-button-id", { tab: "t0" })).toBe(
            a.get("tab-button-id", { tab: "t0" }),
        );
    });

    it("take an adapter's scope", () => {
        const engine = createLayoutEngine({
            model: freshModel(),
            idScope: "r1-",
        });
        engines.push(engine);
        expect(engine.get("tab-button-id", { tab: "t 0" })).toBe(
            "dockable-r1-tabbutton-t_0",
        );
        expect(engine.get("tab-panel-id", { tab: "t0" })).toBe(
            "dockable-r1-tab-t0",
        );
    });
});
