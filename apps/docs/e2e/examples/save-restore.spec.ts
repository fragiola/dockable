import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("save, reset and restore bring the layout back", async ({ page }) => {
    await openExample(page, "save-restore");
    // the example's own toolbar (the shell has a Reset button too)
    const example = page.getByTestId("example-root");
    const value = async () =>
        Number(await path(page, "/s0").getAttribute("aria-valuenow"));
    const initial = await value();

    // change the layout: resize from the keyboard, select another tab
    await path(page, "/s0").focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect.poll(value).toBeGreaterThan(initial);
    await path(page, "/ts0/tb1").click();
    // the JSON panel shows model.toJson(): the whole layout, ids and weights included
    const json = page.getByTestId("layout-json");
    const saved = await json.textContent();

    await example.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("status")).toHaveText(
        "Saved to localStorage.",
    );

    await example.getByRole("button", { name: "Reset" }).click();
    await expect.poll(value).toBe(initial);
    await expect(path(page, "/ts0/tb0")).toHaveAttribute("data-selected", "");

    await example.getByRole("button", { name: "Restore" }).click();
    await expect(json).toHaveText(saved ?? "");
    await expect.poll(value).toBeGreaterThan(initial);
    await expect(path(page, "/ts0/tb1")).toHaveAttribute("data-selected", "");
});
