import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the panel drives the layout and disables what the model refuses", async ({
    page,
}) => {
    const stage = await openExample(page, "remote-control");
    const remote = page.getByRole("complementary", { name: "Remote control" });
    const last = page.getByTestId("last");

    // the pinned Overview tab is selected: it can neither close nor move
    await expect(
        remote.getByRole("heading", { name: "Tab: Overview" }),
    ).toBeVisible();
    await expect(
        remote.getByRole("button", { name: "Close tab", exact: true }),
    ).toBeDisabled();
    await expect(
        remote.getByRole("button", { name: "Move to Right" }),
    ).toBeDisabled();

    // select another tab from the panel, then move it to the right tabset
    await remote.getByRole("button", { name: "Revenue", exact: true }).click();
    await expect(path(page, "/ts0/tb1")).toHaveAttribute("data-selected", "");
    await remote.getByRole("button", { name: "Move to Right" }).click();
    await expect(last).toHaveText("tab.move: done");
    await expect(path(page, "/ts1").locator('[role="tab"]')).toHaveText([
        "Share",
        "Traffic",
        "Revenue",
    ]);

    // the right tabset cannot close (enableClose: false); it can maximize and restore
    await remote.getByRole("button", { name: "Right", exact: true }).click();
    await expect(
        remote.getByRole("button", { name: "Close tabset" }),
    ).toBeDisabled();
    await remote.getByRole("button", { name: "Maximize" }).click();
    await expect(path(page, "/ts1")).toHaveAttribute("data-maximized", "");
    await expect(path(page, "/ts0")).toBeHidden();
    await remote.getByRole("button", { name: "Restore" }).click();
    await expect(path(page, "/ts0")).toBeVisible();

    // add a tab beside the active tabset: a new tabset appears
    await remote.getByRole("button", { name: "Add a tab beside" }).click();
    await expect(stage.locator('[role="tablist"]')).toHaveCount(3);
    await expect(
        remote.getByRole("heading", { name: /^Tab: Table/ }),
    ).toBeVisible();

    // close a tab from the panel
    await remote
        .getByRole("button", { name: "Close tab", exact: true })
        .click();
    await expect(last).toHaveText("tab.close: done");
    await expect(stage.locator('[role="tablist"]')).toHaveCount(2);
});
