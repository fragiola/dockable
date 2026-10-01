// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createLayoutEngine,
    DRAG_TYPE,
    DragDropManager,
    type DropZoneOptions,
    type LayoutEngine,
    type LayoutJson,
    type Middleware,
    type NewTabDropped,
    type OnExternalDrag,
    veto,
} from "../../src";
import {
    dragEvent,
    fakeDataTransfer,
    freshModel,
    mountTwoTabsets,
    Rects,
    recordCommands,
} from "../engine/fixture";

const engines: LayoutEngine[] = [];

afterEach(() => {
    DragDropManager.getDragState() &&
        engines[0]?.adapter.getDragDropManager().onDragEnded();
    for (const engine of engines.splice(0)) {
        engine.adapter.dispose();
    }
    document.body.innerHTML = "";
});

beforeEach(() => {
    vi.restoreAllMocks();
});

/** a drag that is not Dockable's (files, another library) */
const foreign = () => fakeDataTransfer(["Files"]);

function setup(
    options: {
        json?: LayoutJson;
        onExternalDrag?: OnExternalDrag;
        middleware?: Middleware;
    } = {},
) {
    const model = freshModel(options.json);
    if (options.middleware) {
        model.use(options.middleware);
    }
    const commands = recordCommands(model);
    const rects = new Rects();
    const engine = createLayoutEngine({
        model,
        measure: rects.measure,
        onExternalDrag: options.onExternalDrag,
    });
    engines.push(engine);
    const dom = mountTwoTabsets(engine, rects);
    // tab buttons, so strip drops can be hit-tested
    const button = (x: number, y: number) =>
        rects.set(
            dom.root.appendChild(document.createElement("div")),
            x,
            y,
            60,
            30,
        );
    const tb0 = button(10, 20);
    const tb1 = button(70, 20);
    const tb2 = button(214, 20);
    engine.adapter.registerMeasurable("t0", "tabbutton", tb0);
    engine.adapter.registerMeasurable("t1", "tabbutton", tb1);
    engine.adapter.registerMeasurable("t2", "tabbutton", tb2);
    engine.run("measure-and-position");
    return {
        model,
        rects,
        commands,
        onExternalDrag: options.onExternalDrag,
        engine,
        manager: engine.adapter.getDragDropManager(),
        ...dom,
        tb0,
        tb1,
        tb2,
    };
}

type Setup = ReturnType<typeof setup>;

function children(s: Setup, tabset: string): string[] {
    const node = s.model.get("node-by", { id: tabset });
    return node?.type === "tabset" ? node.children.map((c) => c.id) : [];
}

/** drags `id` and drops it at viewport (x, y) */
function dragAndDrop(s: Setup, id: string, x: number, y: number) {
    s.manager.startDrag(dragEvent("dragstart", 40, 35), id);
    s.root.dispatchEvent(dragEvent("dragenter", x, y));
    s.root.dispatchEvent(dragEvent("dragover", x, y));
    s.root.dispatchEvent(dragEvent("drop", x, y));
}

/** starts dragging `id` and moves over (x, y) without dropping; returns the dragover event */
function dragOverAt(s: Setup, id: string, x: number, y: number) {
    s.manager.startDrag(dragEvent("dragstart", 40, 35), id);
    s.root.dispatchEvent(dragEvent("dragenter", x, y));
    const over = dragEvent("dragover", x, y);
    s.root.dispatchEvent(over);
    return over;
}

