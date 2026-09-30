import { describe, expect, it } from "vitest";
import { rect } from "../../src/geometry/rect";
import {
    borderSplitSize,
    borderSplitterBounds,
    calculateSplit,
    type SizeRange,
    type SplitChild,
    sizeRanges,
    splitterBounds,
    splitterInitials,
    tabsetRange,
} from "../../src/split/split";
import type { AnyRow, AnyTabset } from "../../src/state/tree";

const free: SizeRange = {
    minWidth: 1,
    minHeight: 1,
    maxWidth: 99999,
    maxHeight: 99999,
};

function child(x: number, width: number, range: SizeRange = free): SplitChild {
    return { rect: rect(x, 0, width, 100), range };
}

describe("size ranges", () => {
    it("narrows a tabset by its tabs and adds its strip", () => {
        const tabset: AnyTabset = {
            type: "tabset",
            id: "ts",
            weight: 100,
            selected: 0,
            minWidth: 50,
            children: [
                {
                    type: "tab",
                    id: "a",
                    component: "x",
                    data: undefined,
                    minWidth: 80,
                    maxHeight: 300,
                },
                {
                    type: "tab",
                    id: "b",
                    component: "x",
                    data: undefined,
                    maxWidth: 40,
                },
            ],
        };
        // max width 40 < min width 80: the range keeps max >= min
        expect(tabsetRange({}, tabset, 30)).toEqual({
            minWidth: 80,
            minHeight: 31,
            maxWidth: 80,
            maxHeight: 330,
        });
    });

    it("sums a row's children along it and intersects across it", () => {
        const ts = (
            id: string,
            minWidth: number,
            minHeight: number,
        ): AnyTabset => ({
            type: "tabset",
            id,
            weight: 50,
            selected: -1,
            children: [],
            minWidth,
            minHeight,
        });
        const root: AnyRow = {
            type: "row",
            id: "root",
            weight: 100,
            children: [ts("a", 100, 20), ts("b", 50, 60)],
        };
        const ranges = sizeRanges({}, root, "horizontal", 8, () => 10);
        // FlexLayout starts a row's minimum at 1 and adds the children and the splitters between
        expect(ranges.get("root")).toMatchObject({
            minWidth: 1 + 100 + 50 + 8,
            minHeight: 70,
        });
        expect(ranges.get("a")).toMatchObject({ minWidth: 100, minHeight: 30 });
    });
});

describe("splitters", () => {
    it("bounds a splitter by the children's minimum sizes", () => {
        const children = [
            child(0, 200, { ...free, minWidth: 50 }),
            child(208, 192, { ...free, minWidth: 60 }),
        ];
        expect(splitterBounds(children, "horizontal", 8, 1)).toEqual([
            50,
            400 - 60 - 8,
        ]);
    });

    it("starts a drag from the children's sizes", () => {
        const children = [child(0, 200), child(208, 192)];
        expect(splitterInitials(children, "horizontal", 8, 1)).toEqual({
            initialSizes: [200, 192],
            sum: 392,
            startPosition: 200,
        });
    });

    it("moves the splitter: the child it moves towards shrinks", () => {
        const children = [child(0, 200), child(208, 192)];
        const initials = splitterInitials(children, "horizontal", 8, 1);
        const weights = calculateSplit(
            children,
            "horizontal",
            1,
            250,
            initials,
        );
        expect(weights.map((w) => Math.round(w * 392) / 100)).toEqual([
            250, 142,
        ]);
    });

    it("stops a child at its minimum and takes the rest from the next one", () => {
        const children = [
            child(0, 100),
            child(108, 100, { ...free, minWidth: 80 }),
            child(216, 100),
        ];
        const initials = splitterInitials(children, "horizontal", 8, 1);
        const weights = calculateSplit(
            children,
            "horizontal",
            1,
            150,
            initials,
        );
        const sizes = weights.map((w) => Math.round((w * initials.sum) / 100));
        expect(sizes).toEqual([150, 80, 70]);
    });

    it("returns no weights for an unmeasured row", () => {
        const children = [child(0, 0), child(0, 0)];
        expect(
            calculateSplit(
                children,
                "horizontal",
                1,
                10,
                splitterInitials(children, "horizontal", 8, 1),
            ),
        ).toEqual([]);
    });

    it("bounds a border splitter and converts its position to a size", () => {
        const layout = rect(0, 0, 800, 600);
        const range = { ...free, minWidth: 100, minHeight: 100 };
        const left = borderSplitterBounds(
            "left",
            rect(0, 0, 30, 600),
            layout,
            range,
            8,
            { minSize: 50, maxSize: 400 },
        );
        expect(left).toEqual([80, 430]);
        const bottom = borderSplitterBounds(
            "bottom",
            rect(0, 570, 800, 30),
            layout,
            range,
            8,
        );
        expect(bottom).toEqual([100, 562]);
        expect(borderSplitSize("bottom", bottom, 400)).toBe(162);
        expect(borderSplitSize("left", [30, 700], 230)).toBe(200);
        expect(
            borderSplitterBounds(
                "left",
                rect(0, 0, 30, 600),
                rect(0, 0, 0, 0),
                range,
                8,
            ),
        ).toEqual([0, 0]);
    });
});
