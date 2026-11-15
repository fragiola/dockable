// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    createLayoutEngine,
    DragDropManager,
    type KeyEventInput,
    type LayoutEngine,
} from "../../src";
import { freshModel, mountTwoTabsets, Rects, recordCommands } from "./fixture";

const engines: LayoutEngine[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
    for (const engine of engines.splice(0)) engine.adapter.dispose();
    document.body.innerHTML = "";
});

function setup() {
    const model = freshModel();
    const rects = new Rects();
    const commands = recordCommands(model);
    const engine = createLayoutEngine({ model, measure: rects.measure });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    engine.run("measure-and-position");
    return { model, engine, commands, ...dom };
}

function key(
    k: string,
    modifiers: Partial<
        Pick<KeyEventInput, "ctrlKey" | "shiftKey" | "altKey" | "metaKey">
    > = {},
): KeyEventInput & { prevented: boolean; defaultPrevented: boolean } {
    const event = {
        key: k,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...modifiers,
        defaultPrevented: false,
        prevented: false,
        preventDefault() {
            event.prevented = true;
            event.defaultPrevented = true;
        },
    };
    return event;
}

/** a tab list with a button per tab of `ts0`, ids from the engine */
function tabStrip(engine: LayoutEngine, tabIds: string[]) {
    const list = document.body.appendChild(document.createElement("div"));
    list.setAttribute("role", "tablist");
    const buttons = tabIds.map((tabId) => {
        const button = list.appendChild(document.createElement("div"));
        button.setAttribute("role", "tab");
        button.tabIndex = 0;
        button.id = engine.get("tab-button-dom-id-by", { tabId });
        return button;
    });
    return buttons;
}

const press = {
    button: 0,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
};