describe("drag start", () => {
    it("records the drag state and marks the data transfer with Dockable's type", () => {
        const s = setup();
        const dataTransfer = fakeDataTransfer([]);
        s.manager.startDrag(dragEvent("dragstart", 40, 35, dataTransfer), "t0");
        const state = DragDropManager.getDragState();
        expect(state?.subject).toMatchObject({
            kind: "tab",
            tab: { id: "t0" },
        });
        expect(state?.dragId).toBe("t0");
        expect(dataTransfer.setData).toHaveBeenCalledWith(DRAG_TYPE, "t0");
        expect(dataTransfer.types).toContain(DRAG_TYPE);
        expect(dataTransfer.effectAllowed).toBe("copyMove");
        expect(dataTransfer.dropEffect).toBe("move");
        expect(dataTransfer.setDragImage).not.toHaveBeenCalled(); // no image element: browser default
    });

    it("uses the adapter's element as the drag image, offset by the grab point for tabs", () => {
        const s = setup();
        const dataTransfer = fakeDataTransfer();
        const image = s.rects.set(
            document.body.appendChild(document.createElement("div")),
            30,
            25,
            60,
            30,
        );
        s.manager.startDrag(
            dragEvent("dragstart", 40, 35, dataTransfer),
            "t0",
            image,
        );
        expect(dataTransfer.setDragImage).toHaveBeenCalledWith(image, 10, 10);
        s.manager.onDragEnded();

        const tabsetTransfer = fakeDataTransfer();
        s.manager.startDrag(
            dragEvent("dragstart", 99, 99, tabsetTransfer),
            "ts0",
            image,
        );
        expect(tabsetTransfer.setDragImage).toHaveBeenCalledWith(image, 10, 10);
        expect(DragDropManager.getDragState()?.subject.kind).toBe("tabset");
    });

    it("notifies drag subscribers on start and end", () => {
        const s = setup();
        const listener = vi.fn();
        const unsubscribe = DragDropManager.subscribeDrag(listener);
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.manager.onDragEnded();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(DragDropManager.getDragState()).toBeUndefined();
        unsubscribe();
    });
});

describe("drops", () => {
    it("drops into the centre of another tabset with tab.move", () => {
        const s = setup();
        dragAndDrop(s, "t0", 312, 185); // centre of ts1's content
        expect(s.commands).toEqual([
            {
                command: "tab.move",
                payload: {
                    tabId: "t0",
                    to: "ts1",
                    location: "center",
                    index: -1,
                },
            },
        ]);
        expect(children(s, "ts1")).toEqual(["t2", "t0"]);
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
            expect(s.commands[0]?.payload, location).toMatchObject({
                to: "ts1",
                location,
            });
            for (const engine of engines.splice(0)) engine.adapter.dispose();
            document.body.innerHTML = "";
        }
    });

    it("drops at a position in the tab strip", () => {
        const s = setup();
        dragAndDrop(s, "t2", 72, 35); // just after the start of the second tab button of ts0
        expect(s.commands[0]?.payload).toEqual({
            tabId: "t2",
            to: "ts0",
            location: "center",
            index: 1,
        });
        expect(children(s, "ts0")).toEqual(["t0", "t2", "t1"]);
    });

    it("drops at the layout edge, creating a new row or column", () => {
        const s = setup();
        dragAndDrop(s, "t2", 12, 170); // within 10px of the root's left edge, near its middle
        expect(s.commands[0]?.payload).toMatchObject({
            tabId: "t2",
            to: "row",
            location: "left",
        });
        expect(s.manager.getIndicatorState().visible).toBe(false); // cleared after the drop
        const first = s.model.state.root.children[0];
        expect(
            first?.type === "tabset" && first.children.map((c) => c.id),
        ).toEqual(["t2"]);
    });

    it("moves a whole tabset with tabset.move", () => {
        const s = setup();
        dragAndDrop(s, "ts0", 395, 185);
        expect(s.commands[0]).toEqual({
            command: "tabset.move",
            payload: {
                tabsetId: "ts0",
                to: "ts1",
                location: "right",
                index: -1,
            },
        });
    });

    it("lets a middleware rewrite the drop", () => {
        const s = setup({
            middleware: (ctx, next) => {
                if (ctx.command === "tab.move" && !ctx.dryRun) {
                    ctx.payload = {
                        ...(ctx.payload as object),
                        index: 0,
                    } as typeof ctx.payload;
                }
                return next();
            },
        });
        dragAndDrop(s, "t0", 312, 185);
        expect(children(s, "ts1")).toEqual(["t0", "t2"]);
    });

    it("prevents the default dragover only over a drop target", () => {
        const s = setup();
        const over = dragOverAt(s, "t0", 312, 185);
        expect(over.defaultPrevented).toBe(true);
    });

    it("treats a tabset dropped on its own strip as accepted, and changes nothing", () => {
        const s = setup();
        dragAndDrop(s, "ts1", 300, 35);
        expect(s.commands).toEqual([]);
        expect(children(s, "ts1")).toEqual(["t2"]);
    });
});

