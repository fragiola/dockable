import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("tabs close by button and middle click; empty tabsets show a hint", async ({
    page,
}) => {
    const stage = await openExample(page, "close-tabs");
    const tab = (name: string) =>
        stage.locator('[role="tab"]', { hasText: name });

    // enableClose: false: no close button
    await expect(tab("Home").getByRole("button")).toHaveCount(0);

    await tab("Draft").getByRole("button", { name: "Close Draft" }).click();
    await expect(tab("Draft")).toHaveCount(0);

    await tab("Report").click({ button: "middle" });
    await expect(tab("Report")).toHaveCount(0);
    await tab("Home").click({ button: "middle" });
    await expect(tab("Home")).toHaveCount(1);

    // the Inbox tabset keeps itself when empty (enableDeleteWhenEmpty: false)
    const inbox = path(page, "/r1/ts0");
    await tab("Inbox").getByRole("button", { name: "Close Inbox" }).click();
    await expect(inbox).toHaveAttribute("data-empty", "");
    await expect(inbox).toContainText("Nothing open");

    // the close-tabset button removes the Logs/Metrics tabset
    const logs = path(page, "/r1/ts1");
    await logs.getByRole("button", { name: "Close tabset" }).click();
    await expect(tab("Logs")).toHaveCount(0);
    await expect(tab("Metrics")).toHaveCount(0);
});
