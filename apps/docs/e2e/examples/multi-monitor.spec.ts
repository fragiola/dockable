import { expect, test } from "@playwright/test";
import { dragAcrossWindows, openExample, waitForPopout } from "../helpers";

test("tabsets go to their own windows, panels move between the windows, and everything comes back", async ({
    page,
}) => {
    await openExample(page, "multi-monitor");
    const stage = page.getByTestId("stage");
    await stage
        .getByRole("button", { name: "Move Events to another screen" })
        .click();
    await waitForPopout(page, 1);
    await stage
        .getByRole("button", { name: "Move Traffic to another screen" })
        .click();
    const windows = await waitForPopout(page, 2);
    // find each window by its tabs
    const withTab = async (name: string) => {
        for (const w of windows) {
            if ((await w.getByRole("tab").allTextContents()).includes(name))
                return w;
        }
        throw new Error(`no window with ${name}`);
    };
    const eventsWindow = await withTab("Events");
    const trafficWindow = await withTab("Requests");
    await expect(trafficWindow.getByRole("tab")).toHaveText([
        "Requests",
        "Latency",
    ]);

    // a panel from one window into the other
    await dragAcrossWindows(
        trafficWindow.getByRole("tab", { name: "Latency" }),
        eventsWindow.getByRole("tabpanel").first(),
    );
    await expect(eventsWindow.getByRole("tab")).toHaveText([
        "Events",
        "Latency",
    ]);
    await expect(trafficWindow.getByRole("tab")).toHaveText(["Requests"]);

    // everything back on the main screen
    await stage.getByRole("button", { name: "Bring everything back" }).click();
    await expect
        .poll(
            () =>
                page
                    .context()
                    .pages()
                    .filter((p) => p !== page && !p.isClosed()).length,
        )
        .toBe(0);
    await expect(stage.getByRole("tab")).toHaveCount(5);
});
