import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("layout events raise toasts; Undo brings a closed tab back", async ({
    page,
}) => {
    await openExample(page, "event-toasts");
    const toasts = page.getByRole("list", { name: "Notifications" });

    // a close raises a toast with Undo
    await page.getByRole("button", { name: "Close Traffic" }).click({
        force: true,
    });
    await expect(path(page, "/ts0").locator('[role="tab"]')).toHaveText([
        "Revenue",
    ]);
    await expect(toasts.getByRole("listitem").first()).toContainText(
        "Closed Traffic",
    );
    // a change made after the close survives the undo: only the closed tab comes back
    await page.getByRole("button", { name: "Add a chart" }).click();
    await toasts.getByRole("button", { name: "Undo" }).click();
    await expect(path(page, "/ts0").locator('[role="tab"]')).toHaveText([
        "Revenue",
        "Traffic",
        "Chart 1",
    ]);
    await expect(path(page, "/ts0/tb1")).toHaveAttribute("data-selected", "");

    // maximize and restore
    await path(page, "/ts0").getByRole("button", { name: "Maximize" }).click();
    await expect(toasts.getByRole("listitem").first()).toContainText(
        "Maximized a tabset",
    );
    await path(page, "/ts0").getByRole("button", { name: "Restore" }).click();
    await expect(toasts.getByRole("listitem").first()).toContainText(
        "Restored the layout",
    );

    // an add from code is an event like any other
    await page.getByRole("button", { name: "Add a chart" }).click();
    await expect(toasts.getByRole("listitem").first()).toContainText(
        "Added Chart 2",
    );
});

test("a muted kind raises no toast; selection is muted until switched on", async ({
    page,
}) => {
    await openExample(page, "event-toasts");
    const toasts = page.getByRole("list", { name: "Notifications" });

    await path(page, "/ts0/tb1").click();
    await expect(toasts.getByRole("listitem")).toHaveCount(0);

    await page.getByRole("button", { name: "Select", exact: true }).click();
    await path(page, "/ts0/tb0").click();
    await expect(toasts.getByRole("listitem").first()).toContainText(
        "Showing Revenue",
    );

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Add a chart" }).click();
    await expect(toasts.getByRole("listitem")).toHaveCount(1);
});
