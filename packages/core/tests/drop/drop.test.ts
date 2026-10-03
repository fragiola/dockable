import { describe, expect, it } from "vitest";
import type { DragSubject } from "../../src/dnd/session";
import {
    type DropGeometry,
    type DropQuery,
    dropCandidates,
} from "../../src/drop/resolve";
import { clampToPinnedRun, findStripDrop } from "../../src/drop/strip";
import {
    dockIndexPlus,
    dockLocationAt,
    dockOrientation,
    dockRect,
    edgeAt,
    edgeBands,
} from "../../src/geometry/dock";
import { type Rect, rect } from "../../src/geometry/rect";
import type { Model } from "../../src/state/model";
import { createModel } from "../../src/state/model";
import { tab } from "../state/harness";

function tabOf(model: Model, id: string) {
    const node = model.get("node-by", { id });
    if (node?.type !== "tab") throw new Error(`no tab ${id}`);
    return node;
}

describe("dock locations", () => {
    const r = rect(0, 0, 100, 100);
    it("splits a rect into a center and four sides along its diagonals", () => {
        expect(dockLocationAt(r, 50, 50)).toBe("center");
        expect(dockLocationAt(r, 50, 5)).toBe("top");
        expect(dockLocationAt(r, 50, 95)).toBe("bottom");
        expect(dockLocationAt(r, 5, 50)).toBe("start");
        expect(dockLocationAt(r, 95, 50)).toBe("end");
        expect(dockLocationAt(r, 50, 40, true)).toBe("top");
        expect(dockLocationAt(rect(0, 0, 0, 10), 1, 1)).toBe("center");
    });

    it("puts a start or top drop before its target, an end or bottom one after it", () => {
        expect(dockIndexPlus("start")).toBe(0);
        expect(dockIndexPlus("top")).toBe(0);
        expect(dockIndexPlus("end")).toBe(1);
        expect(dockIndexPlus("bottom")).toBe(1);
        expect(dockOrientation("start")).toBe("horizontal");
        expect(dockOrientation("end")).toBe("horizontal");
        expect(dockOrientation("top")).toBe("vertical");
        expect(dockOrientation("center")).toBe("vertical");
    });

    it("gives each location half the rect", () => {
        expect(dockRect(r, "top")).toEqual(rect(0, 0, 100, 50));
        expect(dockRect(r, "end")).toEqual(rect(50, 0, 50, 100));
        expect(dockRect(r, "center")).toBe(r);
    });

    it("draws the edge bands and finds the band under a point, once", () => {
        const root = rect(10, 20, 400, 300);
        expect(edgeBands(root, 10, 100)).toEqual([
            { location: "top", rect: rect(160, 20, 100, 10) },
            { location: "bottom", rect: rect(160, 310, 100, 10) },
            { location: "start", rect: rect(10, 120, 10, 100) },
            { location: "end", rect: rect(400, 120, 10, 100) },
        ]);
        expect(edgeAt(root, 10, 100, 12, 170)).toEqual({
            location: "start",
            outline: rect(10, 20, 100, 300),
        });
        expect(edgeAt(root, 10, 100, 405, 170)?.outline).toEqual(
            rect(310, 20, 100, 300),
        );
        expect(edgeAt(root, 10, 100, 12, 30)).toBeUndefined(); // outside the band's length
        expect(edgeAt(root, 10, 100000, 12, 30)?.location).toBe("start"); // the whole edge
    });
});

