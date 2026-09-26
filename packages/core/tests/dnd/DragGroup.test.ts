// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type Action,
    Actions,
    createLayoutEngine,
    DockLocation,
    DragDropManager,
    DragGroup,
    type IJsonModel,
    type ITransfer,
    type LayoutEngine,
    Model,
    type RowNode,
    type TabNode,
    type TabSetNode,
} from "../../src";
import { node, Rects } from "../engine/fixture";

// Two independent layouts (two models) on one page, exchanging tabs through a DragGroup.

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

const jsonWith = (prefix: string): IJsonModel => ({
    global: {},
    layout: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { type: "tab", id: `${prefix}0`, name: `${prefix}0` },
                    { type: "tab", id: `${prefix}1`, name: `${prefix}1` },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [
                    { type: "tab", id: `${prefix}2`, name: `${prefix}2` },
                ],
            },
        ],
    },
});

const engines: LayoutEngine[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        engines[0]?.getDragDropManager().onDragEnded();
    }
    for (const engine of engines.splice(0)) engine.dispose();
    document.body.innerHTML = "";
});

/** a layout of two tabsets, measured with fixed rects, like the engine fixture's */
function layout(
    prefix: string,
    options: {
        onAction?: (a: Action) => Action | undefined;
        dragGroup?: DragGroup;
    } = {},
) {
    const model = Model.fromJson(jsonWith(prefix));
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
        dragGroup: options.dragGroup,
    });
    engines.push(engine);
    const root = document.body.appendChild(document.createElement("div"));
    rects.set(root, 10, 20, 400, 300);
    const el = () => root.appendChild(document.createElement("div"));
    engine.attachRoot(root);
    engine.prepare();
    engine.registerMeasurable(
        node<RowNode>(model, "row"),
        "row",
        rects.set(el(), 10, 20, 400, 300) as HTMLElement,
    );
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts0"),
        "tabset",
        rects.set(el(), 10, 20, 196, 300) as HTMLElement,
    );
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts0"),
        "tabsetcontent",
        rects.set(el(), 10, 50, 196, 270) as HTMLElement,
    );
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts1"),
        "tabset",
        rects.set(el(), 214, 20, 196, 300) as HTMLElement,
    );
    engine.registerMeasurable(
        node<TabSetNode>(model, "ts1"),
        "tabsetcontent",
        rects.set(el(), 214, 50, 196, 270) as HTMLElement,
    );
    for (const id of [`${prefix}0`, `${prefix}1`, `${prefix}2`]) {
        engine.registerTabPanel(node<TabNode>(model, id), el());
    }
    engine.sync();
    return {
        model,
        engine,
        root,
        actions,
        manager: engine.getDragDropManager(),
    };
}

/** drags `tabId` of `from` and drops it in the centre of `to`'s second tabset */
function dragBetween(
    from: ReturnType<typeof layout>,
    tabId: string,
    to: ReturnType<typeof layout>,
) {
    from.manager.setDragNode(
        dragEvent("dragstart", 40, 35),
        node<TabNode>(from.model, tabId),
    );
    to.root.dispatchEvent(dragEvent("dragenter", 312, 185));
    const over = dragEvent("dragover", 312, 185);
    to.root.dispatchEvent(over);
    to.root.dispatchEvent(dragEvent("drop", 312, 185));
    return over;
}

const ids = (model: Model, tabsetId: string) =>
    node<TabSetNode>(model, tabsetId)
        .getChildren()
        .map((c) => c.getId());

