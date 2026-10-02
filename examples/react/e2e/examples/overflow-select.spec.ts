import { expect, type Locator, type Page, test } from "@playwright/test";
import { centre, dragTo, openExample, path } from "../helpers";

// by attribute: getByRole skips the hidden (display: none) tabs
const tabs = (page: Page, tabset = "/ts0") =>
    path(page, `${tabset}/tabstrip`).locator('[role="tab"]');
const hiddenCount = (page: Page) =>
    path(page, "/ts0/tabstrip").locator("[data-overflow-hidden]").count();
const trigger = (page: Page) => path(page, "/ts0/button/overflow");
/** narrows the stage itself: the viewport would also reflow the examples browser around it */
const stageWidth = (page: Page, width: number) =>
    page.getByTestId("stage").evaluate((stage, value) => {
        (stage as HTMLElement).style.maxWidth = `${value}px`;
    }, width);
const scrolls = (strip: Locator) =>
    strip.evaluate((list) => list.scrollWidth > list.clientWidth);
/** the tab's box lies inside its strip's box: it is scrolled into view */
const inView = (tab: Locator) =>
    tab.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const list = element
            .closest('[role="tablist"]')
            ?.getBoundingClientRect();
        return (
            list !== undefined &&
            box.left >= list.left - 1 &&
            box.right <= list.right + 1
        );
    });

test("tabs leave the strip one by one as it narrows, and a picked tab comes back into it", async ({
    page,
}) => {
    // wide: all twelve tabs, no trigger
    await page.setViewportSize({ width: 2600, height: 720 });
    await openExample(page, "overflow-select");
    await expect(tabs(page)).toHaveCount(12);
    expect(await hiddenCount(page)).toBe(0);
    await expect(trigger(page)).toHaveCount(0);

    // narrowing: the hidden count only grows, and visible + hidden is always the twelve tabs
    let previous = 0;
    for (let width = 1600; width >= 200; width -= 40) {
        await stageWidth(page, width);
        await page.waitForTimeout(50);
        const hidden = await hiddenCount(page);
        expect(hidden, `hidden at ${width}px`).toBeGreaterThanOrEqual(previous);
        previous = hidden;
        await expect(tabs(page)).toHaveCount(12);
        await expect(path(page, "/ts0/tb0")).toBeVisible(); // the selected tab stays
    }
    // very narrow: the trigger and the selected tab only
    expect(previous).toBe(11);
    await expect(trigger(page)).toBeVisible();
    await expect(trigger(page)).toHaveText(/\+11/);

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
    await stageWidth(page, 2600);
    await expect.poll(() => hiddenCount(page)).toBe(0);
    await expect(trigger(page)).toHaveCount(0);
    await expect(picked).toHaveAttribute("data-selected", "");
});

test("at 1600px both strips overflow: the editor's into the select, the tools' by scrolling", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 720 });
    await openExample(page, "overflow-select");

    // the editor: +N, and the select lists exactly the hidden tabs
    await expect.poll(() => hiddenCount(page)).toBeGreaterThan(0);
    const hidden = await path(page, "/ts0/tabstrip")
        .locator("[data-overflow-hidden]")
        .allTextContents();
    await expect(trigger(page)).toHaveText(`+${hidden.length}`);
    await trigger(page).click();
    await expect(page.getByRole("option")).toHaveText(hidden);
    await page.keyboard.press("Escape");

    // the tools: every tab kept, no trigger, and the strip scrolls
    const strip = path(page, "/ts1/tabstrip");
    await expect.poll(() => scrolls(strip)).toBe(true);
    await expect(tabs(page, "/ts1")).toHaveCount(10);
    await expect(strip.locator("[data-overflow-hidden]")).toHaveCount(0);
    await expect(path(page, "/ts1/button/overflow")).toHaveCount(0);

    // the last tab is off-screen; selected by a click that does not scroll (no focus, no
    // actionability scroll), it scrolls itself into view
    const last = tabs(page, "/ts1").last();
    expect(await inView(last)).toBe(false);
    await last.dispatchEvent("click");
    await expect(last).toHaveAttribute("data-selected", "");
    await expect.poll(() => inView(last)).toBe(true);

    // from the keyboard: Home selects the first tab, scrolled back into view
    await last.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    const first = tabs(page, "/ts1").first();
    await expect(first).toHaveAttribute("data-selected", "");
    await expect.poll(() => inView(first)).toBe(true);
});

test("a tab dragged between the two tabsets takes the behaviour of the strip it lands in", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 720 });
    await openExample(page, "overflow-select");

    // a tools tab into the editor: selected, so it stays in the strip, and the select grows
    const before = await hiddenCount(page);
    await dragTo(
        page,
        path(page, "/ts1/tb0"),
        await centre(path(page, "/ts0/content")),
    );
    await expect(tabs(page)).toHaveCount(13);
    const terminal = tabs(page).filter({ hasText: "Terminal" });
    await expect(terminal).toHaveAttribute("data-selected", "");
    await expect(terminal).toBeVisible();
    await expect.poll(() => hiddenCount(page)).toBeGreaterThan(before);

    // an editor tab into the tools: appended, selected, scrolled into view, nothing hidden
    await dragTo(
        page,
        path(page, "/ts0/tb1"),
        await centre(path(page, "/ts1/content")),
    );
    await expect(tabs(page, "/ts1")).toHaveCount(10);
    const moved = tabs(page, "/ts1").last();
    await expect(moved).toHaveText("App.tsx");
    await expect(moved).toHaveAttribute("data-selected", "");
    await expect.poll(() => inView(moved)).toBe(true);
    await expect(
        path(page, "/ts1/tabstrip").locator("[data-overflow-hidden]"),
    ).toHaveCount(0);
});
