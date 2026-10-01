import { expect, test } from "@playwright/test";
import { centre, openExample, path } from "../helpers";

test("the splitter resizes by mouse and keyboard, both ways", async ({
    page,
}) => {
    await openExample(page, "splitter-framed-handle");

    // side by side: the bar between the column and the row of two
    const vertical = path(page, "/s0");
    await expect(vertical).toHaveAttribute("data-orientation", "vertical");
    await expect(vertical).toHaveAttribute("aria-label", "Resize");
    expect((await vertical.boundingBox())?.width).toBe(8);
    const tabset = path(page, "/ts0");
    const before = (await tabset.boundingBox())?.width ?? 0;
    const start = await centre(vertical);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(vertical).toHaveAttribute("data-dragging", "");
    await page.mouse.move(start.x + 60, start.y, { steps: 6 });
    await page.mouse.up();
    await expect(vertical).not.toHaveAttribute("data-dragging");
    expect(((await tabset.boundingBox())?.width ?? 0) - before).toBeGreaterThan(
        40,
    );

    // stacked: the bar inside the row of two, moved from the keyboard
    const horizontal = path(page, "/r1/s0");
    await expect(horizontal).toHaveAttribute("data-orientation", "horizontal");
    const value = Number(await horizontal.getAttribute("aria-valuenow"));
    await horizontal.focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect
        .poll(async () =>
            Number(await horizontal.getAttribute("aria-valuenow")),
        )
        .not.toBe(value);
});
