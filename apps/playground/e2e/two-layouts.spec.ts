// Two independent layouts exchanging tabs through Dockable.DragGroup (Epic #20). Same page, so
// the drags are real mouse drags.
import { expect, type Page, test } from "@playwright/test";
import { drag, Location, waitForBox } from "./helpers";

const open = async (page: Page, query = "") => {
    await page.goto(`/fixtures/two-layouts/?layout=test_two_tabs${query}`);
    await waitForBox(
        page.getByTestId("layout-a").locator('[data-layout-path="/layout"]'),
        "layout a",
    );
    await waitForBox(
        page.getByTestId("layout-b").locator('[data-layout-path="/layout"]'),
        "layout b",
    );
};

const tabs = (page: Page, layout: "a" | "b") =>
    page.getByTestId(`layout-${layout}`).getByRole("tab");
const path = (page: Page, layout: "a" | "b", p: string) =>
    page.getByTestId(`layout-${layout}`).locator(`[data-layout-path="${p}"]`);

test("a tab dragged to the other layout moves there with its content state", async ({
    page,
}) => {
    await open(page);
    const panel = path(page, "a", "/ts0/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("counter").click();
    await panel.getByTestId("input").fill("kept");

    await drag(
        page,
        path(page, "a", "/ts0/tb0"),
        path(page, "b", "/ts1/t0"),
        Location.CENTER,
    );

    await expect(tabs(page, "a")).toHaveText(["Two"]);
    await expect(tabs(page, "b")).toHaveText(["One", "Two", "One"]);
    const moved = path(page, "b", "/ts1/t1");
    await expect(moved.getByTestId("counter")).toHaveText("Count: 2");
    await expect(moved.getByTestId("input")).toHaveValue("kept");
    await expect(page.getByTestId("last-transfer")).toHaveText("One:a->b");
});

test("and back again", async ({ page }) => {
    await open(page);
    await drag(
        page,
        path(page, "a", "/ts0/tb0"),
        path(page, "b", "/ts0/t0"),
        Location.CENTER,
    );
    await expect(tabs(page, "b")).toHaveText(["One", "One", "Two"]);
    await drag(
        page,
        path(page, "b", "/ts0/tb1"),
        path(page, "a", "/ts0/t0"),
        Location.CENTER,
    );
    await expect(tabs(page, "a")).toHaveText(["Two", "One"]);
    await expect(tabs(page, "b")).toHaveText(["One", "Two"]);
    await expect(page.getByTestId("last-transfer")).toHaveText("One:b->a");
});

test("without a drag group the layouts do not exchange tabs", async ({
    page,
}) => {
    await open(page, "&group=0");
    await drag(
        page,
        path(page, "a", "/ts0/tb0"),
        path(page, "b", "/ts1/t0"),
        Location.CENTER,
    );
    await expect(tabs(page, "a")).toHaveText(["One", "Two"]);
    await expect(tabs(page, "b")).toHaveText(["One", "Two"]);
});
