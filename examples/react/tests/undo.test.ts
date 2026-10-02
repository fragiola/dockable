// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests/useUndo.test.tsx.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// The hook tests, rewritten against the examples' framework-agnostic UndoManager (the shared
// `_kit/undo.ts`): same cases, no React.

import {
    createModel,
    type LayoutJson,
    type Model,
    toLayoutJson,
    veto,
} from "@fragiola/dockable-react";
import { describe, expect, it, vi } from "vitest";
import { handleUndoKeys, UndoManager } from "../src/examples/_kit/undo";

type Types = { tabs: { tab: undefined } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts1",
                children: [{ id: "t1", component: "tab", label: "Tab One" }],
            },
            {
                type: "tabset",
                id: "ts2",
                children: [{ id: "t2", component: "tab", label: "Tab Two" }],
            },
        ],
    },
};

const fresh = (layout: LayoutJson<Types> = json) =>
    createModel<Types>(structuredClone(layout));

/** A fresh model and its manager. */
function setup(
    layout: LayoutJson<Types> = json,
    options?: ConstructorParameters<typeof UndoManager<Types>>[1],
) {
    const m = fresh(layout);
    return { m, undo: new UndoManager(m, options) };
}

const undoCount = (undo: UndoManager<Types>) =>
    undo.getSnapshot().undoSteps.length;
const redoCount = (undo: UndoManager<Types>) =>
    undo.getSnapshot().redoSteps.length;
const canUndo = (undo: UndoManager<Types>) => undo.getSnapshot().canUndo;
const canRedo = (undo: UndoManager<Types>) => undo.getSnapshot().canRedo;

const rename = (m: Model<Types>, name: string) =>
    m.run("tab.configure", { tabId: "t1", label: name });

const children = (m: Model<Types>, id: string) => {
    const node = m.get("node-by", { id });
    return node?.type === "tabset" ? node.children.map((c) => c.id) : [];
};

