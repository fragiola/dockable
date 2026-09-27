import { expect, type Locator, test } from "@playwright/test";
import { openExample, path } from "../helpers";

const writingMode = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).writingMode);

test("a side border's labels read vertically by default, and upright with other classes", async ({
    page,
}) => {
    const stage = await openExample(page, "border-tab-orientation");
    const outline = path(page, "/border/left/tb0");
    const notes = path(page, "/border/right/tb0");
    await expect.poll(() => writingMode(outline)).toBe("vertical-rl");
    await expect.poll(() => writingMode(notes)).toBe("vertical-rl");

    await stage.getByTestId("labels-horizontal").click();
    await expect.poll(() => writingMode(outline)).toBe("horizontal-tb");
    await expect.poll(() => writingMode(notes)).toBe("horizontal-tb");
    // the strip grew to fit the upright labels
    const strip = await path(page, "/border/left").boundingBox();
    expect(strip?.width ?? 0).toBeGreaterThan(60);

    // the tabs still open their panels
    await path(page, "/border/left/tb1").click();
    await expect(path(page, "/border/left/tb1")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(path(page, "/border/left/t1")).toBeVisible();

    await stage.getByTestId("labels-vertical").click();
    await expect.poll(() => writingMode(outline)).toBe("vertical-rl");
});
