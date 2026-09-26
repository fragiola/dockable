// Borders (Epic #21): opening, resizing, drops into and out of borders, the auto-hide reveal during
// a drag, the edge indicators, and the edge docking margin (gap 11).
import { expect, type Page, test } from "@playwright/test";
import {
    drag,
    dragOver,
    dragOverPoint,
    findPath,
    Location,
    waitForBox,
} from "./helpers";

const open = async (page: Page, query: string) => {
    await page.goto(`/fixtures/borders/?${query}`);
    await waitForBox(findPath(page, "/main"), "main area");
};

const tabNames = (page: Page, path: string) =>
    findPath(page, `${path}/tabstrip`).getByRole("tab");

test("a split border opens on a tab click, shrinks the layout, and closes on a second click", async ({
    page,
}) => {
    await open(page, "layout=test_overlay");
    const before = await waitForBox(findPath(page, "/main"), "main");
    await findPath(page, "/border/right/tb0").click();
    await expect(findPath(page, "/border/right")).toHaveAttribute(
        "data-open",
        "",
    );
    await expect(findPath(page, "/border/right/t0")).toBeVisible();
    const opened = await waitForBox(findPath(page, "/main"), "main");
    expect(opened.width).toBeLessThan(before.width - 100);

    await findPath(page, "/border/right/tb0").click();
    await expect(findPath(page, "/border/right/t0")).toBeHidden();
    await expect(findPath(page, "/border/right")).not.toHaveAttribute(
        "data-open",
    );
    const closed = await waitForBox(findPath(page, "/main"), "main");
    expect(Math.abs(closed.width - before.width)).toBeLessThan(2);
});

test("a border's splitter resizes it with the keyboard", async ({ page }) => {
    await open(page, "layout=test_overlay");
    await findPath(page, "/border/bottom/tb0").click();
    const splitter = findPath(page, "/border/bottom/s-1");
    await expect(splitter).toHaveAttribute("aria-valuenow", "200");
    await splitter.focus();
    await page.keyboard.press("ArrowUp");
    await expect(splitter).toHaveAttribute("aria-valuenow", "210");
    const panel = await waitForBox(
        findPath(page, "/border/bottom/t0"),
        "bottom panel",
    );
    expect(Math.round(panel.height)).toBe(210);
});

test("a tab dropped on a border's strip joins the border, and keeps its content", async ({
    page,
}) => {
    await open(page, "layout=test_overlay");
    await findPath(page, "/ts0/t0").getByTestId("counter").click();
    await drag(
        page,
        findPath(page, "/ts0/tb0"),
        findPath(page, "/border/right"),
        Location.BOTTOM,
    );
    await expect(tabNames(page, "/border/right")).toHaveText(["right1", "One"]);
    await findPath(page, "/border/right/tb1").click();
    await expect(
        findPath(page, "/border/right/t1").getByTestId("counter"),
    ).toHaveText("Count: 1");
});

test("a tab dropped on an open border's panel joins the border", async ({
    page,
}) => {
    await open(page, "layout=test_overlay");
    await findPath(page, "/border/bottom/tb0").click();
    await drag(
        page,
        findPath(page, "/ts1/tb0"),
        findPath(page, "/border/bottom/t0"),
        Location.CENTER,
    );
    await expect(tabNames(page, "/border/bottom")).toHaveText([
        "bottom1",
        "Two",
    ]);
});

test("a border's tab dragged into a tabset leaves the border", async ({
    page,
}) => {
    await open(page, "layout=test_overlay");
    await drag(
        page,
        findPath(page, "/border/top/tb0"),
        findPath(page, "/ts2/t0"),
        Location.CENTER,
    );
    await expect(tabNames(page, "/ts2")).toHaveText(["Three", "top1"]);
    await expect(findPath(page, "/border/top")).toHaveAttribute(
        "data-empty",
        "",
    );
});

