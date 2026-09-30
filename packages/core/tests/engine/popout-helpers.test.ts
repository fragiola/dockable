// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createLayoutEngine, type LayoutEngine, MAIN_LAYOUT } from "../../src";
import { freshModel, recordCommands } from "./fixture";

const engines: LayoutEngine[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.dispose();
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
        expect(engine.canPopout("t0")).toBe(true);
        expect(engine.canPopout("ts1")).toBe(true);
        model.run("tab.configure", { tab: "t0", enablePopout: false });
        expect(engine.canPopout("t0")).toBe(false);
        expect(engine.canPopout("ts0")).toBe(false); // one tab refuses
        const unsupported = setup(false);
        expect(unsupported.engine.canPopout("t2")).toBe(false);
    });

    it("popout() pops a tab or a whole tabset into a window layout with a command", () => {
        const { model, engine, commands } = setup();
        const result = engine.popout("ts0");
        expect(commands.map((c) => c.command)).toEqual(["tabset.popout"]);
        const layout = result.ok ? result.value.window : "";
        expect(model.windowLayout(layout)).toBeDefined();
        expect(model.layoutOf("t0")).toBe(layout);
        expect(model.layoutOf("t1")).toBe(layout);
        expect(engine.isInWindow("t0")).toBe(true);
        expect(engine.canPopout("t0")).toBe(false);
    });

    it("dockBack() moves a tab (or the rest of its window) into the main layout's active tabset", () => {
        const { model, engine, commands } = setup();
        engine.popout("ts0");
        model.run("tabset.activate", { tabset: "ts1" });

        engine.dockBack("t0");
        expect(model.parentOf("t0")?.id).toBe("ts1");
        expect(commands.at(-1)?.command).toBe("batch");

        // what is left is the whole window: it closes
        engine.dockBack("ts0");
        expect(commands.at(-1)?.command).toBe("window.close");
        const ts1 = model.get("ts1");
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t2", "t0", "t1"],
        );
        expect(model.state.windows).toEqual([]);
        expect(model.layoutOf("t1")).toBe(MAIN_LAYOUT);
    });

    it("dockBack() keeps a pinned tab pinned: unpinned for the move, pinned again in the target", () => {
        const { model, engine, commands } = setup();
        model.run("tab.pin", { tab: "t1", value: true });
        engine.popout("ts0");
        model.run("tabset.activate", { tabset: "ts1" });

        expect(engine.dockBack("t1").ok).toBe(true);
        expect(commands.at(-1)?.command).toBe("batch");
        const ts1 = model.get("ts1");
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["t1", "t2"],
        );
        expect(model.get("t1")).toMatchObject({ pinned: true });
        expect(model.layoutOf("t0")).not.toBe(MAIN_LAYOUT);
    });

    it("keeps a window's path number while it is open, whichever window closes first", () => {
        const { model, engine } = setup();
        const first = engine.popout("t0");
        const second = engine.popout("t2");
        const one = first.ok ? first.value.window : "";
        const two = second.ok ? second.value.window : "";
        const pathIn = (layoutId: string, id: string) => {
            const sub = engine.createPopoutEngine(layoutId);
            engines.push(sub);
            sub.prepare();
            return sub.path(id);
        };
        expect(pathIn(one, "t0")).toMatch(/^\/sublayout1\//);
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);

        model.run("window.close", { window: one });
        expect(pathIn(two, "t2")).toMatch(/^\/sublayout2\//);
        // a new window takes the free number
        const third = engine.popout("t1");
        const three = third.ok ? third.value.window : "";
        expect(pathIn(three, "t1")).toMatch(/^\/sublayout1\//);
    });

    it("does not redraw for a window's rect (window.configure)", () => {
        const { model, engine } = setup();
        const popped = engine.popout("t0");
        const layoutId = popped.ok ? popped.value.window : "";
        engine.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        let redraws = 0;
        engine.subscribe(() => redraws++);
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
        expect(a.tabButtonId("t0")).not.toBe(b.tabButtonId("t0"));
        expect(a.tabPanelId("t0")).not.toBe(b.tabPanelId("t0"));
        // popout engines share their main engine's scope
        const popped = a.popout("t0");
        const sub = a.createPopoutEngine(popped.ok ? popped.value.window : "");
        engines.push(sub);
        expect(sub.tabButtonId("t0")).toBe(a.tabButtonId("t0"));
    });

    it("take an adapter's scope", () => {
        const engine = createLayoutEngine({
            model: freshModel(),
            idScope: "r1-",
        });
        engines.push(engine);
        expect(engine.tabButtonId("t 0")).toBe("dockable-r1-tabbutton-t_0");
        expect(engine.tabPanelId("t0")).toBe("dockable-r1-tab-t0");
    });
});
