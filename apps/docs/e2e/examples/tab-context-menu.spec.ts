import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

const tabNames = (page: import("@playwright/test").Page, tabset: string) =>
    path(page, `${tabset}/tabstrip`).getByRole("tab");

test("the tab menu closes others, keeps unclosable tabs, and renames", async ({
    page,
}) => {
    await openExample(page, "tab-context-menu");
    const menu = page.getByRole("menu");

    // an unclosable tab has Close disabled
    await path(page, "/ts0/tb1").click({ button: "right" });
    await expect(
        menu.getByRole("menuitem", { name: "Close", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Close others on "Activity": only it and the unclosable "Settings" remain
    await path(page, "/ts0/tb2").click({ button: "right" });
    await menu.getByRole("menuitem", { name: "Close others" }).click();
    await expect(tabNames(page, "/ts0")).toHaveText(["Settings", "Activity"]);

    // Rename opens an inline field on the tab
    await path(page, "/ts0/tb1").click({ button: "right" });
    await menu.getByRole("menuitem", { name: "Rename" }).click();
    const field = page.getByRole("textbox", { name: "Tab name" });
    await expect(field).toBeFocused();
    await field.fill("Timeline");
    await field.press("Enter");
    await expect(tabNames(page, "/ts0")).toHaveText(["Settings", "Timeline"]);
});
