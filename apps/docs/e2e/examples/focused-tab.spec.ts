import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the active tabset's selected tab stands out, the others are dimmed", async ({
    page,
}) => {
    await openExample(page, "focused-tab");
    const editor = path(page, "/ts0/tb0");
    const outline = path(page, "/r1/ts0/tb0");
    const opacity = (locator: typeof editor) =>
        locator.evaluate((element) => getComputedStyle(element).opacity);

    await expect(path(page, "/ts0")).toHaveAttribute("data-active", "");
    await expect.poll(() => opacity(editor)).toBe("1");
    await expect.poll(() => opacity(outline)).toBe("0.6");

    // activating another tabset swaps them
    await outline.click();
    await expect(path(page, "/r1/ts0")).toHaveAttribute("data-active", "");
    await expect(path(page, "/ts0")).not.toHaveAttribute("data-active");
    await expect.poll(() => opacity(outline)).toBe("1");
    await expect.poll(() => opacity(editor)).toBe("0.6");
});
