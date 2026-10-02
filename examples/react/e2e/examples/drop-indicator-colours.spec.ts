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

    // into Review: the same fill in another region's colour
    await moveDragTo(page, await centre(path(page, "/r0/ts1/content")));
    await expect(path(page, "/r0/ts1")).toHaveAttribute("data-drop-target", "");
    await expect(indicator).toHaveAttribute("data-drop-location", "center");
    const review = await background(indicator);
    expect(review).not.toBe(inbox);

    // beside Archive, on its start side: the archive colour, another fill
    const box = await path(page, "/r1/ts0/content").boundingBox();
    if (!box) throw new Error("no box");
    await moveDragTo(page, {
        x: box.x + 12,
        y: box.y + box.height / 2,
    });
    await expect(path(page, "/r1/ts0")).toHaveAttribute("data-drop-target", "");
    await expect(indicator).toHaveAttribute("data-drop-location", "start");
    const archive = await background(indicator);
    expect(archive).not.toBe(inbox);
    expect(archive).not.toBe(review);

    // at the layout's edge: an edge drop, in the edge colour
    const root = await path(page, "/layout").boundingBox();
    if (!root) throw new Error("no box");
    await moveDragTo(page, { x: root.x + 4, y: root.y + root.height / 2 });
    await expect(indicator).toHaveAttribute("data-drop-kind", "edge");

    await page.mouse.up();
    await expect(indicator).toBeHidden();
});
