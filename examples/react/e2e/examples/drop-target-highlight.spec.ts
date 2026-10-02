import { expect, type Page, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

/** the layer a tabset fills, above its panel, while it is the drop target */
const highlight = (page: Page, tabset: string) =>
    path(page, tabset).locator(":scope > span[aria-hidden]");

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
    // the whole tabset is filled, and only that one
    await expect(highlight(page, "/r1/ts0")).toBeVisible();
    await expect(highlight(page, "/ts0")).toBeHidden();
    await expect(highlight(page, "/r1/ts1")).toBeHidden();

    const box = await path(page, "/r1/ts1/content").boundingBox();
    if (!box) throw new Error("no box");
    await moveDragTo(page, { x: box.x + 8, y: box.y + box.height / 2 });
    await expect(targets).toHaveCount(1);
    await expect(path(page, "/r1/ts1")).toHaveAttribute(
        "data-drop-location",
        "start",
    );
    // only the half it would dock to
    await expect(highlight(page, "/r1/ts0")).toBeHidden();
    await expect
        .poll(
            async () => (await highlight(page, "/r1/ts1").boundingBox())?.width,
        )
        .toBeCloseTo(box.width / 2, -1);

    await page.mouse.up();
    await expect(targets).toHaveCount(0);
    await expect(highlight(page, "/r1/ts1")).toBeHidden();
});

test("a strip drop marks the tab list with the insertion index", async ({
    page,
}) => {
    await openExample(page, "drop-target-highlight");
    const strip = path(page, "/r1/ts0/tabstrip");
    // a tab's third span: after its name and its marker
    const caret = strip.locator('[role="tab"] > span:nth-child(3)');
    const first = await path(page, "/r1/ts0/tb0").boundingBox();
    if (!first) throw new Error("no box");
    await startDrag(page, path(page, "/ts0/tb0"));
    await moveDragTo(page, {
        x: first.x + first.width + 20,
        y: first.y + first.height / 2,
    });
    await expect(strip).toHaveAttribute("data-drop-target", "");
    await expect(strip).toHaveAttribute("data-drop-index", /^[12]$/);
    // the caret replaces the tabset's highlight
    await expect(highlight(page, "/r1/ts0")).toBeHidden();
    await expect(caret).toBeVisible();
    await page.mouse.up();
    await expect(strip).not.toHaveAttribute("data-drop-target");
    await expect(caret).toHaveCount(0);
});
