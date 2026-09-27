import { expect, type Page, test } from "@playwright/test";
import { openExample, path } from "../helpers";

// by attribute: getByRole skips the hidden (display: none) tabs
const tabs = (page: Page) =>
    path(page, "/ts0/tabstrip").locator('[role="tab"]');
const hiddenCount = (page: Page) =>
    path(page, "/ts0/tabstrip").locator("[data-overflow-hidden]").count();
const trigger = (page: Page) => path(page, "/ts0/button/overflow");
/** narrows the stage itself: the viewport would also reflow the examples browser around it */
const stageWidth = (page: Page, width: number) =>
    page.getByTestId("stage").evaluate((stage, value) => {
        (stage as HTMLElement).style.maxWidth = `${value}px`;
    }, width);

test("tabs leave the strip one by one as it narrows, and a picked tab comes back into it", async ({
    page,
}) => {
    // wide: all six tabs, no trigger
    await page.setViewportSize({ width: 1600, height: 720 });
    await openExample(page, "overflow-select");
    await expect(tabs(page)).toHaveCount(6);
    expect(await hiddenCount(page)).toBe(0);
    await expect(trigger(page)).toHaveCount(0);

    // narrowing: the hidden count only grows, and visible + hidden is always the six tabs
    let previous = 0;
    for (let width = 1200; width >= 200; width -= 40) {
        await stageWidth(page, width);
        await page.waitForTimeout(50);
        const hidden = await hiddenCount(page);
        expect(hidden, `hidden at ${width}px`).toBeGreaterThanOrEqual(previous);
        previous = hidden;
        await expect(tabs(page)).toHaveCount(6);
        await expect(path(page, "/ts0/tb0")).toBeVisible(); // the selected tab stays
    }
    // very narrow: the trigger and the selected tab only
    expect(previous).toBe(5);
    await expect(trigger(page)).toBeVisible();
    await expect(trigger(page)).toHaveText(/\+5/);

    // a middle width: pick a hidden tab from the select
    await stageWidth(page, 700);
    await expect.poll(() => hiddenCount(page)).toBeGreaterThan(0);
    const before = await hiddenCount(page);
    await trigger(page).click();
    const option = page.getByRole("option").last();
    const name = ((await option.textContent()) ?? "").trim();
    await option.click();
    const picked = tabs(page).filter({ hasText: name });
    await expect(picked).toHaveAttribute("data-selected", "");
    await expect(picked).toBeVisible();
    await expect(picked).not.toHaveAttribute("data-overflow-hidden");
    // another tab (or two, when the picked one is wider) went to the select in its place
    expect(await hiddenCount(page)).toBeGreaterThanOrEqual(before);

    // widening: every tab back, with the selection kept
    await stageWidth(page, 1600);
    await expect.poll(() => hiddenCount(page)).toBe(0);
    await expect(trigger(page)).toHaveCount(0);
    await expect(picked).toHaveAttribute("data-selected", "");
});
