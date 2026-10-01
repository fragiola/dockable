import { expect, test } from "@playwright/test";
import { dragTo, moveDragTo, openExample, path, startDrag } from "../helpers";

test("the veto caps a tabset at four tabs, from code and by drag", async ({
    page,
}) => {
    await openExample(page, "middleware");
    const result = page.getByTestId("result");
    const add = page.getByRole("button", { name: "Add a chart" });

    // three charts: a fourth is accepted, a fifth is vetoed
    await add.click();
    await expect(result).toHaveText("Add a chart: applied");
    await add.click();
    await expect(result).toHaveText(
        "Add a chart: A tabset holds at most 4 tabs.",
    );
    await expect(path(page, "/ts0").locator('[role="tab"]')).toHaveCount(4);

    // a drag into the full tabset is refused while it hovers
    const box = await path(page, "/ts0/content").boundingBox();
    if (!box) throw new Error("no box");
    await startDrag(page, path(page, "/ts1/tb0"));
    await moveDragTo(page, {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
    });
    await expect(
        page.getByTestId("stage").locator('[data-layout-path="/layout"]'),
    ).toHaveAttribute("data-drop-refused", "");
    await page.mouse.up();
    await expect(path(page, "/ts0").locator('[role="tab"]')).toHaveCount(4);

    // switched off, the rule is gone: the drag goes through
    await page.getByRole("switch", { name: /At most 4 tabs/ }).click();
    await dragTo(page, path(page, "/ts1/tb0"), {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
    });
    await expect(path(page, "/ts0").locator('[role="tab"]')).toHaveCount(5);
});

test("the rewrite tidies names and the log records every command", async ({
    page,
}) => {
    await openExample(page, "middleware");
    const result = page.getByTestId("result");

    await page.getByRole("button", { name: "Rename" }).click();
    await expect(result).toHaveText(
        'Rename: committed as "Quarterly revenue r…"',
    );
    await expect(path(page, "/ts0/tb0")).toHaveText("Quarterly revenue r…");

    // without the rewrite, the name commits as typed
    await page.getByRole("switch", { name: "Tidy tab names" }).click();
    await page
        .getByRole("textbox", { name: "New name for the selected chart" })
        .fill("raw name");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(path(page, "/ts0/tb0")).toHaveText("raw name");

    // the log tab lists both commands, newest first
    const log = page.getByRole("list", { name: "Command log" });
    await expect(log.getByRole("listitem")).toHaveCount(2);
    await expect(log.getByRole("listitem").first()).toContainText("tab.update");
});
