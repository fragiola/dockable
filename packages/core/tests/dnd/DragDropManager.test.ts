// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type Action,
    Actions,
    createLayoutEngine,
    DRAG_MARKER,
    DragDropManager,
    type LayoutEngine,
    Model,
    type OnExternalDrag,
    type RowNode,
    type TabNode,
    type TabSetNode,
} from "../../src";
import { freshModel, mountTwoTabsets, node, Rects } from "../engine/fixture";

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the manager reads
function fakeDataTransfer() {
    return {
        setData: vi.fn(),
        setDragImage: vi.fn(),
        effectAllowed: "none",
        dropEffect: "none",
    };
}

function dragEvent(
    type: string,
    x: number,
    y: number,
    dataTransfer = fakeDataTransfer(),
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event as unknown as DragEvent;
}

const engines: LayoutEngine[] = [];

afterEach(() => {
    DragDropManager.getDragState() &&
        engines[0]?.getDragDropManager().onDragEnded();
    for (const engine of engines.splice(0)) {
        engine.dispose();
    }
    document.body.innerHTML = "";
});

function setup(
    options: {
        json?: Parameters<typeof freshModel>[0];
        onAction?: (a: Action) => Action | undefined;
        onExternalDrag?: OnExternalDrag;
    } = {},
) {
    const model = freshModel(options.json);
    const rects = new Rects();
    const actions: Action[] = [];
    const engine = createLayoutEngine({
        model,
        measure: rects.measure,
        onAction:
            options.onAction ??
            ((action) => {
                actions.push(action);
                return action;
            }),
        onExternalDrag: options.onExternalDrag,
    });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    // tab strips and buttons, so strip drops can be hit-tested
    const strip0 = rects.set(
        dom.root.appendChild(document.createElement("div")),
        10,
        20,
        196,
        30,
    ) as HTMLElement;
    const strip1 = rects.set(
        dom.root.appendChild(document.createElement("div")),
        214,
        20,
        196,
        30,
    ) as HTMLElement;
    const tb0 = rects.set(
        dom.root.appendChild(document.createElement("div")),
        10,
        20,
        60,
        30,
    ) as HTMLElement;
    const tb1 = rects.set(
        dom.root.appendChild(document.createElement("div")),
        70,
        20,
        60,
        30,
    ) as HTMLElement;
    const tb2 = rects.set(
        dom.root.appendChild(document.createElement("div")),
        214,
        20,
        60,
        30,
    ) as HTMLElement;
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts0"),
        "tabstrip",
        strip0,
    );
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts1"),
        "tabstrip",
        strip1,
    );
    engine.registerMeasurable(node<TabNode>(model, "t0"), "tabbutton", tb0);
    engine.registerMeasurable(node<TabNode>(model, "t1"), "tabbutton", tb1);
    engine.registerMeasurable(node<TabNode>(model, "t2"), "tabbutton", tb2);
    engine.sync();
    return {
        model,
        rects,
        actions,
        engine,
        manager: engine.getDragDropManager(),
        ...dom,
        tb0,
        tb1,
        tb2,
    };
}