describe("excluded centre", () => {
    it("offers no centre drop for a tabset that cannot close or holds pinned tabs", () => {
        const json: LayoutJson = {
            version: 1,
            root: {
                type: "row",
                id: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        enableClose: false,
                        children: [{ id: "t0", component: "x" }],
                    },
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            { id: "t1", component: "x", pinned: true },
                            { id: "t2", component: "x" },
                        ],
                    },
                ],
            },
        };
        const s = setup({ json });
        dragOverAt(s, "ts0", 312, 185); // the centre of ts1's content
        expect(s.manager.getIndicatorState().location).not.toBe("center");
        s.manager.onDragEnded();
        dragOverAt(s, "ts1", 100, 185);
        expect(s.manager.getIndicatorState().location).not.toBe("center");
        s.manager.onDragEnded();
        dragOverAt(s, "t2", 100, 185);
        expect(s.manager.getIndicatorState().location).toBe("center");
    });
});

describe("enter/leave counting and indicator state", () => {
    it("stays active across nested enter/leave pairs and clears on the last leave", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
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
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");

        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        const entered = s.manager.getIndicatorState();
        expect(entered).toMatchObject({
            visible: false,
            dragging: true,
            dragNodeId: "t0",
            showEdges: true,
            tabDragSpeed: 0.3,
        });
        expect(entered.rect).toEqual({ x: 302, y: 165, width: 1, height: 1 });

        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        const over = s.manager.getIndicatorState();
        expect(over).toMatchObject({
            visible: true,
            location: "center",
            kind: "rect",
        });
        expect(over.rect.width).toBeGreaterThan(1);
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
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
        s.model.run("tabset.maximize", { tabsetId: "ts1", value: true });
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t2");
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(s.manager.getIndicatorState().showEdges).toBe(false);
    });

    it("disables pointer events on iframes during the drag", () => {
        const s = setup();
        const iframe = s.root.appendChild(document.createElement("iframe"));
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(iframe.style.pointerEvents).toBe("none");
        s.root.dispatchEvent(dragEvent("drop", 312, 185));
        expect(iframe.style.pointerEvents).toBe("auto");
    });
});

/** opens a popout window for `tab` with an injected opener; returns its engine and root */
function openPopout(s: Setup, tab: string) {
    s.model.run("layout.configure", {
        defaults: { tab: { enablePopout: true } },
    });
    const frame = document.body.appendChild(document.createElement("iframe"));
    const win = frame.contentWindow;
    if (!win) throw new Error("no window");
    const openWindow = vi.fn(() => win);
    // setOptions takes every option an adapter passes, so the external drag handler goes along
    s.engine.adapter.setOptions({
        popout: { supportsPopout: true, openWindow },
        onExternalDrag: s.onExternalDrag,
    });
    const result = s.model.run("tab.popout", { tabId: tab });
    const windowId = result.ok ? result.value.windowId : "";
    const sub = s.engine.adapter.getPopoutManager().getLayoutEngine(windowId);
    if (!sub) throw new Error("no popout engine");
    const subRoot = win.document.body.appendChild(
        win.document.createElement("div"),
    );
    sub.adapter.attachRoot(subRoot);
    return { sub, subRoot, windowId, openWindow };
}

