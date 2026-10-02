// Tab overflow (Epic #32): the tabs that do not fit are hidden one by one as the strip narrows,
// the selected tab stays, the trigger lists the hidden ones, and drops into the strip skip them.
import { expect, type Page, test } from "@playwright/test";
import { drag, findPath, Location, waitForBox } from "./helpers";

const open = async (page: Page, width: number) => {
    await page.setViewportSize({ width, height: 600 });
    await page.goto("/fixtures/overflow/");
    await waitForBox(findPath(page, "/ts0/tabstrip"), "strip");
};

// by attribute: getByRole skips the hidden (display: none) tabs
const tabs = (page: Page) =>
    findPath(page, "/ts0/tabstrip").locator('[role="tab"]');
const hiddenCount = (page: Page) =>
    findPath(page, "/ts0/tabstrip").locator("[data-overflow-hidden]").count();

test("every tab shows in a wide strip, with no trigger", async ({ page }) => {
    await open(page, 1600);
    await expect(tabs(page)).toHaveCount(6);
    expect(await hiddenCount(page)).toBe(0);
    await expect(findPath(page, "/ts0/tabstrip")).not.toHaveAttribute(
        "data-overflowing",
    );
    await expect(findPath(page, "/ts0/button/overflow")).toHaveCount(0);
});

test("narrowing hides tabs one by one, down to the trigger and the selected tab", async ({
    page,
}) => {
    await open(page, 1600);
    let previous = 0;
    for (let width = 1200; width >= 120; width -= 40) {
        await page.setViewportSize({ width, height: 600 });
        await page.waitForTimeout(50);
        const hidden = await hiddenCount(page);
        expect(hidden, `hidden at ${width}px`).toBeGreaterThanOrEqual(previous);
        expect(hidden - previous, `one step at ${width}px`).toBeLessThanOrEqual(
            2,
        );
        previous = hidden;
        await expect(tabs(page)).toHaveCount(6); // visible + hidden: every tab is still there
        await expect(findPath(page, "/ts0/tb0")).toBeVisible(); // the selected one
        if (hidden > 0) {
            await expect(findPath(page, "/ts0/button/overflow")).toBeVisible();
        }
    }
    expect(previous).toBe(5); // only the selected tab is left, next to the trigger
});

test("a tab picked from the menu is selected and brought into the strip", async ({
    page,
}) => {
    await open(page, 372);
    const hidden = await hiddenCount(page);
    expect(hidden).toBeGreaterThan(0);
    await findPath(page, "/ts0/button/overflow").click();
    const items = page.getByRole("menuitem");
    const last = items.last();
    const name = (await last.textContent()) ?? "";
    await last.click();
    const picked = tabs(page).filter({ hasText: name });
    await expect(picked).toHaveAttribute("aria-selected", "true");
    await expect(picked).toBeVisible();
    await expect(picked).not.toHaveAttribute("data-overflow-hidden");
    expect(await hiddenCount(page)).toBe(hidden); // another tab went to the menu in its place

    // widening shows everything again, with the selection kept
    await page.setViewportSize({ width: 1600, height: 600 });
    await expect.poll(() => hiddenCount(page)).toBe(0);
    await expect(picked).toHaveAttribute("aria-selected", "true");
});

test("a drop into a strip with hidden tabs lands between the visible ones", async ({
    page,
}) => {
    await open(page, 380);
    expect(await hiddenCount(page)).toBeGreaterThan(0);
    // "Other" onto the right half of Alpha: after it, before Bravo
    const alpha = findPath(page, "/ts0/tb0");
    await drag(page, findPath(page, "/ts1/tb0"), alpha, Location.RIGHT);
    await expect
        .poll(async () => (await tabs(page).allTextContents()).slice(0, 3))
        .toEqual(["Alpha", "Other", "Bravo"]);
});

/** the hidden count once it holds across two frames, or -1 while it still changes */
const settledHiddenCount = (page: Page) =>
    page.evaluate(async () => {
        const read = () =>
            document.querySelectorAll(
                '[data-layout-path="/ts0/tabstrip"] [data-overflow-hidden]',
            ).length;
        const before = read();
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return read() === before ? before : -1;
    });

test("switching tabs at the overflow boundary settles, with no update loop (caplin/FlexLayout#498, caplin/FlexLayout#517)", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    await open(page, 1600);
    // widths around the boundaries: no tab hidden, the first one hidden, several, all but one
    for (const width of [900, 640, 480, 360]) {
        await page.setViewportSize({ width, height: 600 });
        await expect
            .poll(() => settledHiddenCount(page))
            .toBeGreaterThanOrEqual(0);
        // the last visible tab, then a hidden one from the menu: each moves the boundary
        const visible = findPath(page, "/ts0/tabstrip").locator(
            '[role="tab"]:not([data-overflow-hidden])',
        );
        await visible.last().click();
        if ((await hiddenCount(page)) > 0) {
            await findPath(page, "/ts0/button/overflow").click();
            await page.getByRole("menuitem").first().click();
        }
        await expect
            .poll(() => settledHiddenCount(page), `settled at ${width}px`)
            .toBeGreaterThanOrEqual(0);
    }
    expect(errors).toEqual([]);
});