/** drags `dragNodeId` and drops it at viewport (x, y) */
function dragAndDrop(
    s: ReturnType<typeof setup>,
    dragNodeId: string,
    x: number,
    y: number,
) {
    s.manager.setDragNode(
        dragEvent("dragstart", 40, 35),
        node<TabNode>(s.model, dragNodeId),
    );
    s.root.dispatchEvent(dragEvent("dragenter", x, y));
    s.root.dispatchEvent(dragEvent("dragover", x, y));
    s.root.dispatchEvent(dragEvent("drop", x, y));
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("drag start", () => {
    it("records the drag state and marks the data transfer", () => {
        const s = setup();
        const dataTransfer = fakeDataTransfer();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35, dataTransfer),
            node<TabNode>(s.model, "t0"),
        );
        expect(DragDropManager.getDragState()?.dragNode?.getId()).toBe("t0");
        expect(dataTransfer.setData).toHaveBeenCalledWith(
            "text/plain",
            DRAG_MARKER,
        );
        expect(dataTransfer.effectAllowed).toBe("copyMove");
        expect(dataTransfer.dropEffect).toBe("move");
        expect(dataTransfer.setDragImage).not.toHaveBeenCalled(); // no image element: browser default
    });

    it("uses the adapter's element as the drag image, offset by the grab point for tabs", () => {
        const s = setup();
        const dataTransfer = fakeDataTransfer();
        const image = document.body.appendChild(document.createElement("div"));
        image.getBoundingClientRect = () =>
            ({
                left: 30,
                top: 25,
                x: 30,
                y: 25,
                width: 60,
                height: 30,
            }) as DOMRect;
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35, dataTransfer),
            node<TabNode>(s.model, "t0"),
            image,
        );
        expect(dataTransfer.setDragImage).toHaveBeenCalledWith(image, 10, 10);

        s.manager.onDragEnded();
        const tabsetTransfer = fakeDataTransfer();
        s.manager.setDragNode(
            dragEvent("dragstart", 99, 99, tabsetTransfer),
            node<TabSetNode>(s.model, "ts0"),
            image,
        );
        expect(tabsetTransfer.setDragImage).toHaveBeenCalledWith(image, 10, 10);
    });

    it("notifies drag subscribers on start and end", () => {
        const s = setup();
        const listener = vi.fn();
        const unsubscribe = DragDropManager.subscribeDrag(listener);
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.manager.onDragEnded();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(DragDropManager.getDragState()).toBeUndefined();
        unsubscribe();
    });
});

