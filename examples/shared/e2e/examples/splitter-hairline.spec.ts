import { expect, test } from "@playwright/test";
import { centre, openExample, path } from "../helpers";

test("a 1px splitter still grabs 3px from its line", async ({ page }) => {
    await openExample(page, "splitter-hairline");
    const splitter = path(page, "/s0");
    const box = await splitter.boundingBox();
    expect(box?.width).toBe(1);

    const tabset = path(page, "/ts0");
    const before = (await tabset.boundingBox())?.width ?? 0;
    const line = await centre(splitter);
    // press 3px to the right of the line: inside the ::after grab area, outside the element
    await page.mouse.move(line.x + 3, line.y);
    await page.mouse.down();
    await expect(splitter).toHaveAttribute("data-dragging", "");
    await page.mouse.move(line.x + 60, line.y, { steps: 6 });
    await page.mouse.move(line.x + 83, line.y, { steps: 3 });
    await page.mouse.up();
    await expect(splitter).not.toHaveAttribute("data-dragging");

    const after = (await tabset.boundingBox())?.width ?? 0;
    expect(after - before).toBeGreaterThan(60);
    expect(after - before).toBeLessThan(100);
});
