// "popout window positions its tab panel" is ported from FlexLayout
// (https://github.com/caplin/FlexLayout), tests-playwright/popout-check.spec.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { expect, type Page, test } from "@playwright/test";
import {
    checkTab,
    findPath,
    findTabButton,
    waitForBox,
    waitForPopout,
} from "./helpers";

const open = async (page: Page, layout = "test_two_tabs") => {
    // count window.open calls, to prove StrictMode opens a single window
    await page.addInitScript(() => {
        const original = window.open.bind(window);
        const w = window as unknown as { openCount: number };
        w.openCount = 0;
        window.open = (...args: Parameters<typeof window.open>) => {
            w.openCount++;
            return original(...args);
        };
    });
    await page.goto(`/fixtures/popout/?layout=${layout}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

async function popOutSelected(page: Page, tabsetPath: string) {
    await findTabButton(page, tabsetPath, 0).click(); // makes the tabset active
    await page.getByTestId("popout").click();
    return waitForPopout(page.context(), page);
}

test("popout window positions its tab panel", async ({ page }) => {
    await open(page);
    const popout = await popOutSelected(page, "/ts1");
    await popout.waitForLoadState();

    // the popped out tab renders its panel in the new window, sized to the content area
    const panel = popout.getByRole("tabpanel");
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeVisible();
    const box = await waitForBox(panel, "popout panel");
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(50);

    // the panel sits over the popout's content area
    const content = await waitForBox(
        popout.locator('[data-layout-path$="/content"]'),
        "popout content area",
    );
    expect(Math.abs(box.x - content.x)).toBeLessThan(1);
    expect(Math.abs(box.y - content.y)).toBeLessThan(1);

    // the panel tracks the popout window size
    await popout.setViewportSize({ width: 500, height: 400 });
    await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(400);
});

test("content state survives pop out and dock back from inside the popout", async ({
    page,
}) => {
    await open(page);
    const panel = findPath(page, "/ts1/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("counter").click();
    await panel.getByTestId("input").fill("kept");

    const popout = await popOutSelected(page, "/ts1");
    const popped = popout.getByRole("tabpanel");
    await expect(popped.getByTestId("counter")).toHaveText("Count: 2");
    await expect(popped.getByTestId("input")).toHaveValue("kept");
    await expect(page.getByRole("tablist")).toHaveCount(1); // the tab left the main layout

    // the click empties the window layout, which closes its window: fire it without waiting on a
    // page that is about to close
    await popped.getByTestId("dock-back").evaluate((button) => {
        setTimeout(() => (button as HTMLElement).click(), 0);
    });
    await expect.poll(() => popout.isClosed()).toBe(true);
    await checkTab(page, "/ts0", 1, true, "Two");
    const docked = findPath(page, "/ts0/t1");
    await expect(docked.getByTestId("counter")).toHaveText("Count: 2");
    await expect(docked.getByTestId("input")).toHaveValue("kept");
});

test("closing the popout window docks its tab back with state kept", async ({
    page,
}) => {
    await open(page);
    const panel = findPath(page, "/ts1/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("input").fill("closed");

    const popout = await popOutSelected(page, "/ts1");
    await expect(
        popout.getByRole("tabpanel").getByTestId("counter"),
    ).toHaveText("Count: 1");
    await popout.close({ runBeforeUnload: true });

    await checkTab(page, "/ts0", 1, true, "Two");
    const docked = findPath(page, "/ts0/t1");
    await expect(docked.getByTestId("counter")).toHaveText("Count: 1");
    await expect(docked.getByTestId("input")).toHaveValue("closed");
});

test("the popout document receives the page's styles", async ({ page }) => {
    await open(page);
    const popout = await popOutSelected(page, "/ts1");
    // fixture.css gives tab strips a 30px minimum height; mirrored styles apply it in the popout
    const tablist = popout.getByRole("tablist");
    await expect(tablist).toHaveCSS("min-height", "30px");
    await expect(tablist).toHaveCSS("display", "flex");
});

test("StrictMode opens exactly one window", async ({ page }) => {
    await open(page);
    await popOutSelected(page, "/ts1");
    await page.waitForTimeout(500);
    expect(
        await page.evaluate(
            () => (window as unknown as { openCount: number }).openCount,
        ),
    ).toBe(1);
    expect(
        page
            .context()
            .pages()
            .filter((p) => p !== page && !p.isClosed()),
    ).toHaveLength(1);
});