describe("drops", () => {
    it("drops into the centre of another tabset", () => {
        const s = setup();
        dragAndDrop(s, "t0", 312, 185); // centre of ts1's content
        expect(s.actions).toHaveLength(1);
        expect(s.actions[0]?.type).toBe(Actions.MOVE_NODE);
        expect(s.actions[0]?.data).toMatchObject({
            fromNode: "t0",
            toNode: "ts1",
            location: "center",
        });
        expect(
            node<TabSetNode>(s.model, "ts1")
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t2", "t0"]);
    });

    it("drops on each edge of a tabset", () => {
        for (const [x, y, location] of [
            [312, 60, "top"],
            [312, 310, "bottom"],
            [220, 185, "left"],
            [395, 185, "right"], // 15px from the root's right edge: the tabset, not the layout edge
        ] as const) {
            const s = setup();
            dragAndDrop(s, "t0", x, y);
            expect(s.actions[0]?.data, location).toMatchObject({
                toNode: "ts1",
                location,
            });
            for (const engine of engines.splice(0)) engine.dispose();
            document.body.innerHTML = "";
        }
    });

    it("drops at a position in the tab strip", () => {
        const s = setup();
        dragAndDrop(s, "t2", 72, 35); // just after the start of the second tab button of ts0
        expect(s.actions[0]?.data).toMatchObject({
            fromNode: "t2",
            toNode: "ts0",
            location: "center",
            index: 1,
        });
        expect(
            node<TabSetNode>(s.model, "ts0")
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t0", "t2", "t1"]);
    });

    it("drops at the layout edge, creating a new row or column", () => {
        const s = setup();
        dragAndDrop(s, "t2", 12, 170); // within 10px of the root's left edge, near its middle
        expect(s.actions[0]?.data).toMatchObject({
            fromNode: "t2",
            toNode: "row",
            location: "left",
        });
        const indicator = s.manager.getIndicatorState();
        expect(indicator.visible).toBe(false); // cleared after the drop
        const root = s.model.getRootRow() as RowNode;
        expect(
            root
                .getChildren()[0]
                ?.getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t2"]);
    });

    it("lets onAction veto the drop", () => {
        const s = setup({ onAction: () => undefined });
        dragAndDrop(s, "t0", 312, 185);
        expect(
            node<TabSetNode>(s.model, "ts1")
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t2"]);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("lets onAction replace the drop", () => {
        const s = setup({
            onAction: (action) =>
                action.type === Actions.MOVE_NODE
                    ? Actions.selectTab("t1")
                    : action,
        });
        dragAndDrop(s, "t0", 312, 185);
        expect(
            node<TabSetNode>(s.model, "ts0").getSelectedNode()?.getId(),
        ).toBe("t1");
        expect(node<TabSetNode>(s.model, "ts1").getChildren()).toHaveLength(1);
    });

    it("prevents the default dragover only over a drop target", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        const over = dragEvent("dragover", 312, 185);
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
    });
});

describe("excluded centre", () => {
    it("is excluded for a tabset that cannot be closed or holds pinned tabs", () => {
        const s = setup({
            json: {
                global: {},
                layout: {
                    type: "row",
                    id: "row",
                    children: [
                        {
                            type: "tabset",
                            id: "ts0",
                            enableClose: false,
                            children: [{ type: "tab", id: "t0", name: "A" }],
                        },
                        {
                            type: "tabset",
                            id: "ts1",
                            children: [
                                {
                                    type: "tab",
                                    id: "t1",
                                    name: "B",
                                    pinned: true,
                                },
                                { type: "tab", id: "t2", name: "C" },
                            ],
                        },
                    ],
                },
            },
        });
        s.manager.setDragNode(
            dragEvent("dragstart", 0, 0),
            node<TabSetNode>(s.model, "ts0"),
        );
        expect(s.manager.isExcludeCenter()).toBe(true);
        s.manager.onDragEnded();
        s.manager.setDragNode(
            dragEvent("dragstart", 0, 0),
            node<TabSetNode>(s.model, "ts1"),
        );
        expect(s.manager.isExcludeCenter()).toBe(true);
        s.manager.onDragEnded();
        s.manager.setDragNode(
            dragEvent("dragstart", 0, 0),
            node<TabNode>(s.model, "t2"),
        );
        expect(s.manager.isExcludeCenter()).toBe(false);
    });
});

describe("enter/leave counting and indicator state", () => {
    it("stays active across nested enter/leave pairs and clears on the last leave", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.ts1.dispatchEvent(dragEvent("dragenter", 312, 185)); // bubbles: entering a child
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185)); // leaving the root for the child
        expect(s.manager.getDragEnterCount()).toBe(1);
        expect(s.manager.getIndicatorState().dragging).toBe(true);

        s.ts1.dispatchEvent(dragEvent("dragleave", 312, 185));
        expect(s.manager.getDragEnterCount()).toBe(0);
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("goes enter 1x1 → over rect → leave hidden → drop cleared", () => {
        const s = setup();
        const listener = vi.fn();
        s.manager.subscribe(listener);
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );

        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        const entered = s.manager.getIndicatorState();
        expect(entered).toMatchObject({
            visible: false,
            dragging: true,
            dragNodeId: "t0",
            showEdges: true,
            tabDragSpeed: 0.3,
        });
        expect(entered.rect.toJson()).toEqual({
            x: 302,
            y: 165,
            width: 1,
            height: 1,
        });

        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        const over = s.manager.getIndicatorState();
        expect(over).toMatchObject({
            visible: true,
            location: "center",
            kind: "rect",
        });
        expect(over.rect.width).toBeGreaterThan(1);
        expect(s.manager.getIndicatorState()).toBe(over); // stable between changes

        s.root.dispatchEvent(dragEvent("dragleave", 312, 185));
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: false,
            dragging: false,
        });

        s.root.dispatchEvent(dragEvent("dragenter", 12, 170));
        s.root.dispatchEvent(dragEvent("dragover", 12, 170));
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: true,
            location: "left",
            kind: "edge",
        });
        s.root.dispatchEvent(dragEvent("drop", 12, 170));
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: false,
            dragging: false,
            dragNodeId: undefined,
        });
        expect(listener.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it("does not show edges while a tabset is maximized", () => {
        const s = setup();
        s.model.doAction(Actions.maximizeToggle("ts1"));
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t2"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(s.manager.getIndicatorState().showEdges).toBe(false);
    });

    it("disables pointer events on iframes during the drag", () => {
        const s = setup();
        const iframe = s.root.appendChild(document.createElement("iframe"));
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(iframe.style.pointerEvents).toBe("none");
        s.root.dispatchEvent(dragEvent("drop", 312, 185));
        expect(iframe.style.pointerEvents).toBe("auto");
    });
});

