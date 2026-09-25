import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the Add menu creates tabs by component, mounted on demand", async ({
    page,
}) => {
    await openExample(page, "component-factory");
    const mounted = page.getByTestId("mounted");
    // only the selected tab of each tabset has rendered
    await expect(mounted).toHaveText("Content mounted for 2 of 5 tabs");
    await expect(path(page, "/ts0/t0").locator("svg").first()).toBeVisible();

    // showing a tab mounts its content (a table, from component + config)
    await path(page, "/ts0/tb2").click();
    await expect(mounted).toHaveText("Content mounted for 3 of 5 tabs");
    await expect(path(page, "/ts0/t2").getByRole("table")).toBeVisible();

    // Add › Table: a new tab, selected, with a table
    await path(page, "/ts1").getByRole("button", { name: "Add a tab" }).click();
    await page.getByRole("menuitem", { name: "Table" }).click();
    const added = path(page, "/ts1/tb2");
    await expect(added).toHaveText("Orders");
    await expect(added).toHaveAttribute("data-selected", "");
    await expect(path(page, "/ts1/t2").getByRole("table")).toBeVisible();
    await expect(mounted).toHaveText("Content mounted for 4 of 6 tabs");
});
