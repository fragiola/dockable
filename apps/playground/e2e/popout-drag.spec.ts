// Cross-window drag and drop, popout of whole tabsets, the popout trigger and root attribute
// mirroring (Epic #20). The drag cases are ported from FlexLayout (https://github.com/caplin/FlexLayout),
// tests-playwright/popout-drag.spec.ts: HTML5 drag and drop cannot be driven across windows with the
// mouse, so they use synthetic drag events. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
    dragAcrossWindows,
    findPath,
    findTabButton,
    Location,
    waitForBox,
    waitForPopout,
} from "./helpers";

const open = async (page: Page, layout = "test_two_tabs") => {
    await page.goto(`/fixtures/popout/?layout=${layout}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

/** pops out the selected tab of the main tabset at `path` with its trigger */
async function popOut(page: Page, context: BrowserContext, path: string) {
    await findPath(page, path).getByTestId("popout-tab").click();
    const popout = await waitForPopout(context, page);
    await popout.waitForLoadState();
    await expect(popout.getByRole("tab")).not.toHaveCount(0);
    return popout;
}

const popoutCount = (context: BrowserContext, page: Page) =>
    context.pages().filter((p) => p !== page && !p.isClosed()).length;

test("drag a tab to a popout window and back", async ({ page, context }) => {
    await open(page, "test_three_tabs");
    const popout = await popOut(page, context, "/ts2"); // "Three" goes to a window
    await expect(page.getByRole("tab")).toHaveText(["One", "Two"]);

    // "One" joins "Three" in the window
    await dragAcrossWindows(
        findTabButton(page, "/ts0", 0),
        popout,
        popout.getByRole("tabpanel").first(),
        Location.CENTER,
    );
    await expect(popout.getByRole("tab")).toHaveText(["Three", "One"]);
    await expect(page.getByRole("tab")).toHaveText(["Two"]);

    // and back into the main layout's tabset
    await dragAcrossWindows(
        popout.getByRole("tab", { name: "One" }),
        page,
        findPath(page, "/ts0/t0"),
        Location.CENTER,
    );
    await expect(page.getByRole("tab")).toHaveText(["Two", "One"]);
    await expect(popout.getByRole("tab")).toHaveText(["Three"]);
});

test("drag a tabset to a popout window and back", async ({ page, context }) => {
    await open(page, "test_three_tabs");
    const popout = await popOut(page, context, "/ts2");

    // the whole /ts1 tabset (its handle) merges into the window's tabset
    await dragAcrossWindows(
        findPath(page, "/ts1").getByTestId("tabset-handle"),
        popout,
        popout.getByRole("tabpanel").first(),
        Location.CENTER,
    );
    await expect(popout.getByRole("tab")).toHaveText(["Three", "Two"]);
    await expect(page.getByRole("tab")).toHaveText(["One"]);

    // the window's tabset back into the main layout: emptying the window closes it
    await dragAcrossWindows(
        popout.getByTestId("tabset-handle"),
        page,
        findPath(page, "/ts0/t0"),
        Location.CENTER,
    );
    await expect.poll(() => popoutCount(context, page)).toBe(0);
    await expect(page.getByRole("tab")).toHaveText(["One", "Three", "Two"]);
});

test("the target window shows the drop indicator during a cross-window drag", async ({
    page,
    context,
}) => {
    await open(page, "test_three_tabs");
    const popout = await popOut(page, context, "/ts2");
    await dragAcrossWindows(
        findTabButton(page, "/ts0", 0),
        popout,
        popout.getByRole("tabpanel").first(),
        Location.CENTER,
        { drop: false },
    );
    await expect(popout.locator('[data-layout-path="/outline"]')).toBeVisible();
    await expect(
        popout.locator('[data-layout-path="/outline"]'),
    ).toHaveAttribute("data-drop-location", "center");
});

test("PopoutTrigger pops a tab out, and docks it back from the window", async ({
    page,
    context,
}) => {
    await open(page);
    const trigger = findPath(page, "/ts1").getByTestId("popout-tab");
    await expect(trigger).toHaveAttribute("data-mode", "popout");
    const popout = await popOut(page, context, "/ts1");
    await expect(page.getByRole("tab")).toHaveText(["One"]);

    const dock = popout.getByTestId("popout-tab");
    await expect(dock).toHaveAttribute("data-mode", "dock");
    // the click empties the window, which closes it: fire it without waiting on the closing page
    await dock.evaluate((button) => {
        setTimeout(() => (button as HTMLElement).click(), 0);
    });
    await expect.poll(() => popoutCount(context, page)).toBe(0);
    await expect(page.getByRole("tab")).toHaveText(["One", "Two"]);
});

test("PopoutTrigger pops a whole tabset out", async ({ page, context }) => {
    await open(page, "test_three_tabs");
    // move "Two" next to "One" so /ts0 holds two tabs
    await dragAcrossWindows(
        findTabButton(page, "/ts1", 0),
        page,
        findPath(page, "/ts0/t0"),
        Location.CENTER,
    );
    await expect(findPath(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "One",
        "Two",
    ]);
    await findPath(page, "/ts0").getByTestId("popout-tabset").click();
    const popout = await waitForPopout(context, page);
    await popout.waitForLoadState();
    await expect(popout.getByRole("tab")).toHaveText(["One", "Two"]);
    await expect(page.getByRole("tab")).toHaveText(["Three"]);
});

test("the popout mirrors the main document's root attributes and follows their changes", async ({
    page,
    context,
}) => {
    await open(page);
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.classList.add("app-theme");
    });
    const popout = await popOut(page, context, "/ts1");
    await expect(popout.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(popout.locator("body")).toHaveClass(/app-theme/);

    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
    });
    await expect(popout.locator("html")).toHaveAttribute("data-theme", "light");
});