test("an empty auto-hide border appears while a drag nears its edge, and takes the drop", async ({
    page,
}) => {
    await open(page, "layout=test_autohide_borders");
    await expect(findPath(page, "/border/left")).toBeVisible(); // has a tab
    await expect(findPath(page, "/border/right")).toHaveCount(0);
    const main = await waitForBox(findPath(page, "/main"), "main");
    // near the right edge, away from the edge docking band at its middle
    const near = { x: main.x + main.width - 4, y: main.y + 40 };
    const drag = await dragOverPoint(page, findPath(page, "/ts0/tb1"), near);
    await expect(findPath(page, "/border/right")).toBeVisible();
    const strip = await waitForBox(
        findPath(page, "/border/right"),
        "right strip",
    );
    await drag.moveTo({
        x: strip.x + strip.width / 2,
        y: strip.y + strip.height / 2,
    });
    await drag.drop();
    await expect(tabNames(page, "/border/right")).toHaveText(["Two"]);
});

test("an auto-hide border revealed by a drag hides again when the drag moves away", async ({
    page,
}) => {
    await open(page, "layout=test_autohide_borders");
    const main = await waitForBox(findPath(page, "/main"), "main");
    const drag = await dragOverPoint(page, findPath(page, "/ts0/tb1"), {
        x: main.x + 40,
        y: main.y + main.height - 4,
    });
    await expect(findPath(page, "/border/bottom")).toBeVisible();
    await drag.moveTo({
        x: main.x + main.width / 2,
        y: main.y + main.height / 2,
    });
    await expect(findPath(page, "/border/bottom")).toHaveCount(0);
    await drag.drop();
});

test("the edge indicators show during a drag, and mark the edge a drop would dock to", async ({
    page,
}) => {
    await open(page, "layout=test_overlay");
    await expect(findPath(page, "/edge/top")).toBeHidden();
    const main = await waitForBox(findPath(page, "/main"), "main");
    const drag = await dragOverPoint(page, findPath(page, "/ts0/tb0"), {
        x: main.x + main.width / 2,
        y: main.y + main.height / 2,
    });
    for (const edge of ["top", "bottom", "left", "right"]) {
        await expect(findPath(page, `/edge/${edge}`)).toHaveAttribute(
            "data-visible",
            "",
        );
    }
    const top = await waitForBox(findPath(page, "/edge/top"), "top edge");
    // the band is edgeDockMargin (10) deep, edgeDockLength (100) long, centred on the main area
    expect(Math.round(top.height)).toBe(10);
    expect(Math.round(top.width)).toBe(100);
    expect(
        Math.abs(top.x + top.width / 2 - (main.x + main.width / 2)),
    ).toBeLessThan(2);
    expect(Math.abs(top.y - main.y)).toBeLessThan(2);

    await drag.moveTo({ x: top.x + top.width / 2, y: top.y + top.height / 2 });
    await expect(findPath(page, "/edge/top")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    await expect(findPath(page, "/outline")).toHaveAttribute(
        "data-drop-kind",
        "edge",
    );
    await drag.drop();
    await expect(findPath(page, "/edge/top")).toBeHidden();
    // "One" docked as a new tabset across the top of the layout
    const docked = await waitForBox(
        page.locator('[role="tab"]', { hasText: "One" }),
        "One",
    );
    expect(docked.y).toBeLessThan(main.y + 20);
});

test("gap 11: a thin strip at the top edge docks to the edge by default, and takes the drop with a smaller edgeDockMargin", async ({
    page,
}) => {
    await open(page, "layout=test_border_direction&thin");
    const main = await waitForBox(findPath(page, "/main"), "main");
    const strip = await waitForBox(findPath(page, "/ts0/tabstrip"), "strip");
    // the strip's centre (where the drop aims) is inside the 10px top band
    expect(strip.y + strip.height / 2 - main.y).toBeLessThan(10);
    const drop = await dragOver(
        page,
        findPath(page, "/border/right/tb0"),
        findPath(page, "/ts0/tabstrip"),
        Location.CENTER,
    );
    await expect(findPath(page, "/outline")).toHaveAttribute(
        "data-drop-kind",
        "edge",
    );
    await drop();

    await open(page, "layout=test_border_direction&thin&edgeDockMargin=3");
    const drop2 = await dragOver(
        page,
        findPath(page, "/border/right/tb0"),
        findPath(page, "/ts0/tabstrip"),
        Location.CENTER,
    );
    await expect(findPath(page, "/outline")).toHaveAttribute(
        "data-drop-kind",
        "rect",
    );
    await drop2();
    await expect(tabNames(page, "/ts0")).toHaveText(["One", "right1"]);
});
