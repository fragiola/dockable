import { expect, type Locator, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

const background = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor);

test("the indicator takes the target region's colour and the drop's side", async ({
    page,
}) => {
    await openExample(page, "drop-indicator-colours");
    const indicator = path(page, "/outline");

    // drag "Churn", out of Trash
    await startDrag(page, path(page, "/r1/ts1/tb0"));

    // into Inbox: the inbox colour, filled
    await moveDragTo(page, await centre(path(page, "/r0/ts0/content")));
    await expect(indicator).toBeVisible();
    await expect(path(page, "/r0/ts0")).toHaveAttribute("data-drop-target", "");
    await expect(indicator).toHaveAttribute("data-drop-location", "center");
    const inbox = await background(indicator);

    // beside Archive, on its left: the archive colour, another fill
    const archive = await path(page, "/r1/ts0/content").boundingBox();
    if (!archive) throw new Error("no box");
    await moveDragTo(page, {
        x: archive.x + 12,
        y: archive.y + archive.height / 2,
    });
    await expect(path(page, "/r1/ts0")).toHaveAttribute("data-drop-target", "");
    await expect(indicator).toHaveAttribute("data-drop-location", "left");
    expect(await background(indicator)).not.toBe(inbox);

    // at the layout's edge: an edge drop, in the edge colour
    const root = await path(page, "/layout").boundingBox();
    if (!root) throw new Error("no box");
    await moveDragTo(page, { x: root.x + 4, y: root.y + root.height / 2 });
    await expect(indicator).toHaveAttribute("data-drop-kind", "edge");

    await page.mouse.up();
    await expect(indicator).toBeHidden();
});
