import { expect, type Page, test } from "@playwright/test";
import { openExample, path } from "../helpers";

/** The popout window, once exactly one extra page stays open (as the playground waits). */
async function waitForPopout(page: Page): Promise<Page> {
    let candidate: Page | null = null;
    await expect
        .poll(
            () => {
                const live = page
                    .context()
                    .pages()
                    .filter((p) => p !== page && !p.isClosed());
                const next = live.length === 1 ? (live[0] ?? null) : null;
                const stable = next !== null && next === candidate;
                candidate = next;
                return stable;
            },
            { timeout: 15000, intervals: [250] },
        )
        .toBe(true);
    if (!candidate) throw new Error("no popout window");
    return candidate;
}

test("the content keeps its state through pop out and dock back", async ({
    page,
}) => {
    await openExample(page, "popout");
    const panel = path(page, "/ts0/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("counter").click();
    await panel.getByTestId("notes").fill("kept");

    await path(page, "/ts0")
        .getByRole("button", { name: "Pop out Editor" })
        .click();
    const popout = await waitForPopout(page);
    const popped = popout.getByRole("tabpanel");
    await expect(popped.getByTestId("counter")).toHaveText("Count: 2");
    await expect(popped.getByTestId("notes")).toHaveValue("kept");
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Preview",
    ]);

    // docking back empties the window, which closes it: click without waiting on it
    await popout
        .getByRole("button", { name: "Dock Editor back" })
        .evaluate((button) => {
            setTimeout(() => (button as HTMLElement).click(), 0);
        });
    await expect.poll(() => popout.isClosed()).toBe(true);
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Preview",
        "Editor",
    ]);
    const docked = page
        .getByTestId("stage")
        .getByRole("tabpanel", { name: "Editor" });
    await expect(docked.getByTestId("counter")).toHaveText("Count: 2");
    await expect(docked.getByTestId("notes")).toHaveValue("kept");
});

test("a popout takes the example theme, and closing it docks the tab back", async ({
    page,
}) => {
    await openExample(page, "popout", { theme: "terminal" });
    const floor = await path(page, "/layout").evaluate(
        (el) => getComputedStyle(el).backgroundColor,
    );
    await path(page, "/ts1")
        .getByRole("button", { name: "Pop out Chat" })
        .click();
    const popout = await waitForPopout(page);
    await expect(popout.locator("body")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    const layout = popout.locator("body [data-layout-path]").first();
    await expect(layout).toBeVisible();
    await expect
        .poll(() =>
            layout.evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe(floor);

    await popout.close({ runBeforeUnload: true });
    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Pinned here",
        "Chat",
    ]);
});
