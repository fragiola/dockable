// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createLayoutEngine,
    DragDropManager,
    type LayoutEngine,
    type LayoutJson,
    OVERLAY_ATTRIBUTE,
} from "../../src";
import {
    dragEvent,
    freshModel,
    mountTwoTabsets,
    Rects,
    recordCommands,
    twoTabsets,
} from "./fixture";

const engines: LayoutEngine[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
    for (const engine of engines.splice(0)) engine.adapter.dispose();
    document.body.innerHTML = "";
});

function withBorders(
    borders: LayoutJson["borders"],
    defaults: LayoutJson["defaults"] = {},
): LayoutJson {
    return { ...structuredClone(twoTabsets), defaults, borders };
}

/** The two-tabset layout (root 400x300 at 10,20, the root row filling it), with the given borders. */
function setup(json: LayoutJson) {
    const model = freshModel(json);
    const rects = new Rects();
    const commands = recordCommands(model);
    const engine = createLayoutEngine({ model, measure: rects.measure });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    engine.run("measure-and-position");
    return { model, rects, engine, commands, ...dom };
}

describe("edge docking bands", () => {
    it("are edgeDockMargin deep and edgeDockLength long, centred on each edge of the root row", () => {
        const { model, engine } = setup(withBorders([]));
        const bands = Object.fromEntries(
            engine.adapter
                .edgeBands()
                .map(({ location, rect }) => [location, rect]),
        );
        expect(bands.top).toEqual({ x: 150, y: 0, width: 100, height: 10 });
        expect(bands.bottom).toEqual({
            x: 150,
            y: 290,
            width: 100,
            height: 10,
        });
        expect(bands.left).toEqual({ x: 0, y: 100, width: 10, height: 100 });
        expect(bands.right).toEqual({ x: 390, y: 100, width: 10, height: 100 });

        model.run("layout.configure", {
            defaults: { layout: { edgeDockMargin: 4, edgeDockLength: 60 } },
        });
        const top = engine.adapter
            .edgeBands()
            .find(({ location }) => location === "top")?.rect;
        expect(top).toEqual({ x: 170, y: 0, width: 60, height: 4 });

        model.run("layout.configure", {
            defaults: { layout: { edgeDock: false } },
        });
        expect(engine.adapter.edgeBands()).toEqual([]);
    });

    it("decide where a drop docks to an edge: a smaller margin frees a strip at the top (gap 11)", () => {
        const s = setup(withBorders([]));
        const manager = s.engine.adapter.getDragDropManager();
        const over = (x: number, y: number) => {
            manager.startDrag(dragEvent("dragstart", 40, 35), "t2");
            s.root.dispatchEvent(dragEvent("dragenter", x, y));
            s.root.dispatchEvent(dragEvent("dragover", x, y));
            const indicator = manager.getIndicatorState();
            DragDropManager.endDrag();
            return indicator;
        };
        // 6px below the top edge, at its centre: the top band
        expect(over(210, 26)).toMatchObject({ kind: "edge", location: "top" });
        s.model.run("layout.configure", {
            defaults: { layout: { edgeDockMargin: 4 } },
        });
        expect(over(210, 26).kind).toBe("rect");
    });
});

describe("edge bands in a short layout", () => {
    it("are drawn where a drop docks: at most the edge's length", () => {
        const s = setup(withBorders([]));
        // a 400x40 root row: the left and right bands are 40 long, the top and bottom 100
        s.rects.set(s.row, 10, 20, 400, 40);
        s.engine.run("measure-and-position");
        const bands = s.engine.adapter.edgeBands();
        expect(bands.find(({ location }) => location === "left")?.rect).toEqual(
            {
                x: 0,
                y: 0,
                width: 10,
                height: 40,
            },
        );
        expect(
            bands.find(({ location }) => location === "top")?.rect,
        ).toMatchObject({ x: 150, width: 100 });
        // outside the drawn top band (15px past its end), a drop does not dock to the top
        const manager = s.engine.adapter.getDragDropManager();
        const over = (x: number, y: number) => {
            manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
            s.root.dispatchEvent(dragEvent("dragenter", x + 10, y + 20));
            s.root.dispatchEvent(dragEvent("dragover", x + 10, y + 20));
            const indicator = manager.getIndicatorState();
            DragDropManager.endDrag();
            return indicator;
        };
        expect(over(265, 2).kind).not.toBe("edge");
        expect(over(245, 2)).toMatchObject({ kind: "edge", location: "top" });
    });
});

describe("unmounted border parts", () => {
    it("leave no ghost rect behind to take drops", () => {
        const s = setup(
            withBorders([
                {
                    location: "left",
                    children: [{ id: "b0", component: "test", label: "test" }],
                },
            ]),
        );
        const strip = s.rects.set(
            s.root.appendChild(document.createElement("div")),
            10,
            20,
            30,
            300,
        );
        s.engine.adapter.registerMeasurable(
            "border_left",
            "borderheader",
            strip,
        );
        s.engine.run("measure-and-position");
        expect(
            s.engine.adapter.rect("borderheader", "border_left")?.width,
        ).toBe(30);
        s.engine.adapter.registerMeasurable(
            "border_left",
            "borderheader",
            null,
        );
        expect(
            s.engine.adapter.rect("borderheader", "border_left"),
        ).toBeUndefined();
    });
});

