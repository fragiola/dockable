import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";

test("an alert change recolours the service's tab", async ({ page }) => {
    const stage = await openExample(page, "ops-monitor", { theme: "terminal" });
    const payments = stage.getByRole("tab", { name: /payments/ });
    const icon = payments.getByTestId("tab-icon");
    const colour = () =>
        icon.evaluate((element) => getComputedStyle(element).color);

    // the panel reports "ok" into the tab's config, and the tab shows it
    await expect(payments).toHaveAttribute("data-status", "ok");
    const calm = await colour();

    // the incident changes the data at once (no waiting on the timer)
    await stage.getByRole("button", { name: "Trigger incident" }).click();
    await expect(payments).toHaveAttribute("data-status", "critical");
    await expect(payments.getByTestId("alert-count")).toHaveText("2");
    await expect.poll(colour).not.toBe(calm);

    await stage.getByRole("button", { name: "Resolve all" }).click();
    await expect(payments).toHaveAttribute("data-status", "ok");
    await expect(payments.getByTestId("alert-count")).toHaveCount(0);
});
