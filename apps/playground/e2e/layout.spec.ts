import { expect, type Page, test } from "@playwright/test";
import { checkTab, findPath, findTabButton, waitForBox } from "./helpers";

const open = async (page: Page, layout: string, extra = "") => {
    await page.goto(`/fixtures/basic/?layout=${layout}${extra}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

/** the panel of the selected tab sits exactly over its tabset's content area */
async function expectPanelOverContent(
    page: Page,
    tabsetPath: string,
    tabIndex: number,
) {
    const content = await waitForBox(
        findPath(page, `${tabsetPath}/content`),
        `${tabsetPath}/content`,
    );
    const panel = await waitForBox(
        findPath(page, `${tabsetPath}/t${tabIndex}`),
        `${tabsetPath}/t${tabIndex}`,
    );
    expect(Math.abs(panel.x - content.x)).toBeLessThan(1);
    expect(Math.abs(panel.y - content.y)).toBeLessThan(1);
    expect(Math.abs(panel.width - content.width)).toBeLessThan(1);
    expect(Math.abs(panel.height - content.height)).toBeLessThan(1);
}

test.describe("static layout", () => {
    test("two tabsets render, with each panel over its content area", async ({
        page,
    }) => {
        await open(page, "test_two_tabs");
        await expect(page.locator('[role="tablist"]')).toHaveCount(2);
        await checkTab(page, "/ts0", 0, true, "One");
        await checkTab(page, "/ts1", 0, true, "Two");
        await expectPanelOverContent(page, "/ts0", 0);
        await expectPanelOverContent(page, "/ts1", 0);
    });

    test("three tabsets render, with each panel over its content area", async ({
        page,
    }) => {
        await open(page, "test_three_tabs");
        await expect(page.locator('[role="tablist"]')).toHaveCount(3);
        for (const [i, name] of ["One", "Two", "Three"].entries()) {
            await checkTab(page, `/ts${i}`, 0, true, name);
            await expectPanelOverContent(page, `/ts${i}`, 0);
        }
    });

    test("a window resize re-positions the panels", async ({ page }) => {
        await open(page, "test_three_tabs");
        const before = await waitForBox(findPath(page, "/ts2/t0"), "/ts2/t0");
        await page.setViewportSize({ width: 900, height: 500 });
        await expect
            .poll(
                async () => (await findPath(page, "/ts2/t0").boundingBox())?.x,
            )
            .not.toBe(before.x);
        for (const i of [0, 1, 2]) {
            await expectPanelOverContent(page, `/ts${i}`, 0);
        }
    });

    test("tab selection by click", async ({ page }) => {
        await open(page, "multi");
        await checkTab(page, "/ts0", 0, true, "One");
        await findTabButton(page, "/ts0", 2).click();
        await checkTab(page, "/ts0", 2, true, "Three");
        await checkTab(page, "/ts0", 0, false, "One");
        await expectPanelOverContent(page, "/ts0", 2);
    });

    test("tab selection by keyboard: arrows, Home and End move focus, Enter and Space select", async ({
        page,
    }) => {
        await open(page, "multi");
        const tb0 = findTabButton(page, "/ts0", 0);
        const tb1 = findTabButton(page, "/ts0", 1);
        const tb2 = findTabButton(page, "/ts0", 2);

        await tb0.focus();
        await page.keyboard.press("ArrowRight");
        await expect(tb1).toBeFocused();
        await checkTab(page, "/ts0", 0, true, "One"); // manual activation: focus only
        await page.keyboard.press("Enter");
        await checkTab(page, "/ts0", 1, true, "Two");

        await page.keyboard.press("End");
        await expect(tb2).toBeFocused();
        await page.keyboard.press(" ");
        await checkTab(page, "/ts0", 2, true, "Three");

        await page.keyboard.press("Home");
        await expect(tb0).toBeFocused();
        await page.keyboard.press("ArrowLeft"); // no wrap
        await expect(tb0).toBeFocused();
    });

    test("ctrl+delete closes the focused tab and focus moves to the neighbour", async ({
        page,
    }) => {
        await open(page, "multi");
        const tb0 = findTabButton(page, "/ts0", 0);
        await tb0.focus();
        await page.keyboard.press("Delete"); // plain delete does nothing
        await checkTab(page, "/ts0", 0, true, "One");
        await page.keyboard.press("Control+Delete");
        await checkTab(page, "/ts0", 0, true, "Two");
        await expect(findTabButton(page, "/ts0", 0)).toBeFocused();
    });

    test("panel content keeps its state through selection changes", async ({
        page,
    }) => {
        await open(page, "multi");
        const panel = findPath(page, "/ts0/t0");
        await panel.getByTestId("counter").click();
        await panel.getByTestId("input").fill("kept");
        await findTabButton(page, "/ts0", 1).click();
        await findTabButton(page, "/ts0", 0).click();
        await expect(panel.getByTestId("counter")).toHaveText("Count: 1");
        await expect(panel.getByTestId("input")).toHaveValue("kept");
    });
});
