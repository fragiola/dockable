import { expect, test } from "@playwright/test";
import { moveDragTo, openExample, path, startDrag } from "../helpers";

test("an overlay border opens over the layout and closes on a click elsewhere or Escape", async ({
    page,
}) => {
    const stage = await openExample(page, "overlay-borders");
    const main = path(page, "/main");
    const before = await main.boundingBox();
    await path(page, "/border/left/tb0").click();
    await expect(path(page, "/border/left/t0")).toBeVisible();
    expect((await main.boundingBox())?.width).toBe(before?.width); // over, not beside

    // a click in the layout outside the panel closes it
    await path(page, "/ts1/t0").click({ position: { x: 40, y: 200 } });
    await expect(path(page, "/border/left/t0")).toBeHidden();

    // Escape from the tab button closes it too
    await path(page, "/border/left/tb0").click();
    await expect(path(page, "/border/left/t0")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(path(page, "/border/left/t0")).toBeHidden();

    // switched to split, it opens beside the layout
    await stage.getByTestId("type-left").click();
    await expect(stage.getByTestId("type-left")).toHaveText("Left: split");
    await path(page, "/border/left/tb0").click();
    await expect
        .poll(async () => (await main.boundingBox())?.width ?? 0)
        .toBeLessThan((before?.width ?? 0) - 100);
});

test("the empty auto-hide border appears while a tab is dragged near its edge, and takes the drop", async ({
    page,
}) => {
    await openExample(page, "overlay-borders");
    await expect(path(page, "/border/right")).toHaveCount(0);
    const main = await path(page, "/main").boundingBox();
    if (!main) throw new Error("no main area");
    await startDrag(page, path(page, "/ts0/tb1"));
    // the edge indicators show during the drag
    await expect(path(page, "/edge/right")).toHaveAttribute("data-visible", "");
    // near the right edge, above its middle (the middle is the edge docking band)
    await moveDragTo(page, { x: main.x + main.width - 4, y: main.y + 40 });
    await expect(path(page, "/border/right")).toBeVisible();
    const strip = await path(page, "/border/right").boundingBox();
    if (!strip) throw new Error("no strip");
    await moveDragTo(page, {
        x: strip.x + strip.width / 2,
        y: strip.y + strip.height / 2,
    });
    await page.mouse.up();
    await expect(
        path(page, "/border/right/tabstrip").getByRole("tab"),
    ).toHaveText(["Calendar"]);
});
