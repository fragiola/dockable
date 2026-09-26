import { expect, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

test("a border opens beside the layout, resizes, closes, and takes a dragged tab", async ({
    page,
}) => {
    await openExample(page, "borders");
    const main = path(page, "/main");
    // the explorer starts open (selected: 0): the main area is narrower than the stage
    await expect(path(page, "/border/left")).toHaveAttribute("data-open", "");
    await expect(path(page, "/border/left/t0")).toContainText("src/app.ts");

    // the bottom border opens on a click, beside the layout
    const before = await main.boundingBox();
    await path(page, "/border/bottom/tb0").click();
    await expect(path(page, "/border/bottom")).toHaveAttribute("data-open", "");
    const after = await main.boundingBox();
    expect(after?.height ?? 0).toBeLessThan((before?.height ?? 0) - 100);

    // its splitter resizes it (keyboard: 10px a step, towards the layout)
    const splitter = path(page, "/border/bottom/s-1");
    await expect(splitter).toHaveAttribute("aria-valuenow", "160");
    await splitter.focus();
    await page.keyboard.press("ArrowUp");
    await expect(splitter).toHaveAttribute("aria-valuenow", "170");

    // a second click on the selected tab closes it
    await path(page, "/border/bottom/tb0").click();
    await expect(path(page, "/border/bottom")).not.toHaveAttribute("data-open");

    // an editor tab dragged onto the right border's strip joins it
    await startDrag(page, path(page, "/ts0/tb1"));
    await moveDragTo(page, await centre(path(page, "/border/right")));
    await expect(path(page, "/border/right")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    await page.mouse.up();
    await expect(
        path(page, "/border/right/tabstrip").getByRole("tab"),
    ).toHaveText(["Outline", "store.ts"]);
});
