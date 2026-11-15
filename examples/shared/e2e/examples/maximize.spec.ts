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

test("a maximized tabset fills the layout, whatever its nesting, and restoring brings the weights back", async ({
    page,
}) => {
    await openExample(page, "maximize");
    const row = path(page, "/row");
    const rowBox = await row.boundingBox();
    if (!rowBox) throw new Error("no root row");
    for (const tabset of ["/ts0", "/r1/ts0", "/r1/ts1"]) {
        const target = path(page, tabset);
        const before = await target.boundingBox();
        await target.getByRole("button", { name: "Maximize" }).click();
        await expect(target).toHaveAttribute("data-maximized", "");
        await expect
            .poll(async () => {
                const box = await target.boundingBox();
                return box
                    ? Math.max(
                          Math.abs(box.x - rowBox.x),
                          Math.abs(box.y - rowBox.y),
                          Math.abs(box.width - rowBox.width),
                          Math.abs(box.height - rowBox.height),
                      )
                    : Number.POSITIVE_INFINITY;
            }, `${tabset} fills the root row`)
            .toBeLessThanOrEqual(1);
        await page.keyboard.press("Escape");
        await expect(target).not.toHaveAttribute("data-maximized");
        await expect
            .poll(async () => (await target.boundingBox())?.width)
            .toBeCloseTo(before?.width ?? 0, 0);
    }
});
