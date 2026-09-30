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
});
