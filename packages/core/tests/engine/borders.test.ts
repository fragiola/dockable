// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
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
        engines[0]?.getDragDropManager().onDragEnded();
    }
    for (const engine of engines.splice(0)) engine.dispose();
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
    engine.sync();
    return { model, rects, engine, commands, ...dom };
}

describe("edge docking bands", () => {
    it("are edgeDockMargin deep and edgeDockLength long, centred on each edge of the root row", () => {
        const { model, engine } = setup(withBorders([]));
        const bands = Object.fromEntries(
            engine.edgeBands().map(({ location, rect }) => [location, rect]),
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
        const top = engine
            .edgeBands()
            .find(({ location }) => location === "top")?.rect;
        expect(top).toEqual({ x: 170, y: 0, width: 60, height: 4 });

        model.run("layout.configure", {
            defaults: { layout: { edgeDock: false } },
        });
        expect(engine.edgeBands()).toEqual([]);
    });

    it("decide where a drop docks to an edge: a smaller margin frees a strip at the top (gap 11)", () => {
        const s = setup(withBorders([]));
        const manager = s.engine.getDragDropManager();
        const over = (x: number, y: number) => {
            manager.startDrag(dragEvent("dragstart", 40, 35), "t2");
            s.root.dispatchEvent(dragEvent("dragenter", x, y));
            s.root.dispatchEvent(dragEvent("dragover", x, y));
            const indicator = manager.getIndicatorState();
            manager.onDragEnded();
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
        s.engine.sync();
        const bands = s.engine.edgeBands();
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
        const manager = s.engine.getDragDropManager();
        const over = (x: number, y: number) => {
            manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
            s.root.dispatchEvent(dragEvent("dragenter", x + 10, y + 20));
            s.root.dispatchEvent(dragEvent("dragover", x + 10, y + 20));
            const indicator = manager.getIndicatorState();
            manager.onDragEnded();
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
                    children: [{ id: "b0", component: "test" }],
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
        s.engine.registerMeasurable("border_left", "borderheader", strip);
        s.engine.sync();
        expect(s.engine.rect("borderheader", "border_left")?.width).toBe(30);
        s.engine.registerMeasurable("border_left", "borderheader", null);
        expect(s.engine.rect("borderheader", "border_left")).toBeUndefined();
    });
});

describe("auto-hide borders during a drag", () => {
    const bottomAutoHide = withBorders([
        { location: "bottom", autoHide: true, children: [] },
    ]);

    it("reveal an empty auto-hide border near its edge, outside the edge docking bands, until the drag ends", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(manager.getIndicatorState().revealedBorder).toBe("bottom");
        s.root.dispatchEvent(dragEvent("dragover", 200, 150));
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
        s.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(manager.getIndicatorState().revealedBorder).toBe("bottom");
        manager.onDragEnded();
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
    });

    it("do not reveal over the edge docking band, or a border that has tabs or is not auto-hide", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.getDragDropManager();
        manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 210, 315));
        s.root.dispatchEvent(dragEvent("dragover", 210, 315)); // the bottom edge's centre
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
        manager.onDragEnded();

        const plain = setup(
            withBorders([{ location: "bottom", children: [] }]),
        );
        const plainManager = plain.engine.getDragDropManager();
        plainManager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        plain.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        plain.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(plainManager.getIndicatorState().revealedBorder).toBeUndefined();
    });
});

describe("overlay borders", () => {
    const leftOverlay = withBorders([
        {
            location: "left",
            mode: "overlay",
            selected: 0,
            children: [{ id: "b0", component: "test" }],
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
        s.engine.registerMeasurable("border_left", "bordercontent", area);
        s.engine.sync();
        const press = (x: number, y: number, target: Element = s.root) =>
            s.engine.handleOverlayPointerDown({
                target,
                clientX: x,
                clientY: y,
            });
        const selected = () => {
            const border = s.model.get("border_left");
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
            payload: { border: "border_left", open: false },
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
        button.id = s.engine.tabButtonId("b0");
        const panel = s.root.appendChild(document.createElement("div"));
        panel.id = s.engine.tabPanelId("b0");
        const input = panel.appendChild(document.createElement("input"));

        input.focus();
        const key = new KeyboardEvent("keydown", {
            key: "Escape",
            cancelable: true,
        });
        expect(s.engine.handleOverlayKeyDown(key, "Escape")).toBe(true);
        expect(key.defaultPrevented).toBe(true);
        expect(s.selected()).toBe(-1);
        expect(document.activeElement).toBe(button);

        // closed: the key does nothing any more
        expect(
            s.engine.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(false);

        s.engine.run("tab.select", { tab: "b0" });
        button.focus();
        expect(
            s.engine.handleOverlayKeyDown(
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
            s.engine.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(false);
        expect(
            s.engine.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Enter" }),
                "Escape",
            ),
        ).toBe(false);
        expect(s.selected()).toBe(0);
    });
});
