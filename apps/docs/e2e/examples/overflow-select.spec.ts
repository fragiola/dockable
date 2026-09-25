import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("a narrow stage swaps the strip for a select, and back", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openExample(page, "overflow-select");
    const strip = path(page, "/ts0/tabstrip");
    const select = page
        .getByTestId("stage")
        .getByRole("combobox", { name: "Open tab" });
    await expect(strip).toBeVisible();
    await expect(select).toHaveCount(0);

    // shrink: the tabs no longer fit
    await page.setViewportSize({ width: 900, height: 720 });
    await expect(select).toBeVisible();
    await expect(strip).toBeHidden();
    await expect(select).toHaveText(/main\.ts/);

    // choosing an option selects that tab
    await select.click();
    await page.getByRole("option", { name: "api.ts" }).click();
    await expect(path(page, "/ts0/tb4")).toHaveAttribute("data-selected", "");
    await expect(select).toHaveText(/api\.ts/);
    await expect(path(page, "/ts0/t4")).toBeVisible();

    // widen: the tabs come back, with the selection kept
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(strip).toBeVisible();
    await expect(select).toHaveCount(0);
    await expect(path(page, "/ts0/tb4")).toHaveAttribute("data-selected", "");
});