describe("UndoManager", () => {
    it("records a step per command; undo restores and redo re-applies", () => {
        const { m, undo } = setup();

        m.run("tab.close", { tabId: "t1" });
        expect(undoCount(undo)).toBe(1);
        expect(canUndo(undo)).toBe(true);
        expect(m.get("node-by", { id: "t1" })).toBeUndefined();

        undo.undo();
        expect(m.get("node-by", { id: "t1" })).not.toBeUndefined();
        expect(canUndo(undo)).toBe(false);
        expect(canRedo(undo)).toBe(true);
        expect(redoCount(undo)).toBe(1);

        undo.redo();
        expect(m.get("node-by", { id: "t1" })).toBeUndefined();
        expect(canUndo(undo)).toBe(true);
        expect(canRedo(undo)).toBe(false);
    });

    it("restores in place: the model stays the same, and keeps recording", () => {
        const { m, undo } = setup();
        const state = m.state;
        m.run("tab.close", { tabId: "t1" });
        undo.undo();
        expect(m.get("layout-json")).toEqual(toLayoutJson(state));

        m.run("tab.close", { tabId: "t2" });
        expect(undoCount(undo)).toBe(1);
    });

    it("ignores tabset.activate by default", () => {
        const { m, undo } = setup();

        m.run("tabset.activate", { tabsetId: "ts2" });
        expect(undoCount(undo)).toBe(0);
        expect(canUndo(undo)).toBe(false);
    });

    it("honors custom ignoreCommands", () => {
        const { m, undo } = setup(json, {
            ignoreCommands: ["tab.configure"],
        });

        rename(m, "renamed");
        expect(undoCount(undo)).toBe(0);

        m.run("tab.close", { tabId: "t1" });
        expect(undoCount(undo)).toBe(1);
    });

    it("collapses an entire drag gesture into a single undo step", () => {
        const { m, undo } = setup();

        m.run(
            "row.resize",
            { rowId: m.state.root.id, weights: [30, 70] },
            { transient: true },
        );
        m.run(
            "row.resize",
            { rowId: m.state.root.id, weights: [20, 80] },
            { transient: true },
        );
        m.run("row.resize", {
            rowId: m.state.root.id,
            weights: [20, 80],
        });
        expect(undoCount(undo)).toBe(1);

        undo.undo();
        expect(m.get("node-by", { id: "ts1" })).toMatchObject({
            weight: 100,
        });
        expect(m.get("node-by", { id: "ts2" })).toMatchObject({
            weight: 100,
        });
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
                                label: "One",
                            },
                            {
                                id: "t2",
                                component: "tab",
                                label: "Two",
                            },
                            {
                                id: "t3",
                                component: "tab",
                                label: "Three",
                            },
                        ],
                    },
                ],
            },
        };
        const { m, undo } = setup(three);

        m.run("batch", {
            commands: [
                { command: "tab.close", payload: { tabId: "t1" } },
                { command: "tab.close", payload: { tabId: "t2" } },
                { command: "tab.close", payload: { tabId: "t3" } },
            ],
        });
        expect(undoCount(undo)).toBe(1);
        expect(m.get("node-by", { id: "t1" })).toBeUndefined();
        expect(m.get("node-by", { id: "t2" })).toBeUndefined();
        expect(m.get("node-by", { id: "t3" })).toBeUndefined();

        undo.undo();
        expect(canUndo(undo)).toBe(false);
        expect(m.get("node-by", { id: "t1" })).not.toBeUndefined();
        expect(m.get("node-by", { id: "t2" })).not.toBeUndefined();
        expect(m.get("node-by", { id: "t3" })).not.toBeUndefined();
    });

    it("keeps the pre-gesture layout when an ignored command happens mid-gesture", () => {
        const { m, undo } = setup();
        const row = m.state.root.id;

        m.run(
            "row.resize",
            { rowId: row, weights: [30, 70] },
            { transient: true },
        );
        m.run("tabset.activate", { tabsetId: "ts2" }); // ignored, mid-gesture
        m.run("row.resize", { rowId: row, weights: [30, 70] });
        expect(undoCount(undo)).toBe(1);

        undo.undo();
        // back to before the gesture, not to the mid-gesture state
        expect(m.get("node-by", { id: "ts1" })).toMatchObject({
            weight: 100,
        });
    });

    it("caps the undo buffer at maxBufferSize", () => {
        const { m, undo } = setup(json, { maxBufferSize: 2 });

        rename(m, "a");
        rename(m, "b");
        rename(m, "c");
        expect(undoCount(undo)).toBe(2);
    });

    it("clears the redo buffer on a new command", () => {
        const { m, undo } = setup();
        rename(m, "a");
        undo.undo();
        expect(canRedo(undo)).toBe(true);

        rename(m, "b");
        expect(canRedo(undo)).toBe(false);
        expect(redoCount(undo)).toBe(0);
    });

    it("does not record its own undo and redo, nor a command that changed nothing", () => {
        const { m, undo } = setup();
        m.run("tabset.activate", { tabsetId: "ts1" }); // ignored
        m.run("tab.select", { tabId: "t1" }); // already selected and active
        expect(undoCount(undo)).toBe(0);
        m.run("tab.move", { tabId: "t1", to: "ts2" });
        undo.undo();
        undo.redo();
        expect(undoCount(undo)).toBe(1);
        expect(redoCount(undo)).toBe(0);
        expect(children(m, "ts2")).toEqual(["t2", "t1"]);
    });

    it("keeps the step when the model refuses to load it", () => {
        const { m, undo } = setup();
        m.run("tab.close", { tabId: "t1" });
        const remove = m.use((ctx, next) =>
            ctx.command === "layout.load" ? veto() : next(),
        );
        undo.undo();
        expect(undoCount(undo)).toBe(1);
        expect(redoCount(undo)).toBe(0);
        expect(m.get("node-by", { id: "t1" })).toBeUndefined();
        remove();
        undo.undo();
        expect(m.get("node-by", { id: "t1" })).not.toBeUndefined();
    });

    it("names each step by the command that made it", () => {
        const { m, undo } = setup();
        m.run("tab.close", { tabId: "t1" });
        m.run("batch", {
            commands: [
                { command: "tab.select", payload: { tabId: "t2" } },
                { command: "tab.close", payload: { tabId: "t2" } },
            ],
        });
        expect(undo.getSnapshot().undoSteps).toEqual([
            { command: "tab.close", commands: ["tab.close"] },
            { command: "batch", commands: ["tab.select", "tab.close"] },
        ]);
        undo.undo();
        expect(undo.getSnapshot().undoSteps).toHaveLength(1);
        expect(undo.getSnapshot().redoSteps).toEqual([
            { command: "batch", commands: ["tab.select", "tab.close"] },
        ]);
    });

    it("starts no gesture for transient commands that change nothing", () => {
        const { m, undo } = setup();
        const row = m.state.root.id;
        m.run(
            "row.resize",
            { rowId: row, weights: [100, 100] },
            { transient: true },
        );
        m.run("row.resize", { rowId: row, weights: [100, 100] });
        expect(undoCount(undo)).toBe(0);
    });

    describe("snapshot and subscription", () => {
        it("returns the same snapshot object until something changes", () => {
            const { m, undo } = setup();
            const first = undo.getSnapshot();
            expect(undo.getSnapshot()).toBe(first);

            // an ignored command changes nothing observable
            m.run("tabset.activate", { tabsetId: "ts2" });
            expect(undo.getSnapshot()).toBe(first);

            m.run("tab.close", { tabId: "t1" });
            const second = undo.getSnapshot();
            expect(second).not.toBe(first);
            expect(second).toMatchObject({ canUndo: true, canRedo: false });
            expect(second.undoSteps).toHaveLength(1);
            expect(undo.getSnapshot()).toBe(second);

            undo.undo();
            expect(undo.getSnapshot()).not.toBe(second);
        });

        it("notifies subscribers on change and stops after unsubscribe", () => {
            const { m, undo } = setup();
            const listener = vi.fn();
            const unsubscribe = undo.subscribe(listener);

            m.run("tab.close", { tabId: "t1" });
            expect(listener).toHaveBeenCalledTimes(1);
            undo.undo();
            expect(listener).toHaveBeenCalledTimes(2);

            unsubscribe();
            undo.redo();
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
});

describe("handleUndoKeys", () => {
    const press = (
        key: string,
        modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
        target: EventTarget | null = null,
    ) => ({
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...modifiers,
        target,
        preventDefault: vi.fn(),
    });

    it("undoes on Ctrl/Cmd+Z and redoes on Shift+Ctrl/Cmd+Z and Ctrl+Y", () => {
        const { m, undo } = setup();
        m.run("tab.close", { tabId: "t1" });
        const z = press("z", { ctrlKey: true });
        handleUndoKeys(undo, z);
        expect(z.preventDefault).toHaveBeenCalled();
        expect(canRedo(undo)).toBe(true);
        handleUndoKeys(undo, press("Z", { metaKey: true, shiftKey: true }));
        expect(canUndo(undo)).toBe(true);
        handleUndoKeys(undo, press("z", { ctrlKey: true }));
        handleUndoKeys(undo, press("y", { ctrlKey: true }));
        expect(canRedo(undo)).toBe(false);
    });

    it("leaves other keys, unmodified keys and text fields alone", () => {
        const { m, undo } = setup();
        m.run("tab.close", { tabId: "t1" });
        const field = Object.assign(new EventTarget(), {
            closest: () => ({}),
        });
        for (const event of [
            press("x", { ctrlKey: true }),
            press("z", {}),
            press("z", { ctrlKey: true }, field),
        ]) {
            handleUndoKeys(undo, event);
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(canUndo(undo)).toBe(true);
    });
});
