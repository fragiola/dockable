import { expect, type Locator, test } from "@playwright/test";
import { openExample, path } from "../helpers";

const colours = (tab: Locator) =>
    tab.evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.color} / ${style.backgroundColor}`;
    });

test("the content's status changes its tab's colour", async ({ page }) => {
    await openExample(page, "content-aware-tabs");
    const tab = path(page, "/ts0/tb0");
    await expect(tab).toHaveAttribute("data-status", "healthy");
    const healthy = await colours(tab);

    await path(page, "/ts0/t0").getByRole("button", { name: "Down" }).click();
    await expect(tab).toHaveAttribute("data-status", "down");
    await expect.poll(() => colours(tab)).not.toBe(healthy);
    await expect(tab.getByLabel("1 incidents")).toBeVisible();

    await path(page, "/ts0/t0")
        .getByRole("button", { name: "Healthy" })
        .click();
    await expect(tab).toHaveAttribute("data-status", "healthy");
    await expect.poll(() => colours(tab)).toBe(healthy);
});

test("a dirty editor marks its tab as modified until saved", async ({
    page,
}) => {
    await openExample(page, "content-aware-tabs");
    const tab = path(page, "/ts1/tb0");
    const panel = path(page, "/ts1/t0");
    await expect(tab).not.toHaveAttribute("data-modified");

    await panel.getByRole("textbox").fill("# Changed");
    await expect(tab).toHaveAttribute("data-modified", "");
    await expect(tab.getByText("Modified")).toBeAttached();

    await panel.getByRole("button", { name: "Save" }).click();
    await expect(tab).not.toHaveAttribute("data-modified");
});
