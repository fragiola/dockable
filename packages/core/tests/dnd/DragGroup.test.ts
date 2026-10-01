// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    createLayoutEngine,
    createModel,
    DragDropManager,
    DragGroup,
    type LayoutEngine,
    type LayoutJson,
    type Middleware,
    type Model,
    type Transfer,
    type TransferMeta,
    veto,
} from "../../src";
import { dragEvent, Rects, recordCommands } from "../engine/fixture";

// Two independent layouts (two models) on one page, exchanging tabs through a DragGroup.

const jsonWith = (prefix: string): LayoutJson => ({
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    {
                        id: `${prefix}0`,
                        component: "test",
                        data: { name: `${prefix}0` },
                    },
                    {
                        id: `${prefix}1`,
                        component: "test",
                        data: { name: `${prefix}1` },
                    },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [
                    {
                        id: `${prefix}2`,
                        component: "test",
                        data: { name: `${prefix}2` },
                    },
                ],
            },
        ],
    },
});

const engines: LayoutEngine[] = [];
afterEach(() => {
    if (DragDropManager.getDragState()) {
        engines[0]?.adapter.getDragDropManager().onDragEnded();
    }
    for (const engine of engines.splice(0)) engine.adapter.dispose();
    document.body.innerHTML = "";
});

/** a layout of two tabsets, measured with fixed rects, like the engine fixture's */
function layout(
    prefix: string,
    options: { middleware?: Middleware; dragGroup?: DragGroup } = {},
) {
    const model = createModel(jsonWith(prefix));
    const metas: unknown[] = [];
    model.use((ctx, next) => {
        if (!ctx.dryRun) {
            metas.push(ctx.meta);
        }
        return next();
    });
    if (options.middleware) {
        model.use(options.middleware);
    }
    const commands = recordCommands(model);
    const rects = new Rects();
    const engine = createLayoutEngine({
        model,
        measure: rects.measure,
        dragGroup: options.dragGroup,
    });
    engines.push(engine);
    const root = document.body.appendChild(document.createElement("div"));
    rects.set(root, 10, 20, 400, 300);
    const el = () => root.appendChild(document.createElement("div"));
    engine.adapter.attachRoot(root);
    engine.adapter.prepare();
    engine.adapter.registerMeasurable(
        "row",
        "row",
        rects.set(el(), 10, 20, 400, 300),
    );
    engine.adapter.registerMeasurable(
        "ts0",
        "tabset",
        rects.set(el(), 10, 20, 196, 300),
    );
    engine.adapter.registerMeasurable(
        "ts0",
        "tabsetcontent",
        rects.set(el(), 10, 50, 196, 270),
    );
    engine.adapter.registerMeasurable(
        "ts1",
        "tabset",
        rects.set(el(), 214, 20, 196, 300),
    );
    engine.adapter.registerMeasurable(
        "ts1",
        "tabsetcontent",
        rects.set(el(), 214, 50, 196, 270),
    );
    for (const id of [`${prefix}0`, `${prefix}1`, `${prefix}2`]) {
        engine.adapter.registerTabPanel(id, el());
    }
    engine.run("measure-and-position");
    return {
        model,
        engine,
        root,
        commands,
        metas,
        manager: engine.adapter.getDragDropManager(),
    };
}

type Layout = ReturnType<typeof layout>;

/** drags `tabId` of `from` and drops it in the centre of `to`'s second tabset */
function dragBetween(from: Layout, tabId: string, to: Layout) {
    from.manager.startDrag(dragEvent("dragstart", 40, 35), tabId);
    to.root.dispatchEvent(dragEvent("dragenter", 312, 185));
    const over = dragEvent("dragover", 312, 185);
    to.root.dispatchEvent(over);
    to.root.dispatchEvent(dragEvent("drop", 312, 185));
    return over;
}

const ids = (model: Model, tabsetId: string) => {
    const tabset = model.get("node-by", { id: tabsetId });
    return tabset?.type === "tabset" ? tabset.children.map((c) => c.id) : [];
};

