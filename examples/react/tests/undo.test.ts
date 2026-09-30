// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests/useUndo.test.tsx.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// The hook tests, rewritten against the examples' framework-agnostic UndoManager (the kit's
// `_kit/undo.ts`): same cases, no React.

import {
    createModel,
    type LayoutJson,
    type Model,
    veto,
} from "@fragiola/dockable";
import { describe, expect, it, vi } from "vitest";
import { UndoManager } from "../src/examples/_kit/undo";

type Types = { tabs: { tab: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts1",
                children: [
                    { id: "t1", component: "tab", data: { name: "Tab One" } },
                ],
            },
            {
                type: "tabset",
                id: "ts2",
                children: [
                    { id: "t2", component: "tab", data: { name: "Tab Two" } },
                ],
            },
        ],
    },
};

const fresh = (layout: LayoutJson<Types> = json) =>
    createModel<Types>(structuredClone(layout));

function model(manager: UndoManager<Types>): Model<Types> {
    const current = manager.getModel();
    if (!current) throw new Error("no model");
    return current;
}

const rename = (m: Model<Types>, name: string) =>
    m.run("tab.update", { tab: "t1", component: "tab", data: { name } });

const children = (m: Model<Types>, id: string) => {
    const node = m.get(id);
    return node?.type === "tabset" ? node.children.map((c) => c.id) : [];
};

