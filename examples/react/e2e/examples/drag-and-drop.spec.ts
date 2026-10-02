import { expect, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

test("drop into a tabset and at the layout's edge", async ({ page }) => {
    await openExample(page, "drag-and-drop");
    const root = path(page, "/layout");
    const indicator = path(page, "/outline");
    const target = path(page, "/r1/ts0");
    // the layer that outlines the target tabset above its panel
    const outline = target.locator(":scope > span[aria-hidden]");
    await expect(outline).toBeHidden();

    // into a tabset: a "rect" drop in its centre; the dragged tab and the root are marked
    const dragged = path(page, "/ts0/tb1");
    await startDrag(page, dragged);
    await expect(root).toHaveAttribute("data-dragging", "");
    await expect(dragged).toHaveAttribute("data-dragging", "");
    await moveDragTo(page, await centre(path(page, "/r1/ts0/content")));
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAttribute("data-drop-kind", "rect");
    await expect(indicator).toHaveAttribute("data-drop-location", "center");
    // the target tabset is marked, and outlined, while it is the target
    await expect(target).toHaveAttribute("data-drop-target", "");
    await expect(target).toHaveAttribute("data-drop-location", "center");
    await expect(outline).toBeVisible();
    await expect(
        path(page, "/r1/ts1").locator(":scope > span[aria-hidden]"),
    ).toBeHidden();
    await page.mouse.up();
    await expect(path(page, "/r1/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Inbox",
        "Or me",
    ]);
    await expect(root).not.toHaveAttribute("data-dragging");
    await expect(outline).toBeHidden();

    // at the layout's start edge (left in LTR): an "edge" drop makes a new tabset there
    const box = await root.boundingBox();
    if (!box) throw new Error("no root");
    await startDrag(page, path(page, "/ts0/tb0"));
    await moveDragTo(page, { x: box.x + 4, y: box.y + box.height / 2 });
    await expect(indicator).toHaveAttribute("data-drop-kind", "edge");
    await expect(indicator).toHaveAttribute("data-drop-location", "start");
    // the edge indicators show during the drag; the start one is the target
    await expect(path(page, "/edge/top")).toHaveAttribute("data-visible", "");
    await expect(path(page, "/edge/start")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    await page.mouse.up();
    await expect(path(page, "/edge/start")).toBeHidden();
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Drag me",
    ]);
    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Me too",
    ]);
});