describe("layout arbitration", () => {
    it("the layout the pointer enters is the active one", () => {
        const s = setup();
        const { sub, subRoot } = openPopout(s, "t2");
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t1");
        s.root.dispatchEvent(dragEvent("dragenter", 100, 100));
        expect(s.manager.getIndicatorState().dragging).toBe(true);
        s.root.dispatchEvent(dragEvent("dragleave", 100, 100));
        subRoot.dispatchEvent(dragEvent("dragenter", 100, 100));
        expect(
            sub.adapter.getDragDropManager().getIndicatorState().dragging,
        ).toBe(true);
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("ignores drags that belong to another layout's model", () => {
        const s = setup();
        const other = setup();
        other.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        s.root.dispatchEvent(dragEvent("drop", 312, 185));
        expect(s.commands).toHaveLength(0);
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });
});

describe("foreign drags and resets", () => {
    it("ignores a drag that does not carry Dockable's type", () => {
        const s = setup();
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        const over = dragEvent("dragover", 312, 185, foreign());
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("takes events that carry no types at all as the page's drag (synthetic events)", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        const untyped = () => fakeDataTransfer([]);
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, untyped()));
        const over = dragEvent("dragover", 312, 185, untyped());
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
        s.root.dispatchEvent(dragEvent("drop", 312, 185, untyped()));
        expect(children(s, "ts1")).toEqual(["t2", "t0"]);
    });

    it("drops a stale drag state when a foreign drag arrives, instead of taking it over", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        // the dragend never came (the source unmounted); another library's drag enters
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("drop", 312, 185, foreign()));
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.commands).toHaveLength(0);
    });

    it("resets after a drop that was not a tab (text dropped into an input of a tab)", () => {
        const s = setup();
        const input = s.panels.t0.appendChild(document.createElement("input"));
        s.root.dispatchEvent(dragEvent("dragenter", 100, 100, foreign()));
        input.dispatchEvent(dragEvent("drop", 100, 100, foreign()));
        expect(s.manager.getDragEnterCount()).toBe(0);
        // the next tab drag works as usual
        dragAndDrop(s, "t0", 312, 185);
        expect(children(s, "ts1")).toEqual(["t2", "t0"]);
    });

    it("ends the page's drag on a drop anywhere in the document", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        const outside = document.body.appendChild(
            document.createElement("div"),
        );
        outside.dispatchEvent(dragEvent("drop", 0, 0));
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("lost drag", () => {
    it("ends a drag whose dragend never reached the source", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        expect(DragDropManager.getDragState()).toBeDefined();
        // a move with the button still held is part of the drag
        document.dispatchEvent(
            new PointerEvent("pointermove", { bubbles: true, buttons: 1 }),
        );
        expect(DragDropManager.getDragState()).toBeDefined();
        // the first pointer move with no button held ends the stale state
        document.dispatchEvent(
            new PointerEvent("pointermove", { bubbles: true, buttons: 0 }),
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });

    it("keeps the guard while the pointer is outside every layout", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
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
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        document.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, buttons: 1 }),
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("ends a drag on a dragend seen anywhere in the document", () => {
        const s = setup();
        s.manager.startDrag(dragEvent("dragstart", 40, 35), "t0");
        s.panels.t1.dispatchEvent(dragEvent("dragend", 0, 0));
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("add drags (a consumer element dragged in)", () => {
    const tab = { component: "chart", data: { name: "Revenue" } };

    function addDragAndDrop(
        s: Setup,
        x: number,
        y: number,
        onDrop?: NewTabDropped,
    ) {
        const start = dragEvent("dragstart", 0, 0, fakeDataTransfer([]));
        s.manager.startAddDrag(start, { ...tab }, onDrop);
        s.root.dispatchEvent(dragEvent("dragenter", x, y));
        const over = dragEvent("dragover", x, y);
        s.root.dispatchEvent(over);
        const drop = dragEvent("drop", x, y);
        s.root.dispatchEvent(drop);
        return { start, over, drop };
    }

    it("records an add drag without adding anything to the model", () => {
        const s = setup();
        const start = dragEvent("dragstart", 0, 0, fakeDataTransfer([]));
        const before = s.model.state;
        s.manager.startAddDrag(start, { ...tab });
        const state = DragDropManager.getDragState();
        expect(state?.source).toBe("add");
        expect(state?.isNewTab()).toBe(true);
        expect(state?.subject).toEqual({ kind: "new", tab });
        expect(start.dataTransfer?.types).toContain(DRAG_TYPE);
        expect(start.dataTransfer?.effectAllowed).toBe("copy");
        expect(s.model.state).toBe(before);
    });

    it("starts from the model alone, through its attached main layout (a source outside the layout)", () => {
        const s = setup();
        const start = dragEvent("dragstart", 0, 0, fakeDataTransfer([]));
        expect(DragDropManager.startAddDrag(s.model, start, { ...tab })).toBe(
            true,
        );
        expect(DragDropManager.getDragState()?.mainEngine).toBe(s.engine);
        DragDropManager.endDrag();
        expect(DragDropManager.getDragState()).toBeUndefined();

        // a model whose layout is not attached (not mounted yet): nothing starts
        const detached = freshModel();
        expect(
            DragDropManager.startAddDrag(
                detached,
                dragEvent("dragstart", 0, 0, fakeDataTransfer([])),
                { ...tab },
            ),
        ).toBe(false);
        s.engine.adapter.detachRoot();
        expect(
            DragDropManager.startAddDrag(
                s.model,
                dragEvent("dragstart", 0, 0, fakeDataTransfer([])),
                { ...tab },
            ),
        ).toBe(false);
    });

    it("adds a tab in the centre of a tabset with tab.add, and reports its id", () => {
        const s = setup();
        const onDrop = vi.fn();
        const { over, drop } = addDragAndDrop(s, 312, 185, onDrop);
        expect(over.defaultPrevented).toBe(true);
        expect(over.dataTransfer?.dropEffect).toBe("copy");
        expect(s.commands.map((c) => c.command)).toEqual(["tab.add"]);
        expect(s.commands[0]?.payload).toMatchObject({
            ...tab,
            to: "ts1",
            location: "center",
        });
        const added = children(s, "ts1")[1];
        expect(s.model.get("node-by", { id: added ?? "" })).toMatchObject({
            component: "chart",
            data: { name: "Revenue" },
        });
        expect(onDrop).toHaveBeenCalledWith(added, drop);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("adds a tab on a tabset edge and at the layout edge", () => {
        const s = setup();
        addDragAndDrop(s, 220, 185); // left edge of ts1
        expect(s.commands[0]?.payload).toMatchObject({
            to: "ts1",
            location: "left",
        });
        const layoutEdge = setup();
        addDragAndDrop(layoutEdge, 12, 170); // within 10px of the root's left edge
        expect(layoutEdge.commands[0]).toMatchObject({
            command: "tab.add",
            payload: { to: "row", location: "left" },
        });
    });

    it("reports undefined when the add is refused at the drop", () => {
        const s = setup({
            // a middleware that lets the hover through and refuses the commit
            middleware: (ctx, next) =>
                ctx.command === "tab.add" && !ctx.dryRun ? veto() : next(),
        });
        const onDrop = vi.fn();
        addDragAndDrop(s, 312, 185, onDrop);
        expect(onDrop).toHaveBeenCalledWith(undefined, expect.anything());
        expect(children(s, "ts1")).toHaveLength(1);
    });

    it("refuses the target during the hover when a middleware vetoes the add", () => {
        const s = setup({
            middleware: (ctx, next) =>
                ctx.command === "tab.add" ? veto() : next(),
        });
        const onDrop = vi.fn();
        const { over } = addDragAndDrop(s, 312, 185, onDrop);
        expect(over.defaultPrevented).toBe(false);
        expect(onDrop).not.toHaveBeenCalled();
    });

    it("leaves the model untouched when the drag is cancelled", () => {
        const s = setup();
        s.manager.startAddDrag(dragEvent("dragstart", 0, 0), { ...tab });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185));
        s.manager.onDragEnded(); // the source's dragend
        expect(s.commands).toHaveLength(0);
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.manager.getIndicatorState().dragging).toBe(false);
    });
});

describe("external drags (onExternalDrag)", () => {
    it("ignores foreign drags without a handler, or when the handler declines", () => {
        const none = setup();
        none.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        expect(DragDropManager.getDragState()).toBeUndefined();
        none.root.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));

        const declined = vi.fn(() => undefined);
        const s = setup({ onExternalDrag: declined });
        const over = dragEvent("dragover", 312, 185, foreign());
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        s.root.dispatchEvent(over);
        expect(declined).toHaveBeenCalledTimes(1);
        expect(over.defaultPrevented).toBe(false);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("turns an accepted foreign drag into a new tab on drop", () => {
        const onDrop = vi.fn();
        const s = setup({
            onExternalDrag: () => ({
                tab: { component: "file", data: { name: "report.csv" } },
                onDrop,
            }),
        });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        expect(DragDropManager.getDragState()?.source).toBe("external");
        const over = dragEvent("dragover", 312, 185, foreign());
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
        expect(s.manager.getIndicatorState().visible).toBe(true);
        const drop = dragEvent("drop", 312, 185, foreign());
        s.root.dispatchEvent(drop);
        const added = children(s, "ts1")[1];
        expect(s.model.get("node-by", { id: added ?? "" })).toMatchObject({
            data: { name: "report.csv" },
        });
        expect(onDrop).toHaveBeenCalledWith(added, drop);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("ends an external drag that leaves the layout without dropping", () => {
        const s = setup({
            onExternalDrag: () => ({ tab: { component: "x" } }),
        });
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(s.commands).toHaveLength(0);
        // the next foreign drag asks again
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        expect(DragDropManager.getDragState()?.source).toBe("external");
    });

    it("lets a popout window's layout accept external drags through the main engine's handler", () => {
        const onExternalDrag = vi.fn(() => ({
            tab: { component: "x", data: { name: "dropped" } },
        }));
        const s = setup({ onExternalDrag });
        const { subRoot } = openPopout(s, "t2");
        subRoot.dispatchEvent(dragEvent("dragenter", 10, 10, foreign()));
        expect(onExternalDrag).toHaveBeenCalledTimes(1);
        expect(DragDropManager.getDragState()?.source).toBe("external");
        expect(DragDropManager.getDragState()?.mainEngine).toBe(s.engine);
        // and it ends when it leaves through the popout
        subRoot.dispatchEvent(dragEvent("dragleave", 10, 10, foreign()));
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("asks once per entry into the layout, not for every child the pointer crosses", () => {
        const onExternalDrag = vi.fn(() => undefined);
        const s = setup({ onExternalDrag });
        const child = s.root.appendChild(document.createElement("div"));
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        child.dispatchEvent(dragEvent("dragenter", 312, 185, foreign())); // bubbles to the root
        child.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));
        expect(onExternalDrag).toHaveBeenCalledTimes(1);
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        expect(onExternalDrag).toHaveBeenCalledTimes(2);
    });

    it("does not treat a layout's own drag as external", () => {
        const onExternalDrag = vi.fn(() => ({ tab: { component: "x" } }));
        const s = setup({ onExternalDrag });
        dragAndDrop(s, "t0", 312, 185);
        expect(onExternalDrag).not.toHaveBeenCalled();
        expect(s.commands[0]?.command).toBe("tab.move");
    });
});

describe("drop target state", () => {
    it("names the targeted tabset and the content drop", () => {
        const s = setup();
        dragOverAt(s, "t0", 312, 185);
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: true,
            targetNodeId: "ts1",
            targetTabSetId: "ts1",
            index: -1,
            refused: false,
        });
    });

    it("gives the insertion index of a strip drop", () => {
        const s = setup();
        dragOverAt(s, "t2", 72, 35);
        expect(s.manager.getIndicatorState()).toMatchObject({
            targetTabSetId: "ts0",
            location: "center",
            index: 1,
        });
    });

    it("names the row, and no tabset, for a layout edge drop", () => {
        const s = setup();
        dragOverAt(s, "t2", 12, 170);
        expect(s.manager.getIndicatorState()).toMatchObject({
            kind: "edge",
            targetNodeId: "row",
            targetTabSetId: undefined,
        });
    });

    it("moves with the pointer and clears when the drag ends", () => {
        const s = setup();
        dragOverAt(s, "t0", 312, 185);
        expect(s.manager.getIndicatorState().targetTabSetId).toBe("ts1");
        s.root.dispatchEvent(dragEvent("dragover", 100, 185));
        expect(s.manager.getIndicatorState().targetTabSetId).toBe("ts0");
        s.manager.onDragEnded();
        expect(s.manager.getIndicatorState()).toMatchObject({
            targetTabSetId: undefined,
            targetNodeId: undefined,
            refused: false,
        });
    });
});

describe("refused drops", () => {
    const refuseTs1: Middleware = (ctx, next) =>
        ctx.command === "tab.move" &&
        (ctx.payload as { to?: string }).to === "ts1"
            ? veto("ts1 is locked")
            : next();

    it("a middleware veto refuses the drop during the hover: the outline hides and the tabset is reported", () => {
        const s = setup({ middleware: refuseTs1 });
        dragOverAt(s, "t0", 100, 185);
        expect(s.manager.getIndicatorState().visible).toBe(true);
        const over = dragEvent("dragover", 312, 185);
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        expect(over.dataTransfer?.dropEffect).toBe("none");
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: false,
            refused: true,
            refusedTabSetId: "ts1",
            targetTabSetId: undefined,
        });
        s.root.dispatchEvent(dragEvent("dragover", 100, 185));
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: true,
            refused: false,
            refusedTabSetId: undefined,
        });
    });

    it("asks again once the layout changes during the drag", () => {
        let locked = true;
        const s = setup({
            middleware: (ctx, next) =>
                locked && ctx.command === "tab.move" ? veto() : next(),
        });
        expect(dragOverAt(s, "t1", 312, 185).defaultPrevented).toBe(false);
        // the app unlocks mid-drag and changes the layout: the next dragover asks again
        locked = false;
        s.model.run("tab.select", { tabId: "t0" });
        const over = dragEvent("dragover", 312, 185);
        s.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
    });

    it("drops nothing on a refused target", () => {
        const s = setup({ middleware: refuseTs1 });
        dragOverAt(s, "t0", 312, 185);
        s.root.dispatchEvent(dragEvent("drop", 312, 185));
        expect(s.commands).toHaveLength(0);
        expect(children(s, "ts1")).toEqual(["t2"]);
    });

    it("reports tabsets that refuse through their fields", () => {
        const json: LayoutJson = {
            version: 1,
            root: {
                type: "row",
                id: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            { id: "t0", component: "x" },
                            { id: "t1", component: "x" },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "ts1",
                        enableDrop: false,
                        enableDivide: false,
                        children: [{ id: "t2", component: "x" }],
                    },
                ],
            },
        };
        const s = setup({ json });
        dragOverAt(s, "t0", 312, 185);
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: false,
            refused: true,
            refusedTabSetId: "ts1",
        });
    });

    it("is not refused where there is simply no target", () => {
        const s = setup();
        dragOverAt(s, "t0", 312, 185);
        s.root.dispatchEvent(dragEvent("dragover", 312, 900)); // below the layout
        expect(s.manager.getIndicatorState().refused).toBe(false);
    });

    it("falls back to the next target a refused edge band covers", () => {
        const s = setup({
            middleware: (ctx, next) =>
                ctx.command === "tab.move" &&
                (ctx.payload as { to?: string }).to === "row"
                    ? veto()
                    : next(),
        });
        dragOverAt(s, "t2", 12, 170); // the left edge band, over ts0's left edge
        expect(s.manager.getIndicatorState()).toMatchObject({
            visible: true,
            targetNodeId: "ts0",
            location: "left",
        });
    });
});