describe("dragging between two models", () => {
    it("is refused without a shared drag group", () => {
        const a = layout("a");
        const b = layout("b");
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(false);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("moves the tab into the other model, keeping its id, JSON and content element", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        const moveable = node<TabNode>(a.model, "a0").getMoveableElement();
        const transfers: ITransfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));

        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(true);
        expect(ids(b.model, "ts1")).toEqual(["b2", "a0"]);
        expect(ids(a.model, "ts0")).toEqual(["a1"]);
        const moved = node<TabNode>(b.model, "a0");
        expect(moved.getName()).toBe("a0");
        expect(moved.getMoveableElement()).toBe(moveable);

        // each side saw its own action, marked as a transfer
        expect(b.actions.map((x) => x.type)).toEqual([Actions.ADD_TAB]);
        expect(a.actions.map((x) => x.type)).toEqual([Actions.DELETE_TAB]);
        expect(b.actions[0]?.userData).toMatchObject({
            transfer: { tabId: "a0", from: a.model, to: b.model },
        });

        expect(transfers).toHaveLength(1);
        expect(transfers[0]).toMatchObject({
            tab: moved,
            from: { model: a.model, tabsetId: "ts0", index: 0 },
            to: { model: b.model, tabsetId: "ts1", index: 1 },
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(a.manager.getIndicatorState().dragging).toBe(false);
        expect(b.manager.getIndicatorState().dragging).toBe(false);
    });

    it("changes nothing when the target vetoes the add", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group, onAction: () => undefined });
        dragBetween(a, "a0", b);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("changes nothing when the source vetoes the delete", () => {
        const group = new DragGroup();
        const a = layout("a", {
            dragGroup: group,
            onAction: (action) =>
                action.type === Actions.DELETE_TAB ? undefined : action,
        });
        const b = layout("b", { dragGroup: group });
        dragBetween(a, "a0", b);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("counts replacing the add with another kind of action as a veto", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", {
            dragGroup: group,
            onAction: (action) =>
                action.type === Actions.ADD_TAB
                    ? Actions.selectTab("b1")
                    : action,
        });
        dragBetween(a, "a0", b);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
    });

    it("applies the target model's drop rules", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        b.model.setOnAllowDrop(() => false);
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(false);
        expect(b.manager.getIndicatorState().refused).toBe(false); // cleared after the drop
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("refuses a tab whose id is already used in the target model", () => {
        const group = new DragGroup();
        const a = layout("x", { dragGroup: group });
        const b = layout("x", { dragGroup: group });
        dragBetween(a, "x0", b);
        expect(ids(a.model, "ts0")).toEqual(["x0", "x1"]);
        expect(ids(b.model, "ts1")).toEqual(["x2"]);
    });

    it("moves only tabs: a tabset drag does not cross models", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        a.manager.setDragNode(
            dragEvent("dragstart", 40, 35),
            node<TabSetNode>(a.model, "ts0"),
        );
        b.root.dispatchEvent(dragEvent("dragenter", 312, 185));
        const over = dragEvent("dragover", 312, 185);
        b.root.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
    });
});

describe("DragGroup.transfer (from code)", () => {
    it("runs the same transfer, and can bring a tab back where it came from", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        const transfers: ITransfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));

        const moved = group.transfer(
            "a1",
            a.model,
            b.model,
            "ts0",
            DockLocation.CENTER,
            -1,
        );
        expect(moved?.getId()).toBe("a1");
        expect(ids(b.model, "ts0")).toEqual(["b0", "b1", "a1"]);

        // the undo an app would build: back to where the event says it was
        const from = transfers[0]?.from;
        if (!from?.tabsetId) throw new Error("no from");
        group.transfer(
            "a1",
            b.model,
            a.model,
            from.tabsetId,
            DockLocation.CENTER,
            from.index,
        );
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
        expect(ids(b.model, "ts0")).toEqual(["b0", "b1"]);
    });

    it("returns undefined for a model outside the group or an unknown tab", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const outside = layout("c");
        expect(
            group.transfer(
                "a0",
                a.model,
                outside.model,
                "ts0",
                DockLocation.CENTER,
                -1,
            ),
        ).toBeUndefined();
        expect(
            group.transfer(
                "nope",
                a.model,
                a.model,
                "ts0",
                DockLocation.CENTER,
                -1,
            ),
        ).toBeUndefined();
    });

    it("forgets an engine that is disposed", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        expect(group.has(a.engine)).toBe(true);
        a.engine.dispose();
        expect(group.has(a.engine)).toBe(false);
    });
});
