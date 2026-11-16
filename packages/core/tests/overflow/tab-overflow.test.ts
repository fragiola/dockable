import { describe, expect, it } from "vitest";
import { computeTabOverflow } from "../../src";

const run = (
    available: number,
    sizes: number[],
    selectedIndex = -1,
    reserve = 0,
    gap = 0,
) => computeTabOverflow({ available, sizes, gap, selectedIndex, reserve });

describe("computeTabOverflow", () => {
    it("has nothing to split without tabs", () => {
        expect(run(100, [])).toEqual({ visible: [], hidden: [] });
    });

    it("shows every tab when they fit, ignoring the reserve", () => {
        expect(run(300, [100, 100, 100], 0, 40)).toEqual({
            visible: [0, 1, 2],
            hidden: [],
        });
    });

    it("counts the gaps, and tolerates sub-pixel rounding", () => {
        expect(run(310, [100, 100, 100], -1, 0, 5).hidden).toEqual([]);
        expect(run(309, [100, 100, 100], -1, 0, 5).hidden).toEqual([2]);
        expect(run(299.6, [100, 100, 100]).hidden).toEqual([]);
    });

    it("fits tabs from the start into the space left by the trigger", () => {
        expect(run(290, [100, 100, 100], 0, 40)).toEqual({
            visible: [0, 1],
            hidden: [2],
        });
        expect(run(239, [100, 100, 100], 0, 40)).toEqual({
            visible: [0],
            hidden: [1, 2],
        });
    });

    it("stops at the first tab that does not fit (the strip stays contiguous)", () => {
        // the small last tab would fit after the first, but the second does not
        expect(run(250, [100, 200, 20], 0, 40)).toEqual({
            visible: [0],
            hidden: [1, 2],
        });
    });

    it("keeps the selected tab visible, freeing space from the end", () => {
        expect(run(290, [100, 100, 100, 100], 3, 40)).toEqual({
            visible: [0, 3],
            hidden: [1, 2],
        });
        // selected in the middle
        expect(run(290, [100, 100, 100, 100], 2, 40)).toEqual({
            visible: [0, 2],
            hidden: [1, 3],
        });
        // selected first: plain prefix
        expect(run(290, [100, 100, 100, 100], 0, 40)).toEqual({
            visible: [0, 1],
            hidden: [2, 3],
        });
    });

    it("shows the selected tab alone when nothing else fits, even if it does not fit either", () => {
        expect(run(120, [100, 100, 100], 1, 40)).toEqual({
            visible: [1],
            hidden: [0, 2],
        });
        expect(run(10, [100, 100, 100], 2, 40)).toEqual({
            visible: [2],
            hidden: [0, 1],
        });
        // no selection (a closed border): the first tab stays, so the strip keeps a tab stop
        expect(run(10, [100, 100], -1, 40)).toEqual({
            visible: [0],
            hidden: [1],
        });
    });

    it("hides monotonically as the space shrinks, and visible + hidden is always every tab", () => {
        const sizes = [80, 60, 120, 90, 70, 100];
        let previous = -1;
        for (let available = 600; available >= 0; available -= 7) {
            const { visible, hidden } = run(available, sizes, 4, 30);
            expect([...visible, ...hidden].sort((a, b) => a - b)).toEqual([
                0, 1, 2, 3, 4, 5,
            ]);
            expect(visible).toContain(4);
            expect(hidden.length).toBeGreaterThanOrEqual(previous);
            previous = hidden.length;
        }
    });
});
