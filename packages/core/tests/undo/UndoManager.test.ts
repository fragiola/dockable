// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests/useUndo.test.tsx.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// The hook tests are rewritten against the framework-agnostic UndoManager: same cases, no React.
import { describe, expect, it, vi } from "vitest";
import {
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    UndoManager,
} from "../../src";

const json: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts1",
                children: [{ type: "tab", id: "t1", name: "Tab One" }],
            },
            {
                type: "tabset",
                id: "ts2",
                children: [{ type: "tab", id: "t2", name: "Tab Two" }],
            },
        ],
    },
};

function model(manager: UndoManager): Model {
    const current = manager.getModel();
    if (!current) throw new Error("no model");
    return current;
}

describe("UndoManager", () => {
    it("records a snapshot per action; undo restores and redo re-applies", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);
        expect(undo.canUndo).toBe(true);
        expect(model(undo).getNodeById("t1")).toBeUndefined();

        undo.undo();
        expect(model(undo).getNodeById("t1")).not.toBeUndefined();
        expect(undo.canUndo).toBe(false);
        expect(undo.canRedo).toBe(true);
        expect(undo.redoCount).toBe(1);

        undo.redo();
        expect(model(undo).getNodeById("t1")).toBeUndefined();
        expect(undo.canUndo).toBe(true);
        expect(undo.canRedo).toBe(false);
    });

    it("keeps recording on the model that undo swapped in", () => {
        const undo = new UndoManager(Model.fromJson(json));
        model(undo).doAction(Actions.deleteTab("t1"));
        undo.undo();

        model(undo).doAction(Actions.deleteTab("t2"));
        expect(undo.undoCount).toBe(1);
    });

    it("ignores SET_ACTIVE_TABSET by default", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(Actions.setActiveTabset("ts2"));
        expect(undo.undoCount).toBe(0);
        expect(undo.canUndo).toBe(false);
    });

    it("honors custom ignoreActionTypes", () => {
        const undo = new UndoManager(Model.fromJson(json), {
            ignoreActionTypes: [Actions.RENAME_TAB],
        });

        model(undo).doAction(Actions.renameTab("t1", "renamed"));
        expect(undo.undoCount).toBe(0);

        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);
    });

    it("collapses an entire drag gesture into a single undo step", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(
            Actions.moveNode("t1", "ts2", DockLocation.CENTER, -1).setAdjusting(
                true,
            ),
        );
        model(undo).doAction(
            Actions.moveNode("t1", "ts2", DockLocation.CENTER, -1).setAdjusting(
                true,
            ),
        );
        model(undo).doAction(
            Actions.moveNode("t1", "ts2", DockLocation.CENTER, -1),
        );
        expect(undo.undoCount).toBe(1);

        undo.undo();
        expect(model(undo).getNodeById("ts1")?.getChildren().length).toBe(1);
        expect(model(undo).getNodeById("ts2")?.getChildren().length).toBe(1);
    });

    it("collapses a GroupAction into a single undo step and restores all tabs on undo", () => {
        const groupJson: IJsonModel = {
            global: {},
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            { type: "tab", id: "t1", name: "One" },
                            { type: "tab", id: "t2", name: "Two" },
                            { type: "tab", id: "t3", name: "Three" },
                        ],
                    },
                ],
            },
        };
        const undo = new UndoManager(Model.fromJson(groupJson));

        model(undo).doAction(
            Actions.group([
                Actions.deleteTab("t1"),
                Actions.deleteTab("t2"),
                Actions.deleteTab("t3"),
            ]),
        );
        expect(undo.undoCount).toBe(1);
        expect(model(undo).getNodeById("t1")).toBeUndefined();
        expect(model(undo).getNodeById("t2")).toBeUndefined();
        expect(model(undo).getNodeById("t3")).toBeUndefined();

        undo.undo();
        expect(undo.canUndo).toBe(false);
        expect(model(undo).getNodeById("t1")).not.toBeUndefined();
        expect(model(undo).getNodeById("t2")).not.toBeUndefined();
        expect(model(undo).getNodeById("t3")).not.toBeUndefined();
    });

    it("keeps the pre-gesture snapshot when an ignored action happens mid-gesture", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(
            Actions.moveNode("t1", "ts2", DockLocation.CENTER, -1).setAdjusting(
                true,
            ),
        );
        model(undo).doAction(Actions.setActiveTabset("ts2")); // ignored, mid-gesture
        model(undo).doAction(
            Actions.moveNode("t1", "ts2", DockLocation.CENTER, -1),
        );
        expect(undo.undoCount).toBe(1);

        undo.undo();
        // back to before the gesture, not to the mid-gesture state
        expect(
            model(undo)
                .getNodeById("ts1")
                ?.getChildren()
                .map((c) => c.getId()),
        ).toEqual(["t1"]);
    });

    it("caps the undo buffer at maxBufferSize", () => {
        const undo = new UndoManager(Model.fromJson(json), {
            maxBufferSize: 2,
        });

        model(undo).doAction(Actions.renameTab("t1", "a"));
        model(undo).doAction(Actions.renameTab("t1", "b"));
        model(undo).doAction(Actions.renameTab("t1", "c"));
        expect(undo.undoCount).toBe(2);
    });

    it("clears the redo buffer on a new action", () => {
        const undo = new UndoManager(Model.fromJson(json));
        model(undo).doAction(Actions.renameTab("t1", "a"));
        undo.undo();
        expect(undo.canRedo).toBe(true);

        model(undo).doAction(Actions.renameTab("t1", "b"));
        expect(undo.canRedo).toBe(false);
        expect(undo.redoCount).toBe(0);
    });

    it("setModel replaces the model and resets the history by default", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);

        const fresh = Model.fromJson(json);
        undo.setModel(fresh);
        expect(undo.getModel()).toBe(fresh);
        expect(undo.undoCount).toBe(0);
        expect(undo.canUndo).toBe(false);
        expect(undo.canRedo).toBe(false);
    });

    it("setModel keeps the history when resetHistory is false", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);

        undo.setModel(Model.fromJson(json), false);
        expect(undo.undoCount).toBe(1);
        expect(undo.canUndo).toBe(true);
    });

    it("reset clears the history without replacing the model", () => {
        const undo = new UndoManager(Model.fromJson(json));

        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);

        undo.reset();
        expect(undo.undoCount).toBe(0);
        expect(undo.redoCount).toBe(0);
        expect(model(undo).getNodeById("t1")).toBeUndefined();
    });

    it("starts without a model and accepts one later", () => {
        const undo = new UndoManager(null);
        expect(undo.getSnapshot().model).toBeNull();
        undo.undo();
        undo.setModel(Model.fromJson(json));
        model(undo).doAction(Actions.deleteTab("t1"));
        expect(undo.undoCount).toBe(1);
    });

    describe("snapshot and subscription", () => {
        it("returns the same snapshot object until something changes", () => {
            const undo = new UndoManager(Model.fromJson(json));
            const first = undo.getSnapshot();
            expect(undo.getSnapshot()).toBe(first);

            // an ignored action changes nothing observable
            model(undo).doAction(Actions.setActiveTabset("ts2"));
            expect(undo.getSnapshot()).toBe(first);

            model(undo).doAction(Actions.deleteTab("t1"));
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
            const undo = new UndoManager(Model.fromJson(json));
            const listener = vi.fn();
            const unsubscribe = undo.subscribe(listener);

            model(undo).doAction(Actions.deleteTab("t1"));
            expect(listener).toHaveBeenCalledTimes(1);
            undo.undo();
            expect(listener).toHaveBeenCalledTimes(2);

            unsubscribe();
            undo.redo();
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it("does not notify for a reset that changes nothing", () => {
            const undo = new UndoManager(Model.fromJson(json));
            const listener = vi.fn();
            undo.subscribe(listener);
            undo.reset();
            expect(listener).not.toHaveBeenCalled();
        });

        it("dispose detaches from the model", () => {
            const undo = new UndoManager(Model.fromJson(json));
            const current = model(undo);
            const listener = vi.fn();
            undo.subscribe(listener);
            undo.dispose();

            current.doAction(Actions.deleteTab("t1"));
            expect(undo.undoCount).toBe(0);
            expect(listener).not.toHaveBeenCalled();
        });
    });
});
