import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("a wide splitter shows its aria-valuenow while resized", async ({
    page,
}) => {
    await openExample(page, "splitter-wide");
    const splitter = path(page, "/s0");
    const box = await splitter.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(10);
    await expect(splitter).toHaveAttribute("aria-label", "Resize");

    const before = Number(await splitter.getAttribute("aria-valuenow"));
    await splitter.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect
        .poll(async () => Number(await splitter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(before);

    // the readout shows the same value the separator announces
    const readout = splitter.getByTestId("splitter-readout");
    await expect(readout).toBeVisible();
    await expect(readout).toHaveText(
        (await splitter.getAttribute("aria-valuetext")) ?? "",
    );
});
