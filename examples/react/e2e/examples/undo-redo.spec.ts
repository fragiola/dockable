import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("undo restores the previous layout JSON, redo re-applies it", async ({
    page,
}) => {
    await openExample(page, "undo-redo");
    const json = page.getByTestId("layout-json");
    const history = page.getByRole("list", { name: "History" });
    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });

    // activate the tabset first: activation is not an undo step, but it is in the JSON
    await path(page, "/ts0/tb0").click();
    const before = await json.textContent();
    await expect(undo).toBeDisabled();

    await path(page, "/ts0").getByRole("button", { name: "Add tab" }).click();
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveCount(3);
    const after = await json.textContent();
    expect(after).not.toBe(before);
    await expect(history.getByRole("listitem")).toHaveText(["Add tab"]);

    await undo.click();
    await expect(json).toHaveText(before ?? "");
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveCount(2);
    await expect(history.getByRole("listitem")).toHaveAttribute(
        "data-undone",
        "",
    );

    await redo.click();
    await expect(json).toHaveText(after ?? "");

    // the keyboard: Ctrl+Z undoes, Ctrl+Shift+Z redoes
    await page.keyboard.press("Control+z");
    await expect(json).toHaveText(before ?? "");
    await page.keyboard.press("Control+Shift+z");
    await expect(json).toHaveText(after ?? "");
});