describe("drop zones", () => {
    function zone(s: Setup, options: Partial<DropZoneOptions> = {}) {
        const element = document.body.appendChild(
            document.createElement("div"),
        );
        const onDrop = vi.fn();
        const onOverChange = vi.fn();
        const unregister = s.engine.adapter.registerDropZone(element, {
            onDrop,
            onOverChange,
            ...options,
        });
        return { element, onDrop, onOverChange, unregister };
    }

    it("takes a layout drag: hides the outline, and hands the drag to onDrop without moving anything", () => {
        const s = setup();
        const z = zone(s);
        dragOverAt(s, "t0", 312, 185);
        expect(s.manager.getIndicatorState().visible).toBe(true);
        z.element.dispatchEvent(dragEvent("dragenter", 0, 0));
        const over = dragEvent("dragover", 0, 0);
        z.element.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
        expect(z.onOverChange).toHaveBeenLastCalledWith(true);
        expect(s.manager.getIndicatorState().visible).toBe(false);
        const drop = dragEvent("drop", 0, 0);
        z.element.dispatchEvent(drop);
        expect(z.onDrop).toHaveBeenCalledWith(
            { kind: "tab", tab: s.model.get("node-by", { id: "t0" }) },
            drop,
        );
        expect(z.onOverChange).toHaveBeenLastCalledWith(false);
        expect(s.commands).toHaveLength(0);
        expect(DragDropManager.getDragState()).toBeUndefined();
        z.unregister();
    });

    it("tracks enter and leave across its children", () => {
        const s = setup();
        const z = zone(s);
        const child = z.element.appendChild(document.createElement("span"));
        dragOverAt(s, "t0", 312, 185);
        z.element.dispatchEvent(dragEvent("dragenter", 0, 0));
        child.dispatchEvent(dragEvent("dragenter", 0, 0));
        z.element.dispatchEvent(dragEvent("dragleave", 0, 0));
        expect(z.onOverChange).toHaveBeenLastCalledWith(true);
        child.dispatchEvent(dragEvent("dragleave", 0, 0));
        expect(z.onOverChange).toHaveBeenLastCalledWith(false);
        z.unregister();
    });

    it("ignores drags it does not accept, drags of another model, and no drag at all", () => {
        const s = setup();
        const z = zone(s, {
            accepts: (drag) => drag.kind !== "tab" || drag.tab.id !== "t0",
        });
        const idle = dragEvent("dragover", 0, 0);
        z.element.dispatchEvent(idle);
        expect(idle.defaultPrevented).toBe(false);

        dragOverAt(s, "t0", 312, 185);
        const refused = dragEvent("dragover", 0, 0);
        z.element.dispatchEvent(refused);
        z.element.dispatchEvent(dragEvent("drop", 0, 0));
        expect(refused.defaultPrevented).toBe(false);
        expect(z.onDrop).not.toHaveBeenCalled();
        s.manager.onDragEnded();

        const other = setup();
        const foreignZone = zone(other);
        dragOverAt(s, "t1", 312, 185);
        const crossModel = dragEvent("dragover", 0, 0);
        foreignZone.element.dispatchEvent(crossModel);
        expect(crossModel.defaultPrevented).toBe(false);
        z.unregister();
        foreignZone.unregister();
    });

    it("takes an external drag that moves on from the layout, and ends it when it leaves", () => {
        const s = setup({
            onExternalDrag: () => ({
                tab: { component: "file", data: { name: "report.csv" } },
            }),
        });
        const z = zone(s);
        const other = zone(s);
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        s.root.dispatchEvent(dragEvent("dragover", 312, 185, foreign()));
        expect(DragDropManager.getDragState()?.source).toBe("external");
        // the zone's dragenter fires before the root's dragleave
        z.element.dispatchEvent(dragEvent("dragenter", 0, 0, foreign()));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));
        expect(DragDropManager.getDragState()?.source).toBe("external");
        const drop = dragEvent("drop", 0, 0, foreign());
        z.element.dispatchEvent(drop);
        expect(z.onDrop).toHaveBeenCalledTimes(1);
        expect(z.onDrop.mock.calls[0]?.[0]).toEqual({
            kind: "new",
            tab: { component: "file", data: { name: "report.csv" } },
        });
        expect(DragDropManager.getDragState()).toBeUndefined();

        // another foreign drag: layout → zone → out of the page
        s.root.dispatchEvent(dragEvent("dragenter", 312, 185, foreign()));
        other.element.dispatchEvent(dragEvent("dragenter", 0, 0, foreign()));
        s.root.dispatchEvent(dragEvent("dragleave", 312, 185, foreign()));
        other.element.dispatchEvent(dragEvent("dragleave", 0, 0, foreign()));
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(other.onDrop).not.toHaveBeenCalled();
        z.unregister();
        other.unregister();
    });

    it("stops listening once unregistered", () => {
        const s = setup();
        const z = zone(s);
        z.unregister();
        dragOverAt(s, "t0", 312, 185);
        const over = dragEvent("dragover", 0, 0);
        z.element.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        expect(z.onOverChange).not.toHaveBeenCalled();
    });
});
