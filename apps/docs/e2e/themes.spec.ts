import { expect, test } from "@playwright/test";
import { openExample, path } from "./helpers";

// The themes change shape, not only colour: checked on computed styles (verify
// by compiling, not by reading class names).

async function styles(page: import("@playwright/test").Page) {
    const splitter = path(page, "/s0").first();
    const tab = path(page, "/ts0/tb0").first();
    return {
        splitter: await splitter.evaluate(
            (el) => el.getBoundingClientRect().width,
        ),
        radius: await tab.evaluate(
            (el) => getComputedStyle(el).borderTopLeftRadius,
        ),
        font: await tab.evaluate((el) => getComputedStyle(el).fontFamily),
        stageBackground: await page
            .getByTestId("stage")
            .locator('[data-layout-path="/layout"]')
            .evaluate((el) => getComputedStyle(el).backgroundColor),
    };
}

test("ide: hairline splitters and square tabs", async ({ page }) => {
    await openExample(page, "hello-layout", { theme: "ide" });
    const s = await styles(page);
    expect(s.splitter).toBe(1);
    expect(s.radius).toBe("0px");
});

test("paper: wide splitters and rounded tabs", async ({ page }) => {
    await openExample(page, "hello-layout", { theme: "paper" });
    const s = await styles(page);
    expect(s.splitter).toBe(8);
    expect(Number.parseFloat(s.radius)).toBeGreaterThan(0);
});

test("terminal: monospace and square tabs", async ({ page }) => {
    await openExample(page, "hello-layout", { theme: "terminal" });
    const s = await styles(page);
    expect(s.radius).toBe("0px");
    expect(s.font).toMatch(/mono|Menlo|Consolas/i);
});

test("the themes paint different floors, whatever the page theme", async ({
    page,
}) => {
    const seen = new Set<string>();
    for (const theme of [
        "light",
        "dark",
        "ide",
        "paper",
        "terminal",
    ] as const) {
        await openExample(page, "hello-layout", { theme });
        seen.add((await styles(page)).stageBackground);
    }
    expect(seen.size).toBe(5);
});