describe("the interaction keys of the adapter", () => {
    it("key map: defaults, merged bindings, shared by a popout's engine", () => {
        const { engine } = setup();
        expect(engine.adapter.getKeyMap().closeTab).toBe("Ctrl+Delete");
        engine.adapter.setOptions({ keyMap: { focusTabToggle: "F6" } });
        expect(engine.adapter.getKeyMap()).toMatchObject({
            closeTab: "Ctrl+Delete",
            focusTabToggle: "F6",
        });
        const sub = engine.adapter.createPopoutEngine("w1");
        expect(sub.adapter.getKeyMap().focusTabToggle).toBe("F6");
    });

    it("key shortcuts of a tab, a tab list and a panel follow the key map", () => {
        const { engine, model } = setup();
        expect(engine.adapter.getKeyShortcuts("tab", "t0")).toBe(
            "Control+Delete",
        );
        expect(engine.adapter.getKeyShortcuts("tablist")).toBeUndefined();
        expect(engine.adapter.getKeyShortcuts("panel")).toBeUndefined();
        engine.adapter.setOptions({
            keyMap: { focusTabToggle: "F6", focusNextTabset: "Ctrl+F6" },
        });
        expect(engine.adapter.getKeyShortcuts("tab", "t0")).toBe(
            "F6 Control+Delete",
        );
        expect(engine.adapter.getKeyShortcuts("tablist")).toBe("Control+F6");
        expect(engine.adapter.getKeyShortcuts("panel")).toBe("F6");
        model.run("tab.pin", { tabId: "t0", value: true });
        expect(engine.adapter.getKeyShortcuts("tab", "t0")).toBe("F6");
    });

    it("drop state: none, and the same object while nothing changes", () => {
        const { engine } = setup();
        const first = engine.adapter.getDropState("ts0");
        expect(first).toEqual({
            target: false,
            location: undefined,
            index: undefined,
            refused: false,
        });
        expect(engine.adapter.getDropState("ts0")).toBe(first);
        expect(engine.adapter.getDropState("ts1")).toBe(first);
    });

    it("a primary press in a tabset activates it; a modified one does not", () => {
        const { engine, model } = setup();
        engine.adapter.handleTabSetPointerDown("ts1", {
            ...press,
            ctrlKey: true,
        });
        expect(model.is("tabset-active", { tabsetId: "ts1" })).toBe(false);
        engine.adapter.handleTabSetPointerDown("ts1", press);
        expect(model.is("tabset-active", { tabsetId: "ts1" })).toBe(true);
        engine.adapter.handlePanelPointerDown("t0");
        expect(model.is("tabset-active", { tabsetId: "ts0" })).toBe(true);
    });

    it("a tab click selects the tab, and runs nothing when it is selected", () => {
        const { engine, model, commands } = setup();
        engine.adapter.handleTabClick("t1");
        expect(model.is("tab-selected", { tabId: "t1" })).toBe(true);
        const count = commands.length;
        engine.adapter.handleTabClick("t1");
        expect(commands.length).toBe(count);
    });

    it("draggable follows the node's setting", () => {
        const { engine, model } = setup();
        expect(engine.adapter.isDraggable("t0")).toBe(true);
        expect(engine.adapter.isDraggable("ts0")).toBe(true);
        expect(engine.adapter.isDraggable("row")).toBe(false);
        model.run("tab.configure", { tabId: "t0", draggable: false });
        expect(engine.adapter.isDraggable("t0")).toBe(false);
    });

    it("tab keys: arrows move focus (mirrored in RTL), Enter selects, the close key closes", () => {
        const { engine, model } = setup();
        const [b0, b1] = tabStrip(engine, ["t0", "t1"]);
        if (!b0 || !b1) throw new Error("no buttons");
        const right = key("ArrowRight");
        expect(
            engine.adapter.handleTabKeyDown("t0", right, {
                element: b0,
                orientation: "horizontal",
            }),
        ).toBe(true);
        expect(right.prevented).toBe(true);
        expect(document.activeElement).toBe(b1);
        // a vertical strip ignores horizontal arrows
        expect(
            engine.adapter.handleTabKeyDown("t1", key("ArrowLeft"), {
                element: b1,
                orientation: "vertical",
            }),
        ).toBe(false);
        engine.adapter.handleTabKeyDown("t1", key("Home"), {
            element: b1,
            orientation: "horizontal",
        });
        expect(document.activeElement).toBe(b0);
        engine.adapter.handleTabKeyDown("t1", key("Enter"), {
            element: b1,
            orientation: "horizontal",
        });
        expect(model.is("tab-selected", { tabId: "t1" })).toBe(true);
        // a modified arrow is left for the key map
        expect(
            engine.adapter.handleTabKeyDown(
                "t0",
                key("ArrowRight", { shiftKey: true }),
                { element: b0, orientation: "horizontal" },
            ),
        ).toBe(false);
        // a key the content already handled is not ours
        const handled = key("ArrowRight");
        handled.defaultPrevented = true;
        expect(
            engine.adapter.handleTabKeyDown("t0", handled, {
                element: b0,
                orientation: "horizontal",
            }),
        ).toBe(false);
        engine.adapter.handleTabKeyDown(
            "t1",
            key("Delete", { ctrlKey: true }),
            { element: b1, orientation: "horizontal" },
        );
        expect(model.get("node-by", { id: "t1" })).toBeUndefined();
    });

    it("the panel's focus toggle key returns focus to the tab button", () => {
        const { engine, panels } = setup();
        const [b0] = tabStrip(engine, ["t0"]);
        engine.adapter.setOptions({ keyMap: { focusTabToggle: "F6" } });
        expect(
            engine.adapter.handlePanelKeyDown("t0", key("F5"), panels.t0),
        ).toBe(false);
        const f6 = key("F6");
        expect(engine.adapter.handlePanelKeyDown("t0", f6, panels.t0)).toBe(
            true,
        );
        expect(f6.prevented).toBe(true);
        expect(document.activeElement).toBe(b0);
    });

    it("document keys: an unbound key is not handled", () => {
        const { engine } = setup();
        expect(engine.adapter.handleDocumentKeyDown(key("F6"))).toBe(false);
    });
});
