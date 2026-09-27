import { expect, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

test("a tab dropped on Close is closed; the zones arm only for drags they take", async ({
    page,
}) => {
    const stage = await openExample(page, "drop-zones");
    const close = stage
        .locator("[data-drop-active], [data-slot], div")
        .filter({ hasText: /^Close$/ })
        .first();
    const zones = stage
        .locator("div:has(> svg)")
        .filter({ hasText: /^(Close|Open to the right|Pop out)$/ });
    await expect(zones).toHaveCount(3);
    await expect(close).not.toHaveAttribute("data-drop-active");

    await startDrag(page, path(page, "/ts0/tb1")); // "Drafts"
    await expect(close).toHaveAttribute("data-drop-active", "");
    await moveDragTo(page, await centre(close));
    await expect(close).toHaveAttribute("data-drop-over", "");
    await expect(path(page, "/outline")).toBeHidden();
    await page.mouse.up();

    await expect(stage.getByRole("tab", { name: "Drafts" })).toHaveCount(0);
    await expect(stage.getByTestId("status")).toHaveText("Closed Drafts");
    await expect(close).not.toHaveAttribute("data-drop-active");
});

test("Close does not take a tab that cannot be closed", async ({ page }) => {
    const stage = await openExample(page, "drop-zones");
    const close = stage
        .locator("div")
        .filter({ hasText: /^Close$/ })
        .first();
    await startDrag(page, path(page, "/ts0/tb2")); // "Pinned note": enableClose false
    await expect(close).not.toHaveAttribute("data-drop-active");
    await moveDragTo(page, await centre(close));
    await expect(close).not.toHaveAttribute("data-drop-over");
    await page.mouse.up();
    await expect(stage.getByRole("tab", { name: "Pinned note" })).toHaveCount(
        1,
    );
});

test("Open to the right moves the tab into a new tabset on the right", async ({
    page,
}) => {
    const stage = await openExample(page, "drop-zones");
    const pad = stage
        .locator("div")
        .filter({ hasText: /^Open to the right$/ })
        .first();
    await startDrag(page, path(page, "/ts0/tb0")); // "Inbox"
    await moveDragTo(page, await centre(pad));
    await page.mouse.up();
    await expect(stage.getByRole("tablist")).toHaveCount(3);
    await expect(path(page, "/ts2/tabstrip").getByRole("tab")).toHaveText([
        "Inbox",
    ]);
});
