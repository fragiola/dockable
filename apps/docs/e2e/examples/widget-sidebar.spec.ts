import { expect, test } from "@playwright/test";
import {
    centre,
    dragTo,
    moveDragTo,
    openExample,
    path,
    startDrag,
} from "../helpers";

test("a widget dragged from the sidebar becomes a tab where it is dropped", async ({
    page,
}) => {
    const stage = await openExample(page, "widget-sidebar");
    const source = stage.getByRole("button", { name: /Server log/ });

    await startDrag(page, source);
    await expect(source).toHaveAttribute("data-dragging", "");
    await expect(path(page, "/layout")).toHaveAttribute("data-dragging", "");
    await moveDragTo(page, await centre(path(page, "/ts1/content")));
    await expect(path(page, "/outline")).toBeVisible();
    await page.mouse.up();

    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Orders table",
        "Server log",
    ]);
    await expect(
        path(page, "/ts1/tabstrip").getByRole("tab", { name: "Server log" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(stage.getByTestId("status")).toHaveText("Added Server log");
    await expect(source).not.toHaveAttribute("data-dragging");
});

test("a widget dropped at the layout edge docks a new tabset", async ({
    page,
}) => {
    const stage = await openExample(page, "widget-sidebar");
    const layout = await path(page, "/layout").boundingBox();
    if (!layout) throw new Error("no layout");
    await dragTo(page, stage.getByRole("button", { name: /Notes/ }), {
        x: layout.x + layout.width - 4,
        y: layout.y + layout.height / 2,
    });
    await expect(stage.getByRole("tablist")).toHaveCount(3);
    await expect(stage.getByRole("tab", { name: "Notes" })).toBeVisible();
});

test("pressing a widget adds it to the active tabset (the keyboard path)", async ({
    page,
}) => {
    const stage = await openExample(page, "widget-sidebar");
    await path(page, "/ts1/tb0").click(); // makes the second tabset active
    const source = stage.getByRole("button", { name: /Channels chart/ });
    await source.focus();
    await page.keyboard.press("Enter");
    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Orders table",
        "Channels chart",
    ]);
    await expect(stage.getByTestId("status")).toHaveText(
        "Added Channels chart",
    );
});
