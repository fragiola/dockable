import { expect, test } from "@playwright/test";
import { openExample, path } from "./helpers";

// The example themes (src/examples/_themes) belong to this app, so their shape checks run here.
//
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

test("a menu portalled into <body> takes the example theme", async ({
    page,
}) => {
    // ide and dark share the dark scheme: only the example theme (on <body>) tells them apart
    const background = async (theme: "ide" | "dark") => {
        await openExample(page, "component-factory", { theme });
        await page.getByRole("button", { name: "Add a tab" }).first().click();
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        return menu.evaluate((el) => getComputedStyle(el).backgroundColor);
    };
    expect(await background("ide")).not.toBe(await background("dark"));
});

test("a chart follows a theme switch that keeps the scheme", async ({
    page,
}) => {
    // light and paper share the light scheme: the chart must still re-read its colours. The
    // first stroked path is a grid line, drawn in the palette's line colour.
    await openExample(page, "maximize", { theme: "light" });
    const stroke = () =>
        page
            .locator("[_echarts_instance_] path[stroke]")
            .first()
            .getAttribute("stroke");
    // read once the panel is in the document: a colour, not the empty default
    await expect.poll(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    const light = await stroke();
    await page.evaluate(() =>
        window.postMessage(
            { type: "fragiola:example:theme", theme: "paper" },
            location.origin,
        ),
    );
    await expect(page.locator("body")).toHaveAttribute(
        "data-example-theme",
        "paper",
    );
    await expect.poll(stroke).not.toBe(light);
});