describe("dragging between two models", () => {
    it("is refused without a shared drag group", () => {
        const a = layout("a");
        const b = layout("b");
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(false);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("moves the tab into the other model, keeping its id, data and content element", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        const moveable = a.engine.adapter.getMoveableElement("a0");
        const transfers: Transfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));

        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(true);
        expect(ids(b.model, "ts1")).toEqual(["b2", "a0"]);
        expect(ids(a.model, "ts0")).toEqual(["a1"]);
        expect(b.model.get("node-by", { id: "a0" })).toMatchObject({
            data: { name: "a0" },
        });
        expect(b.engine.adapter.getMoveableElement("a0")).toBe(moveable);

        // each side ran its own command, marked as a transfer
        expect(b.commands.map((x) => x.command)).toEqual(["tab.add"]);
        expect(a.commands.map((x) => x.command)).toEqual(["tab.close"]);
        expect(b.metas[0]).toMatchObject({
            transfer: { tabId: "a0", from: a.model, to: b.model },
        });

        expect(transfers).toHaveLength(1);
        expect(transfers[0]).toMatchObject({
            tab: "a0",
            previousId: "a0",
            from: { model: a.model, tabsetId: "ts0", index: 0 },
            to: { model: b.model, tabsetId: "ts1", index: 1 },
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(a.manager.getIndicatorState().dragging).toBe(false);
        expect(b.manager.getIndicatorState().dragging).toBe(false);
    });

    it("changes nothing when the target refuses the add", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", {
            dragGroup: group,
            middleware: (ctx, next) =>
                ctx.command === "tab.add" ? veto() : next(),
        });
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(false); // refused during the hover
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("asks the hover with the transfer's meta, as the drop runs it", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const hovers: unknown[] = [];
        const b = layout("b", {
            dragGroup: group,
            middleware: (ctx, next) => {
                if (ctx.command === "tab.add" && ctx.dryRun) {
                    hovers.push(ctx.meta);
                }
                // only transfers from model a
                return ctx.command === "tab.add" &&
                    (ctx.meta as Partial<TransferMeta> | undefined)?.transfer
                        ?.from !== a.model
                    ? veto()
                    : next();
            },
        });
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(true);
        expect(hovers[0]).toMatchObject({
            transfer: { tabId: "a0", from: a.model, to: b.model },
        });
        expect(ids(b.model, "ts1")).toEqual(["b2", "a0"]);
    });

    it("changes nothing when the source refuses the close", () => {
        const group = new DragGroup();
        const a = layout("a", {
            dragGroup: group,
            middleware: (ctx, next) =>
                ctx.command === "tab.close" ? veto() : next(),
        });
        const b = layout("b", { dragGroup: group });
        const over = dragBetween(a, "a0", b);
        expect(over.defaultPrevented).toBe(false); // refused during the hover, as the drop would be
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
    });

    it("undoes the add, content included, when the source refuses the close only when it runs", () => {
        const group = new DragGroup();
        const a = layout("a", {
            dragGroup: group,
            middleware: (ctx, next) =>
                ctx.command === "tab.close" && !ctx.dryRun ? veto() : next(),
        });
        const b = layout("b", { dragGroup: group });
        const moveable = a.engine.adapter.getMoveableElement("a0");
        const transfers: Transfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));

        dragBetween(a, "a0", b);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
        expect(a.engine.adapter.getMoveableElement("a0")).toBe(moveable);
        expect(transfers).toEqual([]);
    });

    it("changes nothing for a tab that cannot close in its model", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        a.model.run("tab.configure", { tabId: "a0", enableClose: false });
        const b = layout("b", { dragGroup: group });
        dragBetween(a, "a0", b);
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
        expect(ids(b.model, "ts1")).toEqual(["b2"]);
    });

    it("gives the tab a new id when its id is taken in the target model", () => {
        const group = new DragGroup();
        const a = layout("x", { dragGroup: group });
        const b = layout("x", { dragGroup: group });
        const transfers: Transfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));
        dragBetween(a, "x0", b);
        expect(ids(a.model, "ts0")).toEqual(["x1"]);
        const added = transfers[0]?.tab;
        expect(added).toBeDefined();
        expect(added).not.toBe("x0");
        expect(ids(b.model, "ts1")).toEqual(["x2", added]);
    });

    it("moves only tabs: a tabset drag does not cross models", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const b = layout("b", { dragGroup: group });
        a.manager.startDrag(dragEvent("dragstart", 40, 35), "ts0");
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
        const transfers: Transfer[] = [];
        group.onTransfer((transfer) => transfers.push(transfer));

        expect(
            group.transfer({
                tab: "a1",
                from: a.model,
                to: b.model,
                target: "ts0",
            }),
        ).toBe("a1");
        expect(ids(b.model, "ts0")).toEqual(["b0", "b1", "a1"]);

        // the undo an app would build: back to where the event says it was
        const from = transfers[0]?.from;
        if (!from?.tabsetId) throw new Error("no from");
        group.transfer({
            tab: "a1",
            from: b.model,
            to: a.model,
            target: from.tabsetId,
            index: from.index,
        });
        expect(ids(a.model, "ts0")).toEqual(["a0", "a1"]);
        expect(ids(b.model, "ts0")).toEqual(["b0", "b1"]);
    });

    it("returns undefined for a model outside the group or an unknown tab", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        const outside = layout("c");
        expect(
            group.transfer({
                tab: "a0",
                from: a.model,
                to: outside.model,
                target: "ts0",
            }),
        ).toBeUndefined();
        expect(
            group.transfer({
                tab: "nope",
                from: a.model,
                to: a.model,
                target: "ts0",
            }),
        ).toBeUndefined();
    });

    it("forgets an engine that is disposed", () => {
        const group = new DragGroup();
        const a = layout("a", { dragGroup: group });
        expect(group.has(a.engine)).toBe(true);
        a.engine.adapter.dispose();
        expect(group.has(a.engine)).toBe(false);
    });
});
