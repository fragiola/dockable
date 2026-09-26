import { expect, test } from "@playwright/test";
import {
    dragAcrossWindows,
    openExample,
    path,
    waitForPopout,
} from "../helpers";

test("tabs move between a popout window and the main layout, both ways", async ({
    page,
}) => {
    await openExample(page, "popout-drag");
    const chart = path(page, "/ts1/t0");
    await chart.getByTestId("counter").click();

    await path(page, "/ts0").getByTestId("popout-tab").click(); // "Orders" to a window
    const [popout] = await waitForPopout(page);
    if (!popout) throw new Error("no popout");
    await expect(popout.getByRole("tab")).toHaveText(["Orders"]);

    // "Chart" (main) into the window
    await dragAcrossWindows(
        path(page, "/ts1/tb0"),
        popout.getByRole("tabpanel").first(),
    );
    await expect(popout.getByRole("tab")).toHaveText(["Orders", "Chart"]);
    await expect(
        popout.getByRole("tabpanel", { name: "Chart" }).getByTestId("counter"),
    ).toHaveText("Count: 1");

    // and back into the main layout's first tabset
    await dragAcrossWindows(
        popout.getByRole("tab", { name: "Chart" }),
        path(page, "/ts0/t0"),
    );
    await expect(popout.getByRole("tab")).toHaveText(["Orders"]);
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Customers",
        "Invoices",
        "Chart",
    ]);
});