describe("UndoManager", () => {
    it("records a step per command; undo restores and redo re-applies", () => {
        const undo = new UndoManager(fresh());

        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);
        expect(undo.canUndo).toBe(true);
        expect(model(undo).get("t1")).toBeUndefined();

        undo.undo();
        expect(model(undo).get("t1")).not.toBeUndefined();
        expect(undo.canUndo).toBe(false);
        expect(undo.canRedo).toBe(true);
        expect(undo.redoCount).toBe(1);

        undo.redo();
        expect(model(undo).get("t1")).toBeUndefined();
        expect(undo.canUndo).toBe(true);
        expect(undo.canRedo).toBe(false);
    });

    it("restores in place: the model stays the same, and keeps recording", () => {
        const first = fresh();
        const undo = new UndoManager(first);
        model(undo).run("tab.close", { tab: "t1" });
        undo.undo();
        expect(undo.getModel()).toBe(first);

        model(undo).run("tab.close", { tab: "t2" });
        expect(undo.undoCount).toBe(1);
    });

    it("ignores tabset.activate by default", () => {
        const undo = new UndoManager(fresh());

        model(undo).run("tabset.activate", { tabset: "ts2" });
        expect(undo.undoCount).toBe(0);
        expect(undo.canUndo).toBe(false);
    });

    it("honors custom ignoreCommands", () => {
        const undo = new UndoManager(fresh(), {
            ignoreCommands: ["tab.update"],
        });

        rename(model(undo), "renamed");
        expect(undo.undoCount).toBe(0);

        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);
    });

    it("collapses an entire drag gesture into a single undo step", () => {
        const undo = new UndoManager(fresh());

        model(undo).run(
            "row.resize",
            { row: model(undo).state.root.id, weights: [30, 70] },
            { transient: true },
        );
        model(undo).run(
            "row.resize",
            { row: model(undo).state.root.id, weights: [20, 80] },
            { transient: true },
        );
        model(undo).run("row.resize", {
            row: model(undo).state.root.id,
            weights: [20, 80],
        });
        expect(undo.undoCount).toBe(1);

        undo.undo();
        expect(model(undo).get("ts1")).toMatchObject({ weight: 100 });
        expect(model(undo).get("ts2")).toMatchObject({ weight: 100 });
    });

    it("collapses a batch into a single undo step and restores all tabs on undo", () => {
        const three: LayoutJson<Types> = {
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            {
                                id: "t1",
                                component: "tab",
                                data: { name: "One" },
                            },
                            {
                                id: "t2",
                                component: "tab",
                                data: { name: "Two" },
                            },
                            {
                                id: "t3",
                                component: "tab",
                                data: { name: "Three" },
                            },
                        ],
                    },
                ],
            },
        };
        const undo = new UndoManager(fresh(three));

        model(undo).run("batch", {
            commands: [
                { command: "tab.close", payload: { tab: "t1" } },
                { command: "tab.close", payload: { tab: "t2" } },
                { command: "tab.close", payload: { tab: "t3" } },
            ],
        });
        expect(undo.undoCount).toBe(1);
        expect(model(undo).get("t1")).toBeUndefined();
        expect(model(undo).get("t2")).toBeUndefined();
        expect(model(undo).get("t3")).toBeUndefined();

        undo.undo();
        expect(undo.canUndo).toBe(false);
        expect(model(undo).get("t1")).not.toBeUndefined();
        expect(model(undo).get("t2")).not.toBeUndefined();
        expect(model(undo).get("t3")).not.toBeUndefined();
    });

    it("keeps the pre-gesture layout when an ignored command happens mid-gesture", () => {
        const undo = new UndoManager(fresh());
        const row = model(undo).state.root.id;

        model(undo).run(
            "row.resize",
            { row, weights: [30, 70] },
            { transient: true },
        );
        model(undo).run("tabset.activate", { tabset: "ts2" }); // ignored, mid-gesture
        model(undo).run("row.resize", { row, weights: [30, 70] });
        expect(undo.undoCount).toBe(1);

        undo.undo();
        // back to before the gesture, not to the mid-gesture state
        expect(model(undo).get("ts1")).toMatchObject({ weight: 100 });
    });

    it("caps the undo buffer at maxBufferSize", () => {
        const undo = new UndoManager(fresh(), { maxBufferSize: 2 });

        rename(model(undo), "a");
        rename(model(undo), "b");
        rename(model(undo), "c");
        expect(undo.undoCount).toBe(2);
    });

    it("clears the redo buffer on a new command", () => {
        const undo = new UndoManager(fresh());
        rename(model(undo), "a");
        undo.undo();
        expect(undo.canRedo).toBe(true);

        rename(model(undo), "b");
        expect(undo.canRedo).toBe(false);
        expect(undo.redoCount).toBe(0);
    });

    it("does not record its own undo and redo, nor a command that changed nothing", () => {
        const undo = new UndoManager(fresh());
        model(undo).run("tabset.activate", { tabset: "ts1" }); // ignored
        model(undo).run("tab.select", { tab: "t1" }); // already selected and active
        expect(undo.undoCount).toBe(0);
        model(undo).run("tab.move", { tab: "t1", to: "ts2" });
        undo.undo();
        undo.redo();
        expect(undo.undoCount).toBe(1);
        expect(undo.redoCount).toBe(0);
        expect(children(model(undo), "ts2")).toEqual(["t2", "t1"]);
    });

    it("keeps the step when the model refuses to load it", () => {
        const undo = new UndoManager(fresh());
        model(undo).run("tab.close", { tab: "t1" });
        const remove = model(undo).use((ctx, next) =>
            ctx.command === "layout.load" ? veto() : next(),
        );
        undo.undo();
        expect(undo.undoCount).toBe(1);
        expect(undo.redoCount).toBe(0);
        expect(model(undo).get("t1")).toBeUndefined();
        remove();
        undo.undo();
        expect(model(undo).get("t1")).not.toBeUndefined();
    });

    it("setModel replaces the model and resets the history by default", () => {
        const undo = new UndoManager(fresh());

        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);

        const next = fresh();
        undo.setModel(next);
        expect(undo.getModel()).toBe(next);
        expect(undo.undoCount).toBe(0);
        expect(undo.canUndo).toBe(false);
        expect(undo.canRedo).toBe(false);
    });

    it("setModel keeps the history when resetHistory is false", () => {
        const undo = new UndoManager(fresh());

        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);

        undo.setModel(fresh(), false);
        expect(undo.undoCount).toBe(1);
        expect(undo.canUndo).toBe(true);
    });

    it("reset clears the history without touching the model", () => {
        const undo = new UndoManager(fresh());

        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);

        undo.reset();
        expect(undo.undoCount).toBe(0);
        expect(undo.redoCount).toBe(0);
        expect(model(undo).get("t1")).toBeUndefined();
    });

    it("starts without a model and accepts one later", () => {
        const undo = new UndoManager<Types>(null);
        expect(undo.getSnapshot().model).toBeNull();
        undo.undo();
        undo.setModel(fresh());
        model(undo).run("tab.close", { tab: "t1" });
        expect(undo.undoCount).toBe(1);
    });

    describe("snapshot and subscription", () => {
        it("returns the same snapshot object until something changes", () => {
            const undo = new UndoManager(fresh());
            const first = undo.getSnapshot();
            expect(undo.getSnapshot()).toBe(first);

            // an ignored command changes nothing observable
            model(undo).run("tabset.activate", { tabset: "ts2" });
            expect(undo.getSnapshot()).toBe(first);

            model(undo).run("tab.close", { tab: "t1" });
            const second = undo.getSnapshot();
            expect(second).not.toBe(first);
            expect(second).toMatchObject({
                canUndo: true,
                undoCount: 1,
                canRedo: false,
                redoCount: 0,
            });
            expect(undo.getSnapshot()).toBe(second);

            undo.undo();
            expect(undo.getSnapshot()).not.toBe(second);
            expect(undo.getSnapshot().model).toBe(undo.getModel());
        });

        it("notifies subscribers on change and stops after unsubscribe", () => {
            const undo = new UndoManager(fresh());
            const listener = vi.fn();
            const unsubscribe = undo.subscribe(listener);

            model(undo).run("tab.close", { tab: "t1" });
            expect(listener).toHaveBeenCalledTimes(1);
            undo.undo();
            expect(listener).toHaveBeenCalledTimes(2);

            unsubscribe();
            undo.redo();
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it("does not notify for a reset that changes nothing", () => {
            const undo = new UndoManager(fresh());
            const listener = vi.fn();
            undo.subscribe(listener);
            undo.reset();
            expect(listener).not.toHaveBeenCalled();
        });

        it("dispose detaches from the model", () => {
            const undo = new UndoManager(fresh());
            const current = model(undo);
            const listener = vi.fn();
            undo.subscribe(listener);
            undo.dispose();

            current.run("tab.close", { tab: "t1" });
            expect(undo.undoCount).toBe(0);
            expect(listener).not.toHaveBeenCalled();
        });
    });
});
