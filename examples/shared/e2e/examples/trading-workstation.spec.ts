import { expect, test } from "@playwright/test";
import { centre, dragTo, openExample, waitForPopout } from "../helpers";

// The feed ticks a few times a second, so the assertions read structure, or values the Pause has
// frozen; a value that must move is polled until it does.

test("the values tick while playing and freeze on Pause", async ({ page }) => {
    const stage = await openExample(page, "trading-workstation", {
        theme: "terminal",
    });
    const clock = stage.getByTestId("feed-clock");
    const price = stage.getByTestId("last-price");

    // playing: the clock and the prices move
    await expect(stage.getByTestId("feed-state")).toHaveText("Live");
    const start = await clock.textContent();
    await expect.poll(() => clock.textContent()).not.toBe(start);

    // paused: nothing moves any more
    await stage.getByRole("button", { name: "Pause" }).click();
    await expect(stage.getByTestId("feed-state")).toHaveText("Paused");
    const frozen = {
        clock: await clock.textContent(),
        price: await price.textContent(),
        pnl: await stage.getByTestId("total-pnl").textContent(),
    };
    await page.waitForTimeout(1000);
    await expect(clock).toHaveText(frozen.clock ?? "");
    await expect(price).toHaveText(frozen.price ?? "");
    await expect(stage.getByTestId("total-pnl")).toHaveText(frozen.pnl ?? "");

    // Play starts it again
    await stage.getByRole("button", { name: "Play" }).click();
    await expect.poll(() => clock.textContent()).not.toBe(frozen.clock);
});

test("the watchlist chooses the instrument the chart and the order book follow", async ({
    page,
}) => {
    const stage = await openExample(page, "trading-workstation");
    await stage.getByRole("button", { name: "Pause" }).click();
    const watchlist = stage.getByRole("list", { name: "Watchlist" });
    const chartTab = stage
        .getByRole("tablist", { name: "Chart" })
        .getByRole("tab");

    await expect(chartTab).toHaveText("DXEL");
    await expect(stage.getByTestId("book-symbol")).toHaveText("DXEL");

    await watchlist.getByRole("button", { name: /^KLXN/ }).click();
    await expect(
        watchlist.getByRole("button", { name: /^KLXN/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
        watchlist.getByRole("button", { name: /^DXEL/ }),
    ).toHaveAttribute("aria-pressed", "false");
    // the chart tab is renamed after it, and the chart and the book show it
    await expect(chartTab).toHaveText("KLXN");
    await expect(stage.getByRole("img", { name: /^KLXN price/ })).toBeVisible();
    await expect(stage.getByTestId("book-symbol")).toHaveText("KLXN");

    // the choice is in the layout, saved: it survives a reload
    await page.reload();
    await expect(
        stage.getByRole("tablist", { name: "Chart" }).getByRole("tab"),
    ).toHaveText("KLXN");
});

test("the order book keeps ticking after its tab is dragged to another tabset", async ({
    page,
}) => {
    const stage = await openExample(page, "trading-workstation");
    const book = stage.getByRole("tab", { name: "Order book" });
    const chart = stage.getByRole("img", { name: /price, the last/ });

    await dragTo(page, book, await centre(chart));
    const chartTabs = stage.getByRole("tablist", { name: "Chart" });
    await expect(
        chartTabs.getByRole("tab", { name: "Order book" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
        stage.getByRole("tablist", { name: "Depth" }).getByRole("tab"),
    ).toHaveText(["Trades"]);

    // still live where it landed
    const bestBid = stage.getByTestId("best-bid");
    await expect(bestBid).toBeVisible();
    const before = await bestBid.textContent();
    await expect.poll(() => bestBid.textContent()).not.toBe(before);
});

test("the tabs carry badges: the P&L sign, and the unread headlines", async ({
    page,
}) => {
    const stage = await openExample(page, "trading-workstation");
    const positions = stage.getByRole("tab", { name: /^Positions/ });
    const news = stage.getByRole("tab", { name: /^News/ });

    await expect(positions).toHaveAttribute("data-pnl", /^(up|down)$/);

    // a headline arrives while the news tab is not shown
    await expect(news).toHaveAttribute("data-unread", "", { timeout: 10_000 });
    await expect(news.getByTestId("unread-count")).toHaveText(/^\d+ unread$/);

    // showing it reads them
    await news.click();
    await expect(news).not.toHaveAttribute("data-unread");
    await expect(stage.getByRole("list", { name: "Headlines" })).toBeVisible();
});

test("a tabset maximizes, and its tab pops out into a window where it keeps ticking", async ({
    page,
}) => {
    const stage = await openExample(page, "trading-workstation");
    // the tabset is the tab list's closest element with a layout path
    const depth = stage
        .getByRole("tablist", { name: "Depth" })
        .locator("xpath=ancestor::*[@data-layout-path][1]");
    await depth.getByRole("button", { name: "Maximize" }).click();
    await expect(depth).toHaveAttribute("data-maximized", "");
    await expect(stage.getByRole("tablist", { name: "Market" })).toBeHidden();
    await depth.getByRole("button", { name: "Restore" }).click();
    await expect(stage.getByRole("tablist", { name: "Market" })).toBeVisible();

    await depth.getByRole("button", { name: "Pop out Order book" }).click();
    const [popout] = await waitForPopout(page);
    if (!popout) throw new Error("no popout window");
    const bestBid = popout.getByTestId("best-bid");
    await expect(bestBid).toBeVisible();
    const before = await bestBid.textContent();
    await expect.poll(() => bestBid.textContent()).not.toBe(before);
    await expect(stage.getByTestId("best-bid")).toHaveCount(0);
});

test("under reduced motion the feed starts paused", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const stage = await openExample(page, "trading-workstation");
    await expect(stage.getByTestId("feed-state")).toHaveText("Paused");
    await expect(stage.getByRole("button", { name: "Play" })).toBeVisible();
    const clock = await stage.getByTestId("feed-clock").textContent();
    await page.waitForTimeout(1000);
    await expect(stage.getByTestId("feed-clock")).toHaveText(clock ?? "");
});
