import { expect, test } from "@playwright/test";
import {
    centre,
    dragTo,
    moveDragTo,
    openExample,
    path,
    startDrag,
} from "../helpers";

test.beforeEach(async ({ page }) => {
    // a saved layout from another test would change the starting point
    await page.addInitScript(() => {
        try {
            window.localStorage.removeItem(
                "dockable-examples:dashboard-builder",
            );
        } catch {
            // storage unavailable
        }
    });
});

test("charts go into the canvas, KPIs only into the KPI strip", async ({
    page,
}) => {
    const stage = await openExample(page, "dashboard-builder");
    const palette = stage.getByRole("complementary", {
        name: "Widget palette",
    });
    const canvas = path(page, "/r0/ts1/content");
    const kpis = path(page, "/r0/ts0/content");

    // a chart into the empty canvas
    await dragTo(page, palette.getByText("Trend"), await centre(canvas));
    await expect(path(page, "/r0/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Trend",
    ]);

    // a KPI over the canvas: refused, no indicator, and the drop adds nothing
    await startDrag(page, palette.getByText("Conversion"));
    await moveDragTo(page, await centre(path(page, "/r0/ts1/t0")));
    await expect(path(page, "/outline")).toBeHidden();
    await page.mouse.up();
    await expect(path(page, "/r0/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Trend",
    ]);

    // the same KPI into the strip
    await dragTo(page, palette.getByText("Conversion"), await centre(kpis));
    await expect(path(page, "/r0/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Revenue",
        "Conversion",
    ]);
});

test("the layout is saved and restored", async ({ page }) => {
    const stage = await openExample(page, "dashboard-builder");
    const palette = stage.getByRole("complementary", {
        name: "Widget palette",
    });
    await dragTo(
        page,
        palette.getByText("Orders"),
        await centre(path(page, "/r0/ts1/content")),
    );
    await expect(stage.getByRole("tab", { name: "Orders" })).toBeVisible();
    await stage.getByRole("button", { name: "Save layout" }).click();
    await expect(stage.getByRole("button", { name: "Saved" })).toBeVisible();

    // a remount (the shell's Reset) loads the saved layout
    await page.getByTestId("reset").click();
    await expect(
        page.getByTestId("stage").getByRole("tab", { name: "Orders" }),
    ).toBeVisible();

    // the example's own Reset clears it
    await page
        .getByTestId("stage")
        .getByRole("button", { name: "Reset" })
        .click();
    await expect(
        page.getByTestId("stage").getByRole("tab", { name: "Orders" }),
    ).toHaveCount(0);
});
