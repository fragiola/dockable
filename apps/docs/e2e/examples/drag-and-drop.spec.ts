import { expect, type Locator, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

const shadow = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).boxShadow);

test("drop into a tabset and at the layout's edge", async ({ page }) => {
    await openExample(page, "drag-and-drop");
    const root = path(page, "/layout");
    const indicator = path(page, "/outline");
    const target = path(page, "/r1/ts0");
    const idle = await shadow(target);

    // into a tabset: a "rect" drop in its centre; the dragged tab and the root are marked
    const dragged = path(page, "/ts0/tb1");
    await startDrag(page, dragged);
    await expect(root).toHaveAttribute("data-dragging", "");
    await expect(dragged).toHaveAttribute("data-dragging", "");
    await moveDragTo(page, await centre(path(page, "/r1/ts0/content")));
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAttribute("data-drop-kind", "rect");
    await expect(indicator).toHaveAttribute("data-drop-location", "center");
    // the target tabset is highlighted while it is the target
    expect(await shadow(target)).not.toBe(idle);
    await page.mouse.up();
    await expect(path(page, "/r1/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Inbox",
        "Or me",
    ]);
    await expect(root).not.toHaveAttribute("data-dragging");
    expect(await shadow(target)).toBe(idle);

    // at the layout's left edge: an "edge" drop makes a new tabset there
    const box = await root.boundingBox();
    if (!box) throw new Error("no root");
    await startDrag(page, path(page, "/ts0/tb0"));
    await moveDragTo(page, { x: box.x + 4, y: box.y + box.height / 2 });
    await expect(indicator).toHaveAttribute("data-drop-kind", "edge");
    await expect(indicator).toHaveAttribute("data-drop-location", "left");
    await page.mouse.up();
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Drag me",
    ]);
    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Me too",
    ]);
});
