// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests-playwright/view.spec.ts (the
// "drag tests two tabs" and "three tabs" groups) and tests-playwright/move-position.spec.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// Differences: selectors use data-layout-path and roles, never class names; the edge drags target
// the layout edge directly (the skeleton has no edge indicator elements); "move tabstrip" (tabset
// drags) is not ported, since the skeleton only drags tabs.
import { expect, type Page, test } from "@playwright/test";
import {
    checkTab,
    drag,
    dragOver,
    dragToEdge,
    Edge,
    findAllTabSets,
    findPath,
    findTabButton,
    Location,
    waitForBox,
} from "./helpers";

const open = async (page: Page, layout: string) => {
    await page.goto(`/fixtures/basic/?layout=${layout}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

test.describe("drag tests two tabs", () => {
    test.beforeEach(async ({ page }) => {
        await open(page, "test_two_tabs");
        await expect(findAllTabSets(page)).toHaveCount(2);
    });

    test("tab to tab center", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        await expect(findAllTabSets(page)).toHaveCount(1);
        await checkTab(page, "/ts0", 0, false, "Two");
        await checkTab(page, "/ts0", 1, true, "One");
    });

    test("tab to tab top", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.TOP,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/r0/ts0", 0, true, "One");
        await checkTab(page, "/r0/ts1", 0, true, "Two");
    });

    test("tab to tab bottom", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.BOTTOM,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/r0/ts0", 0, true, "Two");
        await checkTab(page, "/r0/ts1", 0, true, "One");
    });

    test("tab to tab left", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.LEFT,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts0", 0, true, "One");
        await checkTab(page, "/ts1", 0, true, "Two");
    });

    test("tab to tab right", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.RIGHT,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts0", 0, true, "Two");
        await checkTab(page, "/ts1", 0, true, "One");
    });

    test("tab to edge", async ({ page }) => {
        await dragToEdge(page, findTabButton(page, "/ts0", 0), Edge.BOTTOM);
        await checkTab(page, "/r0/ts0", 0, true, "Two");
        await checkTab(page, "/r0/ts1", 0, true, "One");
    });
});

test.describe("three tabs", () => {
    test.beforeEach(async ({ page }) => {
        await open(page, "test_three_tabs");
        await expect(findAllTabSets(page)).toHaveCount(3);
    });

    test("tab to tabset", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/tabstrip"),
            Location.CENTER,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts0", 0, false, "Two");
        await checkTab(page, "/ts0", 1, true, "One");
        await checkTab(page, "/ts1", 0, true, "Three");
    });

    test("tab to tab center", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts0", 0, false, "Two");
        await checkTab(page, "/ts0", 1, true, "One");
        await checkTab(page, "/ts1", 0, true, "Three");
    });

    test("tab to tab top", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.TOP,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/r0/ts0", 0, true, "One");
        await checkTab(page, "/r0/ts1", 0, true, "Two");
        await checkTab(page, "/ts1", 0, true, "Three");
    });

    test("tab to tab bottom", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.BOTTOM,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        // the bottom of the middle tabset is also the middle of the layout's bottom edge
        await checkTab(page, "/r0/r0/ts0", 0, true, "Two");
        await checkTab(page, "/r0/r0/ts1", 0, true, "Three");
        await checkTab(page, "/r0/ts1", 0, true, "One");
    });

    test("tab to tab left", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.LEFT,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/ts0", 0, true, "One");
        await checkTab(page, "/ts1", 0, true, "Two");
        await checkTab(page, "/ts2", 0, true, "Three");
    });

    test("tab to tab right", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.RIGHT,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/ts0", 0, true, "Two");
        await checkTab(page, "/ts1", 0, true, "One");
        await checkTab(page, "/ts2", 0, true, "Three");
    });

    test("tab to edge top", async ({ page }) => {
        await dragToEdge(page, findTabButton(page, "/ts0", 0), Edge.TOP);
        await checkTab(page, "/r0/ts0", 0, true, "One");
        await checkTab(page, "/r0/r1/ts0", 0, true, "Two");
        await checkTab(page, "/r0/r1/ts1", 0, true, "Three");
    });

    test("tab to edge left", async ({ page }) => {
        await dragToEdge(page, findTabButton(page, "/ts0", 0), Edge.LEFT);
        await checkTab(page, "/ts0", 0, true, "One");
        await checkTab(page, "/ts1", 0, true, "Two");
        await checkTab(page, "/ts2", 0, true, "Three");
    });

    test("tab to edge bottom", async ({ page }) => {
        await dragToEdge(page, findTabButton(page, "/ts0", 0), Edge.BOTTOM);
        await checkTab(page, "/r0/r0/ts0", 0, true, "Two");
        await checkTab(page, "/r0/r0/ts1", 0, true, "Three");
        await checkTab(page, "/r0/ts1", 0, true, "One");
    });

    test("tab to edge right", async ({ page }) => {
        await dragToEdge(page, findTabButton(page, "/ts0", 0), Edge.RIGHT);
        await checkTab(page, "/ts0", 0, true, "Two");
        await checkTab(page, "/ts1", 0, true, "Three");
        await checkTab(page, "/ts2", 0, true, "One");
    });

    test("row to column", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts2/t0"),
            Location.BOTTOM,
        );
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/r1/ts0/t0"),
            Location.BOTTOM,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/r0/ts0", 0, true, "Three");
        await checkTab(page, "/r0/ts1", 0, true, "Two");
        await checkTab(page, "/r0/ts2", 0, true, "One");
    });

    test("row to single tabset", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts2/t0"),
            Location.CENTER,
        );
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t1"),
            Location.CENTER,
        );
        await expect(findAllTabSets(page)).toHaveCount(1);
        await checkTab(page, "/ts0", 0, false, "Three");
        await checkTab(page, "/ts0", 1, false, "One");
        await checkTab(page, "/ts0", 2, true, "Two");
    });

    test("move tab in tabstrip", async ({ page }) => {
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts2/t0"),
            Location.CENTER,
        );
        await drag(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t1"),
            Location.CENTER,
        );
        await checkTab(page, "/ts0", 0, false, "Three");
        await checkTab(page, "/ts0", 1, false, "One");
        await checkTab(page, "/ts0", 2, true, "Two");

        await drag(
            page,
            findTabButton(page, "/ts0", 2),
            findTabButton(page, "/ts0", 0),
            Location.LEFT,
        );
        await checkTab(page, "/ts0", 0, true, "Two");
        await checkTab(page, "/ts0", 1, false, "Three");
        await checkTab(page, "/ts0", 2, false, "One");
    });
});

test.describe("drop indicator", () => {
    test("follows the computed target with data-drop-location and data-drop-kind", async ({
        page,
    }) => {
        await open(page, "test_three_tabs");
        const indicator = findPath(page, "/outline");
        await expect(indicator).toBeHidden();

        const drop = await dragOver(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/ts1/t0"),
            Location.TOP,
        );
        await expect(indicator).toBeVisible();
        await expect(indicator).toHaveAttribute("data-drop-location", "top");
        await expect(indicator).toHaveAttribute("data-drop-kind", "rect");
        await expect(findPath(page, "/layout")).toHaveAttribute(
            "data-dragging",
            "",
        );
        await expect(findTabButton(page, "/ts0", 0)).toHaveAttribute(
            "data-dragging",
            "",
        );
        const target = await waitForBox(findPath(page, "/ts1"), "/ts1");
        const outline = await waitForBox(indicator, "outline");
        expect(outline.y).toBeGreaterThanOrEqual(target.y - 1);
        expect(outline.y + outline.height).toBeLessThan(
            target.y + target.height / 2 + 1,
        );
        await drop();

        await expect(indicator).toBeHidden();
        await expect(findPath(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
    });

    test("marks a layout edge drop with kind edge", async ({ page }) => {
        await open(page, "test_three_tabs");
        const root = await waitForBox(findPath(page, "/layout"), "layout root");
        const drop = await dragOver(
            page,
            findTabButton(page, "/ts0", 0),
            findPath(page, "/layout"),
            Location.CENTER,
        );
        await page.mouse.move(root.x + 4, root.y + root.height / 2, {
            steps: 5,
        });
        const indicator = findPath(page, "/outline");
        await expect(indicator).toHaveAttribute("data-drop-kind", "edge");
        await expect(indicator).toHaveAttribute("data-drop-location", "left");
        await drop();
    });
});

test("panel content state survives a drag into another tabset", async ({
    page,
}) => {
    await open(page, "test_three_tabs");
    const panel = findPath(page, "/ts0/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("input").fill("kept");

    await drag(
        page,
        findTabButton(page, "/ts0", 0),
        findPath(page, "/ts1/t0"),
        Location.CENTER,
    );
    await checkTab(page, "/ts0", 1, true, "One");
    const moved = findPath(page, "/ts0/t1");
    await expect(moved.getByTestId("counter")).toHaveText("Count: 1");
    await expect(moved.getByTestId("input")).toHaveValue("kept");
});

// regression: moving the selected tab to another tabset mounts a fresh panel for the newly
// selected tab in the source tabset; panels must stay out of flow so the measure pass sees
// correct geometry
test("panels positioned correctly after moving a tab to another tabset center", async ({
    page,
}) => {
    await open(page, "multi");
    await drag(
        page,
        findTabButton(page, "/ts0", 0),
        findPath(page, "/ts1/t0"),
        Location.CENTER,
    );
    await checkTab(page, "/ts1", 1, true, "One");

    // every visible panel must line up with its own tabset's content area
    await expect
        .poll(async () =>
            page.evaluate(() => {
                const bad: string[] = [];
                for (const el of Array.from(
                    document.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
                )) {
                    if (el.style.display === "none") continue;
                    const panel = el.getBoundingClientRect();
                    const contents = document.querySelectorAll<HTMLElement>(
                        '[data-layout-path$="/content"]',
                    );
                    const matched = Array.from(contents).some((c) => {
                        const r = c.getBoundingClientRect();
                        return (
                            Math.abs(r.x - panel.x) < 2 &&
                            Math.abs(r.y - panel.y) < 2 &&
                            Math.abs(r.width - panel.width) < 2 &&
                            Math.abs(r.height - panel.height) < 2
                        );
                    });
                    if (!matched)
                        bad.push(
                            `${el.dataset.layoutPath} ${JSON.stringify(panel)}`,
                        );
                }
                return bad;
            }),
        )
        .toEqual([]);
});