describe("layout arbitration", () => {
    it("updateActive picks the topmost layout the pointer is in", () => {
        const s = setup();
        s.model.doAction(Actions.popoutTab("t2", "window"));
        const windowId = [...s.model.getLayouts().keys()].find(
            (id) => id !== Model.MAIN_LAYOUT_ID,
        ) as string;
        const sub = createLayoutEngine({
            model: s.model,
            layoutId: windowId,
            mainEngine: s.engine,
            measure: s.rects.measure,
        });
        engines.push(sub);
        const subRoot = document.body.appendChild(
            document.createElement("div"),
        );
        sub.attachRoot(subRoot);

        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t1"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 100, 100));
        expect(s.manager.getIndicatorState().dragging).toBe(true);

        subRoot.dispatchEvent(dragEvent("dragenter", 100, 100));
        // the window layout is later in the (sorted) layouts: it wins
        expect(sub.getDragDropManager().getIndicatorState().dragging).toBe(
            true,
        );
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("ignores drags that belong to another layout instance", () => {
        const s = setup();
        const other = setup();
        other.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(other.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        s.root.dispatchEvent(dragEvent("drop", 312, 185));
        expect(s.actions).toHaveLength(0);
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });
});

describe("float branch", () => {
    const floatJson = {
        global: {},
        layout: {
            type: "row" as const,
            id: "row",
            children: [
                {
                    type: "tabset" as const,
                    id: "ts0",
                    children: [
                        { type: "tab" as const, id: "t0", name: "A" },
                        { type: "tab" as const, id: "t1", name: "B" },
                    ],
                },
                {
                    type: "tabset" as const,
                    id: "ts1",
                    children: [{ type: "tab" as const, id: "t2", name: "C" }],
                },
            ],
        },
        subLayouts: {
            float1: {
                type: "float" as const,
                layout: {
                    type: "row" as const,
                    children: [
                        {
                            type: "tabset" as const,
                            children: [
                                { type: "tab" as const, id: "f1", name: "F" },
                            ],
                        },
                    ],
                },
                rect: { x: 300, y: 150, width: 400, height: 300 },
            },
        },
    };

    it("docks a float layout to a tabset edge, never to the centre", () => {
        const s = setup({ json: floatJson });
        const float = s.model.getLayouts().get("float1");
        if (!float) throw new Error("no float");
        s.manager.startDockLayoutDrag(dragEvent("dragstart", 0, 0), float);
        expect(s.manager.isExcludeCenter()).toBe(true);

        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185)); // over the centre: never a centre drop
        expect(s.manager.getIndicatorState().location).not.toBe("center");

        s.root.dispatchEvent(dragEvent("dragover", 395, 185));
        s.root.dispatchEvent(dragEvent("drop", 395, 185));
        expect(s.actions[0]?.type).toBe(Actions.DOCK_FLOAT_TO_LAYOUT);
        expect(s.model.getLayouts().has("float1")).toBe(false);
    });

    it("rejects a drop over the float window the drag came from", () => {
        const s = setup({ json: floatJson });
        const float = s.model.getLayouts().get("float1");
        if (!float) throw new Error("no float");
        const floatElement = s.root.appendChild(document.createElement("div"));
        s.manager.startDockLayoutDrag(
            dragEvent("dragstart", 0, 0),
            float,
            floatElement,
        );
        s.root.dispatchEvent(dragEvent("dragenter", 395, 185));
        const over = dragEvent("dragover", 395, 185);
        floatElement.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        floatElement.dispatchEvent(dragEvent("drop", 395, 185));
        expect(s.actions).toHaveLength(0);
    });

    it("never offers the dragged float's own layout as a dock target", () => {
        const s = setup({ json: floatJson });
        const floatEngine = createLayoutEngine({
            model: s.model,
            layoutId: "float1",
            mainEngine: s.engine,
            measure: s.rects.measure,
        });
        engines.push(floatEngine);
        const floatRoot = document.body.appendChild(
            document.createElement("div"),
        );
        floatEngine.attachRoot(floatRoot);
        const float = s.model.getLayouts().get("float1");
        if (!float) throw new Error("no float");
        s.manager.startDockLayoutDrag(dragEvent("dragstart", 0, 0), float);

        floatRoot.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(
            floatEngine.getDragDropManager().getIndicatorState().dragging,
        ).toBe(false);
    });
});

describe("lost drag", () => {
    it("ends a drag whose dragend never reached the source", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(DragDropManager.getDragState()).toBeDefined();

        // a move with the button still held is part of the drag
        document.dispatchEvent(
            new PointerEvent("pointermove", { bubbles: true, buttons: 1 }),
        );
        expect(DragDropManager.getDragState()).toBeDefined();

        // the drag is over: the first pointer move with no button held ends the stale state
        document.dispatchEvent(
            new PointerEvent("pointermove", { bubbles: true, buttons: 0 }),
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("keeps the guard while the pointer is outside every layout", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185)); // out over a toolbar
        expect(DragDropManager.getDragState()).toBeDefined();
        document.dispatchEvent(
            new PointerEvent("pointermove", { bubbles: true, buttons: 0 }),
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("ends a drag on a new press", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        document.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, buttons: 1 }),
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("ends a drag on a dragend seen anywhere in the document", () => {
        const s = setup();
        s.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabNode>(s.model, "t0"),
        );
        s.panels.t1.dispatchEvent(dragEvent("dragend", 0, 0));
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("add drags (a consumer element dragged in)", () => {
    const json = { type: "tab", name: "Revenue", component: "chart" } as const;

    function addDragAndDrop(
        s: ReturnType<typeof setup>,
        x: number,
        y: number,
        onDrop?: Parameters<DragDropManager["addTabWithDragAndDrop"]>[2],
    ) {
        const start = dragEvent("dragstart", 0, 0);
        s.manager.addTabWithDragAndDrop(start, { ...json }, onDrop);
        s.root.dispatchEvent(dragEvent("dragenter", x, y));
        const over = dragEvent("dragover", x, y);
        s.root.dispatchEvent(over);
        s.root.dispatchEvent(dragEvent("drop", x, y));
        return { start, over };
    }

    it("records an add drag without adding anything to the model", () => {
        const s = setup();
        const start = dragEvent("dragstart", 0, 0);
        s.manager.addTabWithDragAndDrop(start, { ...json });
        const state = DragDropManager.getDragState();
        expect(state?.dragSource).toBe("add");
        expect(state?.isNewTab()).toBe(true);
        expect(state?.dragNode?.getModel()).toBe(s.model);
        expect(start.dataTransfer?.setData).toHaveBeenCalledWith(
            "text/plain",
            DRAG_MARKER,
        );
        expect(start.dataTransfer?.effectAllowed).toBe("copy");
        expect(
            s.model.getNodeById(state?.dragNode?.getId() ?? ""),
        ).toBeUndefined();
    });

    it("adds a tab in the centre of a tabset through Actions.addTab, and reports it", () => {
        const s = setup();
        const onDrop = vi.fn();
        const { over } = addDragAndDrop(s, 312, 185, onDrop);
        expect(over.defaultPrevented).toBe(true);
        expect(over.dataTransfer?.dropEffect).toBe("copy");
        expect(s.actions.map((a) => a.type)).toEqual([Actions.ADD_TAB]);
        expect(s.actions[0]?.data).toMatchObject({
            toNode: "ts1",
            location: "center",
        });
        const children = node<TabSetNode>(s.model, "ts1").getChildren();
        expect(children).toHaveLength(2);
        const added = children[1] as TabNode;
        expect(added.getName()).toBe("Revenue");
        expect(onDrop).toHaveBeenCalledWith(added, expect.anything());
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("adds a tab on a tabset edge and at the layout edge", () => {
        const s = setup();
        addDragAndDrop(s, 220, 185); // left edge of ts1
        expect(s.actions[0]?.data).toMatchObject({
            toNode: "ts1",
            location: "left",
        });
        const layoutEdge = setup();
        addDragAndDrop(layoutEdge, 12, 170); // within 10px of the root's left edge
        expect(layoutEdge.actions[0]?.type).toBe(Actions.ADD_TAB);
        expect(layoutEdge.actions[0]?.data).toMatchObject({
            toNode: "row",
            location: "left",
        });
    });

    it("reports undefined when onAction vetoes the add", () => {
        const s = setup({ onAction: () => undefined });
        const onDrop = vi.fn();
        addDragAndDrop(s, 312, 185, onDrop);
        expect(onDrop).toHaveBeenCalledWith(undefined, expect.anything());
        expect(node<TabSetNode>(s.model, "ts1").getChildren()).toHaveLength(1);
    });

    it("honours the model's onAllowDrop", () => {
        const s = setup();
        s.model.setOnAllowDrop(
            (_dragNode, dropInfo) => dropInfo.node.getId() !== "ts1",
        );
        const onDrop = vi.fn();
        const { over } = addDragAndDrop(s, 312, 185, onDrop);
        expect(over.defaultPrevented).toBe(false);
        expect(onDrop).not.toHaveBeenCalled();
        expect(s.actions).toHaveLength(0);
    });

    it("leaves the model untouched when the drag is cancelled", () => {
        const s = setup();
        s.manager.addTabWithDragAndDrop(dragEvent("dragstart", 0, 0), {
            ...json,
        });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185));
        s.manager.onDragEnded(); // the source's dragend
        expect(s.actions).toHaveLength(0);
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });
});

describe("external drags (onExternalDrag)", () => {
    it("ignores foreign drags without a handler, or when the handler declines", () => {
        const none = setup();
        none.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(DragDropManager.getDragState()).toBeUndefined();
        none.root.dispatchEvent(dragEvent("dragleave", 312, 185));

        const declined = vi.fn(() => undefined);
        const s = setup({ onExternalDrag: declined });
        const over = dragEvent("dragover", 312, 185);
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(over);
        expect(declined).toHaveBeenCalledTimes(1);
        expect(over.defaultPrevented).toBe(false);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("turns an accepted foreign drag into a new tab on drop", () => {
        const onDrop = vi.fn();
        const s = setup({
            onExternalDrag: () => ({
                json: { type: "tab", name: "report.csv", component: "file" },
                onDrop,
            }),
        });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(DragDropManager.getDragState()?.dragSource).toBe("external");
        const over = dragEvent("dragover", 312, 185);
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
        expect(s.manager.getIndicatorState().visible).toBe(true);
        const drop = dragEvent("drop", 312, 185);
        s.root.dispatchEvent(drop);
        const added = node<TabSetNode>(
            s.model,
            "ts1",
        ).getChildren()[1] as TabNode;
        expect(added.getName()).toBe("report.csv");
        expect(onDrop).toHaveBeenCalledWith(added, drop);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("ends an external drag that leaves the layout without dropping", () => {
        const s = setup({
            onExternalDrag: () => ({ json: { type: "tab", name: "x" } }),
        });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185));
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.actions).toHaveLength(0);
        // the next foreign drag asks again
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(DragDropManager.getDragState()?.dragSource).toBe("external");
    });

    it("does not treat a layout's own drag as external", () => {
        const onExternalDrag = vi.fn(() => ({
            json: { type: "tab" as const },
        }));
        const s = setup({ onExternalDrag });
        dragAndDrop(s, "t0", 312, 185);
        expect(onExternalDrag).not.toHaveBeenCalled();
        expect(s.actions[0]?.type).toBe(Actions.MOVE_NODE);
    });
});
