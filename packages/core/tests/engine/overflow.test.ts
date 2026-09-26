// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    Actions,
    createLayoutEngine,
    type IJsonModel,
    type LayoutEngine,
    type TabNode,
    type TabSetNode,
} from "../../src";
import { freshModel, mountTwoTabsets, node, Rects } from "./fixture";

// ts0 with four tabs (80px each): a list whose width the test sets, and a 40px trigger after it
const fourTabs: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: ["t0", "t1", "t2", "t3"].map((id) => ({
                    type: "tab" as const,
                    id,
                    name: id,
                })),
            },
            {
                type: "tabset",
                id: "ts1",
                children: [{ type: "tab", id: "t4", name: "t4" }],
            },
        ],
    },
};

const engines: LayoutEngine[] = [];
afterEach(() => {
    for (const engine of engines.splice(0)) engine.dispose();
    document.body.innerHTML = "";
});

function setup() {
    const model = freshModel(fourTabs);
    const rects = new Rects();
    const engine = createLayoutEngine({ model, measure: rects.measure });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    const el = () => dom.root.appendChild(document.createElement("div"));
    const list = el();
    const buttons = ["t0", "t1", "t2", "t3"].map((id) => {
        const button = el();
        engine.registerMeasurable(
            node<TabNode>(model, id),
            "tabbutton",
            button,
        );
        return button;
    });
    const ts0 = node<TabSetNode>(model, "ts0");
    engine.registerTabList(ts0, list);
    /** lays the strip out as a browser would: the list is `width` wide; shown tabs are 80px */
    const layout = (width: number) => {
        rects.set(list, 10, 20, width, 30);
        const hidden = new Set(engine.getHiddenTabs("ts0"));
        let x = 10;
        buttons.forEach((button, i) => {
            if (hidden.has(`t${i}`)) {
                rects.set(button, 0, 0, 0, 0); // display: none
            } else {
                rects.set(button, x, 20, 80, 30);
                x += 80;
            }
        });
    };
    return { model, rects, engine, ts0, list, layout, el };
}

describe("tab overflow in the engine", () => {
    it("hides the tabs that do not fit, and shows them again when the strip widens", () => {
        const s = setup();
        const listener = vi.fn();
        s.engine.subscribeOverflow(listener);
        s.layout(400);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual([]);

        s.layout(250);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t3"]);
        expect(listener).toHaveBeenCalledTimes(1);

        // the hidden tab measures as empty now, but its natural size is kept
        s.layout(250);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t3"]);
        expect(listener).toHaveBeenCalledTimes(1); // same answer: no notification

        s.layout(400);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual([]);
        expect(s.engine.getHiddenTabs("ts1")).toEqual([]); // another container
    });

    it("reserves the trigger's space, measured beside the list", () => {
        const s = setup();
        s.layout(250);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t3"]);
        // the trigger appears after the list, which shrinks by its 40px
        const trigger = s.el();
        s.engine.registerOverflowTrigger(s.ts0, trigger);
        s.layout(210);
        s.rects.set(trigger, 220, 20, 40, 30);
        s.engine.sync();
        // 210 + 40 = 250 of space, 40 of it for the trigger: two tabs fit
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t2", "t3"]);
    });

    it("counts only the trigger's own space, whatever sits between it and the list", () => {
        const s = setup();
        s.layout(250);
        s.engine.sync();
        const trigger = s.el();
        s.engine.registerOverflowTrigger(s.ts0, trigger);
        // a 60px button between the list (shrunk by the trigger's 40px) and the trigger
        s.layout(210);
        s.rects.set(trigger, 290, 20, 40, 30);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t2", "t3"]);
        // stable: the same answer on the next pass (no show/hide loop)
        s.layout(210);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t2", "t3"]);
    });

    it("keeps the selected tab in the strip", () => {
        const s = setup();
        s.engine.doAction(Actions.selectTab("t3"));
        s.layout(250);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t2"]);
    });

    it("forgets a container whose tab list unregisters", () => {
        const s = setup();
        s.layout(250);
        s.engine.sync();
        expect(s.engine.getHiddenTabs("ts0")).toEqual(["t3"]);
        s.engine.registerTabList(s.ts0, null);
        expect(s.engine.getHiddenTabs("ts0")).toEqual([]);
    });
});
