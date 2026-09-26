// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Action,
    Actions,
    type BorderNode,
    createLayoutEngine,
    DockLocation,
    DragDropManager,
    getTabButtonId,
    getTabPanelId,
    type IJsonModel,
    type LayoutEngine,
    OVERLAY_ATTRIBUTE,
    type TabNode,
} from "../../src";
import {
    freshModel,
    mountTwoTabsets,
    node,
    Rects,
    twoTabsets,
} from "./fixture";

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the manager reads
function dragEvent(type: string, x: number, y: number) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: {
            setData: vi.fn(),
            setDragImage: vi.fn(),
            effectAllowed: "none",
            dropEffect: "none",
        },
    });
    return event as unknown as DragEvent;
}

const engines: LayoutEngine[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        engines[0]?.getDragDropManager().onDragEnded();
    }
    for (const engine of engines.splice(0)) engine.dispose();
    document.body.innerHTML = "";
});

function withBorders(
    borders: IJsonModel["borders"],
    global: IJsonModel["global"] = {},
): IJsonModel {
    return { ...structuredClone(twoTabsets), global, borders };
}

/**
 * The two-tabset layout (root 400x300 at 10,20, the root row filling it), with the given borders.
 * A left border's panel area, when registered, is 150px wide over the layout's left edge.
 */
function setup(json: IJsonModel) {
    const model = freshModel(json);
    const rects = new Rects();
    const actions: Action[] = [];
    const engine = createLayoutEngine({
        model,
        measure: rects.measure,
        onAction: (action) => {
            actions.push(action);
            return action;
        },
    });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    engine.sync();
    return { model, rects, engine, actions, ...dom };
}

describe("edge docking bands", () => {
    it("are edgeDockMargin deep and edgeDockLength long, centred on each edge of the root row", () => {
        const { model } = setup(withBorders([]));
        const bands = Object.fromEntries(
            model
                .getEdgeDockRects()
                .map(({ location, rect }) => [location.getName(), rect]),
        );
        expect(bands.top).toMatchObject({
            x: 150,
            y: 0,
            width: 100,
            height: 10,
        });
        expect(bands.bottom).toMatchObject({
            x: 150,
            y: 290,
            width: 100,
            height: 10,
        });
        expect(bands.left).toMatchObject({
            x: 0,
            y: 100,
            width: 10,
            height: 100,
        });
        expect(bands.right).toMatchObject({
            x: 390,
            y: 100,
            width: 10,
            height: 100,
        });

        model.doAction(
            Actions.updateModelAttributes({
                edgeDockMargin: 4,
                edgeDockLength: 60,
            }),
        );
        const top = model
            .getEdgeDockRects()
            .find(({ location }) => location === DockLocation.TOP)?.rect;
        expect(top).toMatchObject({ x: 170, y: 0, width: 60, height: 4 });

        model.doAction(
            Actions.updateModelAttributes({ enableEdgeDock: false }),
        );
        expect(model.getEdgeDockRects()).toEqual([]);
    });

    it("decide where a drop docks to an edge: a smaller margin frees a strip at the top (gap 11)", () => {
        const s = setup(withBorders([]));
        const manager = s.engine.getDragDropManager();
        const over = (x: number, y: number) => {
            manager.setDragNode(
                dragEvent("dragstart", 40, 35),
                node<TabNode>(s.model, "t2"),
            );
            s.root.dispatchEvent(dragEvent("dragenter", x, y));
            s.root.dispatchEvent(dragEvent("dragover", x, y));
            const indicator = manager.getIndicatorState();
            manager.onDragEnded();
            return indicator;
        };
        // 6px below the top edge, at its centre: the top band
        expect(over(210, 26)).toMatchObject({ kind: "edge", location: "top" });

        s.model.doAction(Actions.updateModelAttributes({ edgeDockMargin: 4 }));
        expect(over(210, 26).kind).toBe("rect");
    });
});

describe("edge bands in a short layout", () => {
    it("are drawn where a drop docks: at most the edge's length", () => {
        const s = setup(withBorders([]));
        // a 400x40 root row: the left and right bands are 40 long, the top and bottom 100
        s.rects.set(s.row, 10, 20, 400, 40);
        s.engine.sync();
        const left = s.model
            .getEdgeDockRects()
            .find(({ location }) => location === DockLocation.LEFT)?.rect;
        expect(left).toMatchObject({ x: 0, y: 0, width: 10, height: 40 });
        const top = s.model
            .getEdgeDockRects()
            .find(({ location }) => location === DockLocation.TOP)?.rect;
        expect(top).toMatchObject({ x: 150, width: 100 });
        // outside the drawn top band (15px past its end), a drop does not dock to the top
        const row = s.model.getRootRow();
        const t0 = node<TabNode>(s.model, "t0");
        expect(row?.canDrop(t0, 265, 2)?.location).not.toBe(DockLocation.TOP);
        expect(row?.canDrop(t0, 245, 2)?.location).toBe(DockLocation.TOP);
    });
});