describe("auto-hide borders during a drag", () => {
    const bottomAutoHide = withBorders([
        { location: "bottom", autoHide: true, children: [] },
    ]);

    it("reveal an empty auto-hide border near its edge, outside the edge docking bands, until the drag ends", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.adapter.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(manager.getIndicatorState().revealedBorder).toBe("bottom");
        s.root.dispatchEvent(dragEvent("dragover", 200, 150));
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(manager.getIndicatorState().revealedBorder).toBe("bottom");
        DragDropManager.endDrag();
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
    });

    it("notify once per dragover, revealing a border and moving the outline together", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.adapter.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        const notified = vi.fn();
        manager.subscribe(notified);
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(manager.getIndicatorState()).toMatchObject({
            visible: true,
            revealedBorder: "bottom",
        });
        expect(notified).toHaveBeenCalledTimes(1);
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        expect(manager.getIndicatorState()).toMatchObject({
            targetNodeId: "ts1",
            revealedBorder: undefined,
        });
        expect(notified).toHaveBeenCalledTimes(2);
    });

    it("do not reveal over the edge docking band, or a border that has tabs or is not auto-hide", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.adapter.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 210, 315));
        s.root.dispatchEvent(dragEvent("dragover", 210, 315)); // the bottom edge's centre
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
        DragDropManager.endDrag();

        const plain = setup(
            withBorders([{ location: "bottom", children: [] }]),
        );
        const plainManager = plain.engine.adapter.getDragDropManager();
        plainManager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        plain.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        plain.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(plainManager.getIndicatorState().revealedBorder).toBeUndefined();
    });
});

describe("border-shown", () => {
    const tab = (id: string) => ({ id, component: "test", label: id });

    it("is on for a border whose show is on, unless it auto-hides with no tabs", () => {
        const { engine, model } = setup(
            withBorders([
                { location: "bottom", autoHide: true, children: [] },
                { location: "top", children: [] },
                { location: "right", show: false, children: [tab("r0")] },
                { location: "left", autoHide: true, children: [tab("l0")] },
            ]),
        );
        const shown = (borderId: string) =>
            engine.is("border-shown", { borderId });
        expect(shown("border_bottom")).toBe(false);
        expect(shown("border_top")).toBe(true);
        expect(shown("border_right")).toBe(false);
        expect(shown("border_left")).toBe(true);
        expect(shown("ts0")).toBe(false);
        model.run("tab.move", { tabId: "t0", to: "border_bottom" });
        expect(shown("border_bottom")).toBe(true);
    });

    it("is on for an empty auto-hide border while a drag reveals it", () => {
        const s = setup(
            withBorders([{ location: "bottom", autoHide: true, children: [] }]),
        );
        const shown = () =>
            s.engine.is("border-shown", { borderId: "border_bottom" });
        const manager = s.engine.adapter.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(shown()).toBe(true);
        // revealed, it stays revealed while the pointer is near its edge
        s.root.dispatchEvent(dragEvent("dragover", 32, 313));
        expect(shown()).toBe(true);
        s.root.dispatchEvent(dragEvent("dragover", 200, 150));
        expect(shown()).toBe(false);
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        DragDropManager.endDrag();
        expect(shown()).toBe(false);
    });

    it("is off in a popout window's layout", () => {
        const { engine } = setup({
            ...withBorders([{ location: "top", children: [] }]),
            windows: [
                {
                    id: "w0",
                    rect: { x: 0, y: 0, width: 400, height: 300 },
                    root: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [tab("w0t0")],
                            },
                        ],
                    },
                },
            ],
        });
        const sub = engine.adapter.createPopoutEngine("w0");
        engines.push(sub);
        expect(engine.is("border-shown", { borderId: "border_top" })).toBe(
            true,
        );
        expect(sub.is("border-shown", { borderId: "border_top" })).toBe(false);
    });
});

