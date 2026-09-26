import { expect, type Locator, test } from "@playwright/test";
import { openExample, path } from "../helpers";

const style = (locator: Locator) =>
    locator.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
            opacity: computed.opacity,
            outline: Number.parseFloat(computed.outlineWidth) || 0,
            outlineStyle: computed.outlineStyle,
        };
    });

test("the focused tab is at full opacity with a frame, every other tab is faded", async ({
    page,
}) => {
    await openExample(page, "focused-tab");
    const editor = path(page, "/ts0/tb0"); // selected, in the active tabset: focused
    const preview = path(page, "/ts0/tb1"); // the active tabset, not selected
    const outline = path(page, "/r1/ts0/tb0"); // selected, in another tabset

    await expect(path(page, "/ts0")).toHaveAttribute("data-active", "");
    await expect.poll(async () => (await style(editor)).opacity).toBe("1");
    expect((await style(editor)).outline).toBeGreaterThan(0);
    expect((await style(editor)).outlineStyle).toBe("solid");
    await expect
        .poll(async () => Number((await style(preview)).opacity))
        .toBeLessThan(1);
    await expect
        .poll(async () => Number((await style(outline)).opacity))
        .toBeLessThan(1);
    expect((await style(outline)).outlineStyle).toBe("none");

    // activating another tabset moves both the opacity and the frame
    await outline.click();
    await expect(path(page, "/r1/ts0")).toHaveAttribute("data-active", "");
    await expect(path(page, "/ts0")).not.toHaveAttribute("data-active");
    await expect.poll(async () => (await style(outline)).opacity).toBe("1");
    await page.mouse.move(0, 0); // away from the tabs
    await page
        .getByTestId("stage")
        .focus()
        .catch(() => {});
    expect((await style(outline)).outline).toBeGreaterThan(0);
    expect((await style(outline)).outlineStyle).not.toBe("none");
    await expect
        .poll(async () => Number((await style(editor)).opacity))
        .toBeLessThan(1);
});
