import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the toolbar drives the selected chart of the active tabset", async ({
    page,
}) => {
    await openExample(page, "active-tab-controls");
    const target = page.getByTestId("target");
    const kinds = page.getByRole("group", { name: "Chart kind" });

    // the first tabset is the active one until another is clicked
    await expect(target).toHaveText("Editing Revenue");
    await expect(kinds.getByRole("button", { name: "Bar" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(path(page, "/ts0/t0").locator("svg")).toBeVisible();

    // change the kind: the tab's data changes, the chart follows
    await kinds.getByRole("button", { name: "Pie" }).click();
    await expect(kinds.getByRole("button", { name: "Pie" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );

    // another tabset: the toolbar follows it, with that chart's own kind
    await path(page, "/ts1/tb1").click();
    await expect(target).toHaveText("Editing Traffic");
    await expect(kinds.getByRole("button", { name: "Line" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );

    // a table has nothing to drive
    await path(page, "/ts0/tb1").click();
    await expect(target).toHaveText("Orders: not a chart");
    await expect(kinds.getByRole("button", { name: "Pie" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "New data" })).toBeDisabled();

    // back to the first chart: it kept the kind the toolbar gave it
    await path(page, "/ts0/tb0").click();
    await expect(target).toHaveText("Editing Revenue");
    await expect(kinds.getByRole("button", { name: "Pie" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
});
