import { expect, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

test("the targeted tabset and side are marked, one at a time", async ({
    page,
}) => {
    await openExample(page, "drop-target-highlight");
    const targets = page
        .getByTestId("stage")
        .locator("[data-drop-target][data-drop-location]");

    await startDrag(page, path(page, "/ts0/tb0"));
    await moveDragTo(page, await centre(path(page, "/r1/ts0/content")));
    await expect(targets).toHaveCount(1);
    await expect(path(page, "/r1/ts0")).toHaveAttribute(
        "data-drop-location",
        "center",
    );

    const box = await path(page, "/r1/ts1/content").boundingBox();
    if (!box) throw new Error("no box");
    await moveDragTo(page, { x: box.x + 8, y: box.y + box.height / 2 });
    await expect(targets).toHaveCount(1);
    await expect(path(page, "/r1/ts1")).toHaveAttribute(
        "data-drop-location",
        "left",
    );

    await page.mouse.up();
    await expect(targets).toHaveCount(0);
});

test("a strip drop marks the tab list with the insertion index", async ({
    page,
}) => {
    await openExample(page, "drop-target-highlight");
    const strip = path(page, "/r1/ts0/tabstrip");
    const first = await path(page, "/r1/ts0/tb0").boundingBox();
    if (!first) throw new Error("no box");
    await startDrag(page, path(page, "/ts0/tb0"));
    await moveDragTo(page, {
        x: first.x + first.width + 20,
        y: first.y + first.height / 2,
    });
    await expect(strip).toHaveAttribute("data-drop-target", "");
    await expect(strip).toHaveAttribute("data-drop-index", /^[12]$/);
    await page.mouse.up();
    await expect(strip).not.toHaveAttribute("data-drop-target");
});
