import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("maximize by button and double-click, restore with Escape", async ({
    page,
}) => {
    await openExample(page, "maximize");
    const root = path(page, "/layout");
    const target = path(page, "/r1/ts0");

    // the header button
    await target.getByRole("button", { name: "Maximize" }).click();
    await expect(target).toHaveAttribute("data-maximized", "");
    await expect(root).toHaveAttribute("data-maximized", "");
    await expect(path(page, "/ts0")).toBeHidden();
    await expect(path(page, "/s0")).toBeHidden();
    await expect(
        target.getByRole("button", { name: "Restore" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Escape restores
    await page.keyboard.press("Escape");
    await expect(root).not.toHaveAttribute("data-maximized");
    await expect(path(page, "/ts0")).toBeVisible();
    await expect(path(page, "/s0")).toBeVisible();

    // a double-click on the empty part of the strip toggles
    const strip = path(page, "/ts0/tabstrip");
    const box = await strip.boundingBox();
    if (!box) throw new Error("no strip");
    await strip.dblclick({
        position: { x: box.width - 12, y: box.height / 2 },
    });
    await expect(path(page, "/ts0")).toHaveAttribute("data-maximized", "");
    await strip.dblclick({
        position: { x: box.width - 12, y: box.height / 2 },
    });
    await expect(root).not.toHaveAttribute("data-maximized");
});
