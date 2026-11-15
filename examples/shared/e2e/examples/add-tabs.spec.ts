import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the toolbar adds tabs to the active tabset or a new one", async ({
    page,
}) => {
    const stage = await openExample(page, "add-tabs");
    const tabs = (layoutPath: string) =>
        path(page, layoutPath).locator('[role="tab"]');

    // into the active tabset (the first one, until another is activated)
    await page.getByRole("button", { name: "New chart" }).click();
    await expect(tabs("/ts0")).toHaveText(["Revenue", "Orders", "Chart 1"]);
    await expect(path(page, "/ts0/tb2")).toHaveAttribute("data-selected", "");

    // into a new tabset docked on the right of the layout
    await page.getByTestId("target").click();
    await page.getByRole("option", { name: "New tabset on the right" }).click();
    await page.getByRole("button", { name: "New table" }).click();
    await expect(tabs("/ts1")).toHaveText(["Table 2"]);
    const left = await path(page, "/ts0").boundingBox();
    const right = await path(page, "/ts1").boundingBox();
    expect(right?.x ?? 0).toBeGreaterThan(left?.x ?? 0);

    // and at the bottom: the root row now holds a column
    await page.getByTestId("target").click();
    await page
        .getByRole("option", { name: "New tabset at the bottom" })
        .click();
    await page.getByRole("button", { name: "New log" }).click();
    await expect(
        stage.locator('[role="tab"]', { hasText: "Log 3" }),
    ).toHaveAttribute("data-selected", "");
    await expect(stage.locator('[role="tablist"]')).toHaveCount(3);
});