describe("strip drops", () => {
    const host = rect(0, 0, 300, 200);
    const strip = rect(0, 0, 300, 30);
    const tabs = [
        rect(0, 0, 60, 30),
        rect(60, 0, 60, 30),
        rect(120, 0, 60, 30),
    ];

    it("drops before a tab's centre, after the last one, or in an empty strip", () => {
        expect(findStripDrop(host, strip, tabs, 80, 10, "horizontal")).toEqual({
            index: 1,
            outline: rect(58, 0, 3, 30),
        });
        expect(findStripDrop(host, strip, tabs, 170, 10, "horizontal")).toEqual(
            {
                index: 3,
                outline: rect(178, 0, 3, 30),
            },
        );
        expect(findStripDrop(host, strip, [], 170, 10, "horizontal")).toEqual({
            index: 0,
            outline: rect(0, 0, 2, 30),
        });
    });

    it("drops before or after tabs flush with the tabset's edges", () => {
        expect(findStripDrop(host, strip, tabs, 10, 10, "tabset")).toEqual({
            index: 0,
            outline: rect(-2, 0, 3, 30),
        });
        const full = [rect(0, 0, 150, 30), rect(150, 0, 150, 30)];
        expect(findStripDrop(host, strip, full, 290, 10, "tabset")).toEqual({
            index: 2,
            outline: rect(298, 0, 3, 30),
        });
    });

    it("keeps a tabset's slots inside the tabset, and a vertical strip's along its own axis", () => {
        const tabset = rect(20, 0, 300, 200);
        // the first tab is scrolled out of the tabset
        expect(
            findStripDrop(tabset, strip, tabs, 10, 10, "tabset"),
        ).toBeUndefined();
        const overflowing = [rect(0, 0, 150, 30), rect(150, 0, 160, 30)];
        expect(
            findStripDrop(host, strip, overflowing, 305, 10, "tabset"),
        ).toBeUndefined();
        expect(
            findStripDrop(tabset, strip, tabs, 10, 10, "horizontal"),
        ).toEqual({ index: 0, outline: rect(-2, 0, 3, 30) });
        expect(findStripDrop(tabset, strip, tabs, 40, 10, "tabset")).toEqual({
            index: 1,
            outline: rect(58, 0, 3, 30),
        });
        const narrow = rect(0, 0, 20, 200);
        const column = [rect(0, 30, 20, 40), rect(0, 70, 20, 40)];
        expect(
            findStripDrop(narrow, narrow, column, 10, 40, "vertical"),
        ).toEqual({ index: 0, outline: rect(0, 28, 20, 3) });
    });

    it("skips tabs hidden by overflow", () => {
        const hidden: (Rect | undefined)[] = [
            tabs[0],
            rect(0, 0, 0, 0),
            tabs[2],
        ];
        expect(
            findStripDrop(host, strip, hidden, 130, 10, "horizontal")?.index,
        ).toBe(2);
    });

    it("clamps to the pinned run", () => {
        const drop = { index: 0, outline: rect(-2, 0, 3, 30) };
        expect(clampToPinnedRun(drop, 2, false, tabs)).toEqual({
            index: 2,
            outline: rect(118, 0, 3, 30),
        });
        expect(
            clampToPinnedRun({ index: 3, outline: drop.outline }, 1, true, tabs)
                .index,
        ).toBe(1);
    });
});

describe("drop candidates", () => {
    const model = createModel({
        version: 1,
        root: {
            type: "row",
            id: "root",
            children: [
                { type: "tabset", id: "a", children: [tab("A1"), tab("A2")] },
                {
                    type: "tabset",
                    id: "b",
                    droppable: false,
                    children: [tab("B1")],
                },
            ],
        },
        borders: [{ location: "bottom", children: [tab("Log")] }],
    });
    const rects: Record<string, Rect> = {
        root: rect(0, 0, 400, 300),
        a: rect(0, 0, 196, 300),
        b: rect(204, 0, 196, 300),
    };
    const geometry: DropGeometry = {
        node: (id) => rects[id],
        tabStrip: (id) =>
            rects[id] ? rect(rects[id].x, 0, rects[id].width, 30) : undefined,
        content: (id) =>
            rects[id] ? rect(rects[id].x, 30, rects[id].width, 270) : undefined,
        tabButton: (id) =>
            ({
                A1: rect(0, 0, 60, 30),
                A2: rect(60, 0, 60, 30),
                B1: rect(204, 0, 60, 30),
                Log: rect(0, 300, 60, 20),
            })[id],
        borderStrip: () => rect(0, 300, 400, 20),
        borderContent: () => undefined,
    };
    const tabSubject: DragSubject = {
        kind: "tab",
        tab: tabOf(model, "A1"),
    };
    const candidates = (
        x: number,
        y: number,
        subject: DragSubject = tabSubject,
        query: Partial<DropQuery> = {},
    ) =>
        dropCandidates({
            state: model.state,
            layoutId: "main",
            maximized: undefined,
            geometry,
            subject,
            x,
            y,
            ...query,
        });

    it("offers the edge band first, then the tabset under the point", () => {
        const found = candidates(5, 150);
        expect(found.map((c) => [c.target, c.location, c.kind])).toEqual([
            ["root", "start", "edge"],
            ["a", "start", "rect"],
        ]);
    });

    it("offers a strip drop with its index", () => {
        expect(candidates(100, 10)).toMatchObject([
            { target: "a", location: "center", index: 2 },
        ]);
        // A1 is flush with the tabset's start
        expect(candidates(20, 10)).toMatchObject([
            { target: "a", location: "center", index: 0 },
        ]);
    });

    it("keeps a center-less tabset's content to its edges", () => {
        expect(candidates(300, 150)).toMatchObject([{ target: "b" }]);
        expect(candidates(300, 150)[0]?.location).not.toBe("center");
    });

    it("offers the border strip", () => {
        expect(candidates(100, 310)).toMatchObject([
            { target: "border_bottom", index: 1 },
        ]);
    });

    it("marks a tabset dropped on itself", () => {
        const tabset = model.get("node-by", { id: "a" });
        if (tabset?.type !== "tabset") throw new Error("no tabset");
        expect(candidates(100, 150, { kind: "tabset", tabset })).toMatchObject([
            { target: "a", self: true },
        ]);
    });

    it("offers only the maximized tabset", () => {
        const maximized = createModel({
            ...model.get("layout-json"),
            maximized: "a",
        });
        expect(
            candidates(5, 150, tabSubject, {
                state: maximized.state,
                maximized: maximized.get("maximized-tabset", {}),
            }),
        ).toMatchObject([{ target: "a", location: "center" }]);
    });
});
