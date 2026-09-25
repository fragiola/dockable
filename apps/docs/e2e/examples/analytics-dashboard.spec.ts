import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("adding a widget adds a tab", async ({ page }) => {
    const stage = await openExample(page, "analytics-dashboard", {
        theme: "paper",
    });
    const tabs = stage.getByRole("tab");
    const before = await tabs.count();

    await stage.getByRole("button", { name: "Add widget" }).click();
    await page.getByRole("menuitem", { name: "Orders table" }).click();

    await expect(tabs).toHaveCount(before + 1);
    await expect(stage.getByRole("tab", { name: /^Orders/ })).toHaveCount(2);
    // undo takes it back
    await stage.getByRole("button", { name: "Undo" }).click();
    await expect(tabs).toHaveCount(before);
});

test("a KPI below its target turns its tab red", async ({ page }) => {
    const stage = await openExample(page, "analytics-dashboard", {
        theme: "paper",
    });
    const conversion = stage.getByRole("tab", { name: /Conversion/ });
    await expect(
        conversion.getByRole("img", { name: "Below target" }),
    ).toHaveCount(0);

    await stage.getByRole("combobox", { name: "Region" }).click();
    await page.getByRole("option", { name: "APAC" }).click();

    await expect(
        conversion.getByRole("img", { name: "Below target" }),
    ).toHaveCount(1);
});

test("a popped-out chart keeps its state", async ({ page, context }) => {
    const stage = await openExample(page, "analytics-dashboard", {
        theme: "paper",
    });
    const revenue = path(page, "/r0/ts0/t0");
    await revenue.getByRole("button", { name: "Bar" }).click();
    await expect(revenue.getByRole("button", { name: "Bar" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );

    const [popout] = await Promise.all([
        context.waitForEvent("page"),
        stage.getByRole("button", { name: "Pop out Revenue" }).click(),
    ]);
    await popout.waitForLoadState();

    // the same content, moved (not remounted): the chart is still a bar chart
    await expect(popout.getByRole("tab", { name: /Revenue/ })).toBeVisible();
    await expect(popout.getByRole("button", { name: "Bar" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(popout.locator('[data-slot="chart"] svg')).toBeVisible();
    await expect(stage.getByRole("tab", { name: /Revenue/ })).toHaveCount(0);
});
