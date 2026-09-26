// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests-playwright/overlay-borders.spec.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// Not ported: the demo's toolbar toggle button (replaced by dispatching Actions.setBorderType), the
// maximize button (a FlexLayout view feature), the sub-layout inside an overlay panel (sub-layouts
// in tabs are not rendered yet) and the context menus (Dockable renders no menus).
import { expect, type Page, test } from "@playwright/test";
import { checkTab, dragSplitter, findPath, waitForBox } from "./helpers";

type BorderLocation = "top" | "bottom" | "left" | "right";

const open = async (page: Page) => {
    await page.goto("/fixtures/borders/?layout=test_overlay");
    await expect(page.getByRole("tablist")).toHaveCount(3 + 4); // three tabsets, four borders
    return waitForBox(findPath(page, "/ts0"), "ts0");
};

const setBorderType = (
    page: Page,
    location: BorderLocation,
    type: "split" | "overlay",
) =>
    page.evaluate(
        ([loc, value]) => {
            const dockable = window.__dockable;
            dockable?.model.doAction(
                dockable.Actions.setBorderType(
                    `border_${loc}`,
                    value as "split" | "overlay",
                ),
            );
        },
        [location, type],
    );

const sameBox = (
    a: { width: number; height: number },
    b: { width: number; height: number },
) => {
    expect(Math.abs(a.width - b.width)).toBeLessThan(2);
    expect(Math.abs(a.height - b.height)).toBeLessThan(2);
};

test("an overlay border opens over the layout; a split one shrinks it", async ({
    page,
}) => {
    const main = await open(page);
    await findPath(page, "/border/left/tb0").click();
    await expect(findPath(page, "/border/left/t0")).toBeVisible();
    sameBox(await waitForBox(findPath(page, "/ts0"), "ts0"), main);

    await findPath(page, "/border/bottom/tb0").click();
    const shrunk = await waitForBox(findPath(page, "/ts0"), "ts0");
    expect(shrunk.height).toBeLessThan(main.height - 50);
});

test("toggling a border's type: overlay restores the layout, the splitter still resizes, split shrinks it again", async ({
    page,
}) => {
    const main = await open(page);
    await findPath(page, "/border/bottom/tb0").click();
    const split = await waitForBox(findPath(page, "/ts0"), "ts0");
    expect(split.height).toBeLessThan(main.height - 50);

    await setBorderType(page, "bottom", "overlay");
    await expect(findPath(page, "/border/bottom")).toHaveAttribute(
        "data-overlay",
        "",
    );
    sameBox(await waitForBox(findPath(page, "/ts0"), "ts0"), main);

    const before = await waitForBox(
        findPath(page, "/border/bottom/t0"),
        "bottom panel",
    );
    await dragSplitter(page, findPath(page, "/border/bottom/s-1"), true, -100);
    const after = await waitForBox(
        findPath(page, "/border/bottom/t0"),
        "bottom panel",
    );
    expect(after.height).toBeGreaterThan(before.height + 50);

    await setBorderType(page, "bottom", "split");
    const again = await waitForBox(findPath(page, "/ts0"), "ts0");
    expect(again.height).toBeLessThan(main.height - 50);
});

test("clicking a tabset closes an open overlay", async ({ page }) => {
    await open(page);
    await findPath(page, "/border/left/tb0").click();
    await expect(findPath(page, "/border/left/t0")).toBeVisible();
    await findPath(page, "/ts1/t0").click({ position: { x: 150, y: 200 } });
    await expect(findPath(page, "/border/left/t0")).toBeHidden();
    await checkTab(page, "/border/left", 0, false, "left1");
});

test("dragging a layout splitter closes an open overlay", async ({ page }) => {
    await open(page);
    await findPath(page, "/border/left/tb0").click();
    await expect(findPath(page, "/border/left/t0")).toBeVisible();
    await dragSplitter(page, findPath(page, "/s1"), false, 40);
    await expect(findPath(page, "/border/left/t0")).toBeHidden();
});

test("Escape closes the overlay from its tab button or from inside the panel, focusing the tab button", async ({
    page,
}) => {
    await open(page);
    const button = findPath(page, "/border/left/tb0");
    await button.click();
    await expect(findPath(page, "/border/left/t0")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(findPath(page, "/border/left/t0")).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await findPath(page, "/border/left/t0").getByTestId("input").click();
    await page.keyboard.press("Escape");
    await expect(findPath(page, "/border/left/t0")).toBeHidden();
    await expect(button).toBeFocused();
});

test("clicking inside the overlay panel keeps it open", async ({ page }) => {
    await open(page);
    await findPath(page, "/border/left/tb0").click();
    const panel = findPath(page, "/border/left/t0");
    await panel.getByTestId("counter").click();
    await panel.click({ position: { x: 20, y: 200 } });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("counter")).toHaveText("Count: 1");
});

test("the overlay splitter resizes it, and the size persists when it reopens", async ({
    page,
}) => {
    await open(page);
    await findPath(page, "/border/left/tb0").click();
    const before = await waitForBox(
        findPath(page, "/border/left/t0"),
        "left panel",
    );
    await dragSplitter(page, findPath(page, "/border/left/s-1"), false, 100);
    const after = await waitForBox(
        findPath(page, "/border/left/t0"),
        "left panel",
    );
    expect(after.width).toBeGreaterThan(before.width + 50);

    await findPath(page, "/ts2/t0").click({ position: { x: 100, y: 200 } });
    await expect(findPath(page, "/border/left/t0")).toBeHidden();
    await findPath(page, "/border/left/tb0").click();
    const reopened = await waitForBox(
        findPath(page, "/border/left/t0"),
        "left panel",
    );
    expect(Math.abs(reopened.width - after.width)).toBeLessThan(2);
});

for (const location of ["top", "bottom", "left", "right"] as const) {
    test(`an overlay ${location} border opens over the layout and closes on an outside click`, async ({
        page,
    }) => {
        const main = await open(page);
        await setBorderType(page, location, "overlay");
        await findPath(page, `/border/${location}/tb0`).click();
        await expect(findPath(page, `/border/${location}/t0`)).toBeVisible();
        sameBox(await waitForBox(findPath(page, "/ts0"), "ts0"), main);
        await findPath(page, "/ts1/t0").click({ position: { x: 150, y: 250 } });
        await expect(findPath(page, `/border/${location}/t0`)).toBeHidden();
    });
}

test("an open left overlay stops above an open bottom overlay", async ({
    page,
}) => {
    await open(page);
    await setBorderType(page, "bottom", "overlay");
    await findPath(page, "/border/bottom/tb0").click();
    await findPath(page, "/border/left/tb0").click();
    await expect(findPath(page, "/border/bottom/t0")).toBeVisible();
    await expect(findPath(page, "/border/left/t0")).toBeVisible();
    const bottom = await waitForBox(
        findPath(page, "/border/bottom/t0"),
        "bottom panel",
    );
    const left = await waitForBox(
        findPath(page, "/border/left/t0"),
        "left panel",
    );
    expect(bottom.x).toBeLessThanOrEqual(left.x);
    expect(left.y + left.height).toBeLessThanOrEqual(bottom.y + 1);
    const splitter = await waitForBox(
        findPath(page, "/border/left/s-1"),
        "left splitter",
    );
    expect(Math.abs(splitter.height - left.height)).toBeLessThan(2);
});
