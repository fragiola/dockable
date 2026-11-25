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

    // F2 on a focused tab also renames; a tab with renamable: false does not
    await tab.press("F2");
    await expect(field).toBeFocused();
    await field.press("Escape");
    await path(page, "/ts0/tb2").dblclick();
    await expect(field).toHaveCount(0);
});

test("the field takes the keys and the pointer typed in it, not the tab", async ({
    page,
}) => {
    await openExample(page, "rename-tabs");
    const tab = path(page, "/ts0/tb0");
    const field = page.getByRole("textbox", { name: "Tab name" });

    await tab.press("F2");
    await expect(field).toBeFocused();
    await field.fill("Roadmap");
    // arrows, Home, End and Space edit the text: focus stays in the field
    await field.press("ArrowLeft");
    await field.press("Home");
    await field.press("End");
    await field.press("Space");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("Roadmap ");

    // selecting the text with the pointer does not drag the tab
    const box = await field.boundingBox();
    if (!box) throw new Error("no field box");
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    // the pointer selected text in the field (a tab drag would have taken the gesture)
    await expect(field).toBeFocused();
    expect(
        await field.evaluate(
            (input: HTMLInputElement) =>
                (input.selectionEnd ?? 0) - (input.selectionStart ?? 0),
        ),
    ).toBeGreaterThan(0);

    await field.press("Enter");
    await expect(tab).toHaveText("Roadmap");
});
