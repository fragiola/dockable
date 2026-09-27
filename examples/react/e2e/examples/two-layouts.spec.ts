import { expect, type Page, test } from "@playwright/test";
import { centre, moveDragTo, openExample, startDrag } from "../helpers";

const pane = (page: Page, name: "workspace" | "scratch") =>
    page.getByTestId("stage").getByTestId(`pane-${name}`);
const tabs = (page: Page, name: "workspace" | "scratch") =>
    pane(page, name).getByRole("tab");

test("a tab moves to the other layout with its state, and undo brings it back", async ({
    page,
}) => {
    await openExample(page, "two-layouts");
    // give "Chart" some state
    await tabs(page, "workspace").filter({ hasText: "Chart" }).click();
    const chart = pane(page, "workspace").getByRole("tabpanel", {
        name: "Chart",
    });
    await chart.getByTestId("counter").click();
    await chart.getByTestId("counter").click();
    await chart.getByTestId("notes").fill("kept");

    await startDrag(page, tabs(page, "workspace").filter({ hasText: "Chart" }));
    await moveDragTo(
        page,
        await centre(
            pane(page, "scratch").locator('[data-layout-path="/ts0/content"]'),
        ),
    );
    await page.mouse.up();

    await expect(tabs(page, "workspace")).toHaveText(["Report", "Data"]);
    await expect(tabs(page, "scratch")).toHaveText(["Ideas", "Chart"]);
    const moved = pane(page, "scratch").getByRole("tabpanel", {
        name: "Chart",
    });
    await expect(moved.getByTestId("counter")).toHaveText("Count: 2");
    await expect(moved.getByTestId("notes")).toHaveValue("kept");
    await expect(
        page.getByTestId("stage").getByTestId("last-move"),
    ).toContainText("Chart: Workspace");

    // undo: back where it came from (and gone from Scratch), content kept
    await page
        .getByTestId("stage")
        .getByRole("button", { name: "Undo" })
        .click();
    await expect(tabs(page, "workspace")).toHaveText([
        "Report",
        "Chart",
        "Data",
    ]);
    await expect(tabs(page, "scratch")).toHaveText(["Ideas"]);
    const back = pane(page, "workspace").getByRole("tabpanel", {
        name: "Chart",
    });
    await expect(back.getByTestId("counter")).toHaveText("Count: 2");

    // redo: into Scratch again
    await page
        .getByTestId("stage")
        .getByRole("button", { name: "Redo" })
        .click();
    await expect(tabs(page, "scratch")).toHaveText(["Ideas", "Chart"]);
    await expect(tabs(page, "workspace")).toHaveText(["Report", "Data"]);
});