describe("overlay-placement-by", () => {
    const open = (
        location: "top" | "bottom" | "left" | "right",
        size: number,
        mode: "overlay" | "docked" = "overlay",
    ) => ({
        location,
        mode,
        size,
        selected: 0,
        children: [{ id: `${location}0`, component: "test", label: "x" }],
    });

    it("spans a top or bottom overlay along its edge", () => {
        const { engine } = setup(
            withBorders([open("top", 50), open("bottom", 70)]),
        );
        expect(
            engine.get("overlay-placement-by", { borderId: "border_top" }),
        ).toEqual({ top: 0, left: 0, right: 0 });
        expect(
            engine.get("overlay-placement-by", { borderId: "border_bottom" }),
        ).toEqual({ bottom: 0, left: 0, right: 0 });
    });

    it("stops a left or right overlay at the open top and bottom overlays (their size and a splitter)", () => {
        const { engine, model } = setup(
            withBorders([
                open("top", 50),
                open("bottom", 70),
                open("left", 150),
                open("right", 150),
            ]),
        );
        const placement = (borderId: string) =>
            engine.get("overlay-placement-by", { borderId });
        const splitter = engine.get("splitter-size");
        expect(splitter).toBe(8);
        expect(placement("border_left")).toEqual({
            left: 0,
            top: 50 + splitter,
            bottom: 70 + splitter,
        });
        expect(placement("border_right")).toEqual({
            right: 0,
            top: 50 + splitter,
            bottom: 70 + splitter,
        });
        model.run("border.configure", { borderId: "border_top", open: false });
        expect(placement("border_left")).toEqual({
            left: 0,
            top: 0,
            bottom: 70 + splitter,
        });
        model.run("border.configure", {
            borderId: "border_bottom",
            show: false,
        });
        expect(placement("border_left")).toEqual({
            left: 0,
            top: 0,
            bottom: 0,
        });
    });

    it("ignores docked borders, and places none for a docked border", () => {
        const { engine } = setup(
            withBorders([open("top", 50, "docked"), open("left", 150)]),
        );
        expect(
            engine.get("overlay-placement-by", { borderId: "border_left" }),
        ).toEqual({ left: 0, top: 0, bottom: 0 });
        expect(
            engine.get("overlay-placement-by", { borderId: "border_top" }),
        ).toBeUndefined();
        expect(
            engine.get("overlay-placement-by", { borderId: "ts0" }),
        ).toBeUndefined();
    });
});

describe("overlay borders", () => {
    const leftOverlay = withBorders([
        {
            location: "left",
            mode: "overlay",
            selected: 0,
            children: [{ id: "b0", component: "test", label: "test" }],
        },
    ]);

    function setupOverlay() {
        const s = setup(leftOverlay);
        const area = s.rects.set(
            s.root.appendChild(document.createElement("div")),
            10,
            20,
            150,
            300,
        );
        s.engine.adapter.registerMeasurable(
            "border_left",
            "bordercontent",
            area,
        );
        s.engine.run("measure-and-position");
        const press = (x: number, y: number, target: Element = s.root) =>
            s.engine.adapter.handleOverlayPointerDown({
                target,
                clientX: x,
                clientY: y,
            });
        const selected = () => {
            const border = s.model.get("node-by", { id: "border_left" });
            return border?.type === "border" ? border.selected : undefined;
        };
        return { ...s, area, press, selected };
    }

    it("close on a press in the layout outside the open panel, with border.configure", () => {
        const s = setupOverlay();
        expect(s.press(300, 100)).toBe(true);
        expect(s.selected()).toBe(-1);
        expect(s.commands.at(-1)).toEqual({
            command: "border.configure",
            payload: { borderId: "border_left", open: false },
        });
    });

    it("stay open on a press inside the panel, on an element of the overlay, or outside the layout's area", () => {
        const s = setupOverlay();
        expect(s.press(50, 100)).toBe(false); // inside the panel
        const splitter = document.createElement("div");
        splitter.setAttribute(OVERLAY_ATTRIBUTE, "");
        const inner = splitter.appendChild(document.createElement("span"));
        s.root.appendChild(splitter);
        expect(s.press(300, 100, inner)).toBe(false);
        expect(s.press(500, 100)).toBe(false); // outside the root row
        expect(s.selected()).toBe(0);
    });

    it("close with the close key from the tab button or the panel, and focus the tab button", () => {
        const s = setupOverlay();
        const button = s.root.appendChild(document.createElement("button"));
        button.id = s.engine.get("tab-button-dom-id-by", {
            tabId: "b0",
        });
        const panel = s.root.appendChild(document.createElement("div"));
        panel.id = s.engine.get("tab-panel-dom-id-by", { tabId: "b0" });
        const input = panel.appendChild(document.createElement("input"));

        input.focus();
        const key = new KeyboardEvent("keydown", {
            key: "Escape",
            cancelable: true,
        });
        expect(s.engine.adapter.handleOverlayKeyDown(key, "Escape")).toBe(true);
        expect(key.defaultPrevented).toBe(true);
        expect(s.selected()).toBe(-1);
        expect(document.activeElement).toBe(button);

        // closed: the key does nothing any more
        expect(
            s.engine.adapter.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(false);

        s.engine.adapter.model.run("tab.select", { tabId: "b0" });
        button.focus();
        expect(
            s.engine.adapter.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(true);
        expect(s.selected()).toBe(-1);
    });

    it("ignore other keys, and focus outside the overlay", () => {
        const s = setupOverlay();
        const elsewhere = s.root.appendChild(document.createElement("button"));
        elsewhere.focus();
        expect(
            s.engine.adapter.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(false);
        expect(
            s.engine.adapter.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Enter" }),
                "Escape",
            ),
        ).toBe(false);
        expect(s.selected()).toBe(0);
    });
});
