// Ported from FlexLayout (https://github.com/caplin/FlexLayout), tests-playwright/border-direction.spec.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
//
// FlexLayout rotates the tab container with CSS classes and asserts the transform matrices. Here
// the rotation is the fixture's styling (writing-mode, keyed off data-tab-direction), so the port
// asserts the state attribute and the geometry: the first tab at the top, in both directions.
import { expect, type Page, test } from "@playwright/test";
import { findPath, waitForBox } from "./helpers";

const open = async (page: Page) => {
    await page.goto("/fixtures/borders/?layout=test_border_direction");
    await expect(findPath(page, "/border/start/tb0")).toBeVisible();
    await expect(findPath(page, "/border/start/tb2")).toBeVisible();
};

const setDirection = (page: Page, direction: "up" | "down") =>
    page.evaluate((value) => {
        window.__dockable?.model.run("border.configure", {
            borderId: "border_start",
            data: { tabDirection: value },
        });
    }, direction);

const firstTabOnTop = async (page: Page) => {
    const strip = await waitForBox(
        findPath(page, "/border/start"),
        "start strip",
    );
    const tb0 = await waitForBox(findPath(page, "/border/start/tb0"), "tb0");
    const tb2 = await waitForBox(findPath(page, "/border/start/tb2"), "tb2");
    expect(tb0.y).toBeLessThan(tb2.y);
    expect(tb0.y).toBeLessThan(strip.y + 40);
    expect(tb0.x).toBeGreaterThanOrEqual(strip.x - 5);
    expect(tb0.x + tb0.width).toBeLessThanOrEqual(strip.x + strip.width + 5);
    // the start and end borders' first tabs line up
    const end0 = await waitForBox(findPath(page, "/border/end/tb0"), "end tb0");
    expect(Math.abs(tb0.y - end0.y)).toBeLessThan(5);
};

test("the start border's tabs read up by default, first tab at the top", async ({
    page,
}) => {
    await open(page);
    await expect(findPath(page, "/border/start")).toHaveAttribute(
        "data-tab-direction",
        "up",
    );
    await expect(findPath(page, "/border/end")).not.toHaveAttribute(
        "data-tab-direction",
    );
    await firstTabOnTop(page);
});

test("the start border's tabDirection 'down' flips the reading direction, keeping the order", async ({
    page,
}) => {
    await open(page);
    await setDirection(page, "down");
    await expect(findPath(page, "/border/start")).toHaveAttribute(
        "data-tab-direction",
        "down",
    );
    await firstTabOnTop(page);
});

test("toggling back to 'up' restores it", async ({ page }) => {
    await open(page);
    await setDirection(page, "down");
    await expect(findPath(page, "/border/start")).toHaveAttribute(
        "data-tab-direction",
        "down",
    );
    await setDirection(page, "up");
    await expect(findPath(page, "/border/start")).toHaveAttribute(
        "data-tab-direction",
        "up",
    );
    await firstTabOnTop(page);
});
