import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("controls outside the layout select a tab and change its counter", async ({
    page,
}) => {
    await openExample(page, "external-tab-switcher");
    const show = page.getByRole("group", { name: "Show tab" });
    const outside = page.getByTestId("outside-count");

    // the switcher selects a tab in the layout
    await show.getByRole("button", { name: /Beta/ }).click();
    await expect(path(page, "/ts0/tb1")).toHaveAttribute("data-selected", "");
    await expect(show.getByRole("button", { name: /Beta/ })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(outside).toHaveText("Beta: 0");

    // the stepper changes the selected tab's count, and the tab shows it
    await page.getByRole("button", { name: "Increment" }).click();
    await page.getByRole("button", { name: "Increment" }).click();
    await expect(outside).toHaveText("Beta: 2");
    await expect(path(page, "/ts0/tb1")).toContainText("2");
    await expect(path(page, "/ts0/tb0")).toContainText("0");

    // clicking a tab moves the outside controls to it
    await path(page, "/ts0/tb2").click();
    await expect(outside).toHaveText("Gamma: 0");
    await expect(show.getByRole("button", { name: /Gamma/ })).toHaveAttribute(
        "aria-pressed",
        "true",
    );

    // a click inside the tab is seen outside, and Reset clears only that tab
    await page
        .getByTestId("stage")
        .getByRole("button", { name: "Add one" })
        .filter({ visible: true })
        .click();
    await expect(outside).toHaveText("Gamma: 1");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(outside).toHaveText("Gamma: 0");
    await show.getByRole("button", { name: /Beta/ }).click();
    await expect(outside).toHaveText("Beta: 2");
});
