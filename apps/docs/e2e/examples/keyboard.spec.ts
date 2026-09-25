import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the keyboard moves between tabs and tabsets, and tooltips show the shortcuts", async ({
    page,
}) => {
    await openExample(page, "keyboard");
    const focusedPath = () =>
        page.evaluate(
            () =>
                (document.activeElement as HTMLElement | null)?.dataset
                    .layoutPath,
        );

    const keys = path(page, "/ts0/tb0");
    await expect(keys).toHaveAttribute(
        "aria-keyshortcuts",
        "Control+Enter Control+Delete",
    );
    // a tab that cannot be closed does not advertise the close shortcut
    await expect(path(page, "/ts0/tb2")).toHaveAttribute(
        "aria-keyshortcuts",
        "Control+Enter",
    );

    await keys.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(focusedPath).toBe("/ts0/tb1");
    await page.keyboard.press("End");
    await expect.poll(focusedPath).toBe("/ts0/tb2");
    await page.keyboard.press("Home");
    await expect.poll(focusedPath).toBe("/ts0/tb0");

    // the focused tab's tooltip lists its shortcuts
    const tooltip = page.getByTestId("tab-shortcuts");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Delete");

    // next tabset, from the keyMap
    await page.keyboard.press("Control+Alt+ArrowRight");
    await expect.poll(focusedPath).toBe("/ts1/tb0");
    await expect(path(page, "/ts1")).toHaveAttribute("data-active", "");
    await page.keyboard.press("Control+Alt+ArrowLeft");
    await expect.poll(focusedPath).toBe("/ts0/tb0");
});
