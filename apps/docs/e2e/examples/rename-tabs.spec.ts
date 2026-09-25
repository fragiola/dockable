import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("double-click renames: Enter confirms, empty is refused, Escape cancels", async ({
    page,
}) => {
    await openExample(page, "rename-tabs");
    const tab = path(page, "/ts0/tb0");
    const field = page.getByRole("textbox", { name: "Tab name" });

    await tab.dblclick();
    await expect(field).toBeFocused();
    await field.fill("Plan");
    await field.press("Enter");
    await expect(field).toHaveCount(0);
    await expect(tab).toHaveText("Plan");
    await expect(tab).toBeFocused();

    // an empty name is refused: the field stays open and is marked invalid
    await tab.dblclick();
    await field.fill("   ");
    await field.press("Enter");
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");

    // Escape cancels
    await field.press("Escape");
    await expect(field).toHaveCount(0);
    await expect(tab).toHaveText("Plan");

    // F2 on a focused tab also renames; a tab with enableRename: false does not
    await tab.press("F2");
    await expect(field).toBeFocused();
    await field.press("Escape");
    await path(page, "/ts0/tb2").dblclick();
    await expect(field).toHaveCount(0);
});