describe("unmounted border parts", () => {
    it("leave no ghost rect behind to take drops", () => {
        const s = setup(
            withBorders([
                {
                    type: "border",
                    location: "left",
                    children: [{ type: "tab", id: "b0", name: "Files" }],
                },
            ]),
        );
        const border = s.model
            .getBorderSet()
            .getBorderMap()
            .get(DockLocation.LEFT) as BorderNode;
        const strip = s.rects.set(
            s.root.appendChild(document.createElement("div")),
            10,
            20,
            30,
            300,
        ) as HTMLElement;
        s.engine.registerMeasurable(border, "borderheader", strip);
        s.engine.sync();
        expect(border.getRect().width).toBe(30);
        s.engine.registerMeasurable(border, "borderheader", null);
        expect(border.getRect().width).toBe(0);
    });
});

describe("auto-hide borders during a drag", () => {
    const bottomAutoHide = withBorders([
        {
            type: "border",
            location: "bottom",
            enableAutoHide: true,
            children: [],
        },
    ]);

    it("reveal an empty auto-hide border near its edge, outside the edge docking bands, until the drag ends", () => {
        const s = setup(bottomAutoHide);
        const manager = s.engine.getDragDropManager();
        manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
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
        manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 210, 315));
        s.root.dispatchEvent(dragEvent("dragover", 210, 315)); // the bottom edge's centre
        expect(manager.getIndicatorState().revealedBorder).toBeUndefined();
        manager.onDragEnded();

        const plain = setup(
            withBorders([{ type: "border", location: "bottom", children: [] }]),
        );
        const plainManager = plain.engine.getDragDropManager();
        plainManager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(plain.model, "t0"),
        );
        plain.root.dispatchEvent(dragEvent("dragenter", 30, 315));
        plain.root.dispatchEvent(dragEvent("dragover", 30, 315));
        expect(plainManager.getIndicatorState().revealedBorder).toBeUndefined();
    });
});

describe("overlay borders", () => {
    const leftOverlay = withBorders([
        {
            type: "border",
            location: "left",
            borderType: "overlay",
            selected: 0,
            children: [{ type: "tab", id: "b0", name: "Files" }],
        },
    ]);

    function setupOverlay() {
        const s = setup(leftOverlay);
        const border = s.model
            .getBorderSet()
            .getBorderMap()
            .get(DockLocation.LEFT) as BorderNode;
        const area = s.rects.set(
            s.root.appendChild(document.createElement("div")),
            10,
            20,
            150,
            300,
        ) as HTMLElement;
        s.engine.registerMeasurable(border, "bordercontent", area);
        s.engine.sync();
        const press = (x: number, y: number, target: Element = s.root) =>
            s.engine.handleOverlayPointerDown({
                target,
                clientX: x,
                clientY: y,
            });
        return { ...s, border, area, press };
    }

    it("close on a press in the layout outside the open panel, through onAction", () => {
        const s = setupOverlay();
        expect(s.press(300, 100)).toBe(true);
        expect(s.border.getSelected()).toBe(-1);
        expect(s.actions.at(-1)).toMatchObject({
            type: Actions.SELECT_TAB,
            data: { tabNode: "b0" },
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
        expect(s.press(500, 100)).toBe(false); // outside the root row (a border strip, elsewhere)
        expect(s.border.getSelected()).toBe(0);
    });

    it("close with the close key from the tab button or the panel, and focus the tab button", () => {
        const s = setupOverlay();
        const button = s.root.appendChild(document.createElement("button"));
        button.id = getTabButtonId(node<TabNode>(s.model, "b0"));
        const panel = s.root.appendChild(document.createElement("div"));
        panel.id = getTabPanelId(node<TabNode>(s.model, "b0"));
        const input = panel.appendChild(document.createElement("input"));

        input.focus();
        const key = new KeyboardEvent("keydown", {
            key: "Escape",
            cancelable: true,
        });
        expect(s.engine.handleOverlayKeyDown(key, "Escape")).toBe(true);
        expect(key.defaultPrevented).toBe(true);
        expect(s.border.getSelected()).toBe(-1);
        expect(document.activeElement).toBe(button);

        // closed: the key does nothing any more
        expect(
            s.engine.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(false);

        s.engine.doAction(Actions.selectTab("b0"));
        button.focus();
        expect(
            s.engine.handleOverlayKeyDown(
                new KeyboardEvent("keydown", { key: "Escape" }),
                "Escape",
            ),
        ).toBe(true);
        expect(s.border.getSelected()).toBe(-1);
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
        expect(s.border.getSelected()).toBe(0);
    });
});
