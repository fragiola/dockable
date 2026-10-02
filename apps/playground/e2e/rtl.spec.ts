// Right-to-left (#118): on the RTL fixture, every interaction lands where the pointer or the key
// points, with `start` on the right: splitters, side, edge and strip drops, borders, tab keys, a
// runtime `dir` flip and a popout.
import { expect, type Page, test } from "@playwright/test";
import {
    type Box,
    dragOverPoint,
    dragSplitter,
    findPath,
    waitForBox,
    waitForPopout,
} from "./helpers";

const open = async (page: Page) => {
    await page.goto("/fixtures/rtl/");
    return waitForBox(findPath(page, "/main"), "main area");
};

const box = (page: Page, path: string) =>
    waitForBox(findPath(page, path), path);

const right = (b: Box) => b.x + b.width;
const middle = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const labels = (page: Page, path: string) =>
    findPath(page, `${path}/tabstrip`).getByRole("tab").allTextContents();

test("the start tabset is on the right, and the start border too", async ({
    page,
}) => {
    const main = await open(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const a = await box(page, "/ts0");
    expect(Math.abs(right(a) - right(main))).toBeLessThan(2);
    expect((await box(page, "/border/start")).x).toBeGreaterThan(
        right(main) - 1,
    );
    expect(right(await box(page, "/border/end"))).toBeLessThan(main.x + 1);
});

test("a splitter drag follows the pointer, and aria-valuenow is the start child's share", async ({
    page,
}) => {
    const main = await open(page);
    const splitter = findPath(page, "/s0");
    const before = await box(page, "/ts0");
    const valueBefore = Number(await splitter.getAttribute("aria-valuenow"));
    // to the left: towards the end side, so the start tabset (on the right) grows
    await dragSplitter(page, splitter, false, -100);
    await expect
        .poll(async () => (await box(page, "/ts0")).width)
        .toBeGreaterThan(before.width + 90);
    const after = await box(page, "/ts0");
    expect(after.width).toBeLessThan(before.width + 110);
    expect(Math.abs(right(after) - right(main))).toBeLessThan(2);
    await expect
        .poll(async () => Number(await splitter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(valueBefore + 5);
});

test("a splitter's arrow keys move it the way they point on screen", async ({
    page,
}) => {
    await open(page);
    const splitter = findPath(page, "/s0");
    const before = await box(page, "/s0");
    const value = Number(await splitter.getAttribute("aria-valuenow"));
    await splitter.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
        .poll(async () => Math.round((await box(page, "/s0")).x))
        .toBe(Math.round(before.x - 10));
    await expect
        .poll(async () => Number(await splitter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(value);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect
        .poll(async () => Math.round((await box(page, "/s0")).x))
        .toBe(Math.round(before.x + 10));
    await expect
        .poll(async () => Number(await splitter.getAttribute("aria-valuenow")))
        .toBeLessThan(value);
});

test("a side drop lands on the side the pointer is near: end on the left, start on the right", async ({
    page,
}) => {
    await open(page);
    const content = await box(page, "/ts0/content");
    const outline = findPath(page, "/outline");
    const near = (x: number) => ({ x, y: content.y + content.height / 2 });

    const drag = await dragOverPoint(
        page,
        findPath(page, "/r1/ts1/tb0"),
        near(content.x + 10),
    );
    await expect(outline).toHaveAttribute("data-drop-location", "end");
    const endOutline = await waitForBox(outline, "outline");
    expect(Math.abs(endOutline.x - content.x)).toBeLessThan(2);
    await drag.moveTo(near(right(content) - 10));
    await expect(outline).toHaveAttribute("data-drop-location", "start");
    const startOutline = await waitForBox(outline, "outline");
    expect(Math.abs(right(startOutline) - right(content))).toBeLessThan(2);
    await drag.drop();

    // dropped at the start: a new tabset before A, rightmost on screen
    const five = page.getByRole("tab", { name: "Five" });
    await expect(five).toBeVisible();
    const fiveBox = await waitForBox(five, "Five");
    const a = await waitForBox(page.getByRole("tab", { name: "One" }), "One");
    expect(fiveBox.x).toBeGreaterThan(a.x);
});

test("an edge drop docks to the edge the pointer is near: end on the left, start on the right", async ({
    page,
}) => {
    const main = await open(page);
    const outline = findPath(page, "/outline");
    const { y } = middle(main);
    const drag = await dragOverPoint(page, findPath(page, "/r1/ts1/tb0"), {
        x: main.x + 4,
        y,
    });
    await expect(outline).toHaveAttribute("data-drop-location", "end");
    await expect(outline).toHaveAttribute("data-drop-kind", "edge");
    await expect(findPath(page, "/edge/end")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    const endBand = await box(page, "/edge/end");
    expect(Math.abs(endBand.x - main.x)).toBeLessThan(2);
    await drag.moveTo({ x: right(main) - 4, y });
    await expect(outline).toHaveAttribute("data-drop-location", "start");
    const startOutline = await waitForBox(outline, "outline");
    expect(Math.abs(right(startOutline) - right(main))).toBeLessThan(2);
    await drag.moveTo({ x: main.x + 4, y });
    await expect(outline).toHaveAttribute("data-drop-location", "end");
    await drag.drop();

    // docked at the end: the leftmost tabset, as tall as the layout
    const five = await waitForBox(
        page.getByRole("tab", { name: "Five" }),
        "Five",
    );
    expect(five.x).toBeLessThan(main.x + main.width / 4);
    expect(five.y).toBeLessThan(main.y + 2);
});

test("strip drops go before a tab's start half, after its end half, in reading order", async ({
    page,
}) => {
    await open(page);
    const strip = findPath(page, "/ts0/tabstrip");
    const [one, two, three] = await Promise.all(
        [0, 1, 2].map((i) => box(page, `/ts0/tb${i}`)),
    );
    if (!one || !two || !three) throw new Error("three tabs expected");
    const at = (x: number) => ({ x, y: one.y + one.height / 2 });

    const drag = await dragOverPoint(
        page,
        findPath(page, "/r1/ts0/tb0"),
        at(right(one) - 4),
    );
    await expect(strip).toHaveAttribute("data-drop-index", "0");
    // the outline is a line on the start (right) edge of the first tab
    const first = await waitForBox(findPath(page, "/outline"), "outline");
    expect(Math.abs(first.x - right(one))).toBeLessThan(3);
    await drag.moveTo(at(three.x + 4));
    await expect(strip).toHaveAttribute("data-drop-index", "3");
    await drag.moveTo(at(right(two) - 4));
    await expect(strip).toHaveAttribute("data-drop-index", "1");
    await drag.drop();
    await expect
        .poll(() => labels(page, "/ts0"))
        .toEqual(["One", "Four", "Two", "Three"]);
});

test("the start and end borders open on their side and resize towards the layout", async ({
    page,
}) => {
    await open(page);
    await findPath(page, "/border/start/tb0").click();
    const start = await box(page, "/border/start/t0");
    const main = await box(page, "/main");
    expect(start.x).toBeGreaterThanOrEqual(right(main) - 1);

    const startSplitter = findPath(page, "/border/start/s-1");
    await expect(startSplitter).toHaveAttribute("aria-valuenow", "200");
    await startSplitter.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(startSplitter).toHaveAttribute("aria-valuenow", "210");
    await dragSplitter(page, startSplitter, false, -50);
    await expect
        .poll(async () =>
            Number(await startSplitter.getAttribute("aria-valuenow")),
        )
        .toBeGreaterThan(250);

    await findPath(page, "/border/end/tb0").click();
    const end = await box(page, "/border/end/t0");
    expect(right(end)).toBeLessThanOrEqual((await box(page, "/main")).x + 1);
    const endSplitter = findPath(page, "/border/end/s-1");
    await endSplitter.focus();
    await page.keyboard.press("ArrowRight");
    await expect(endSplitter).toHaveAttribute("aria-valuenow", "210");
    await dragSplitter(page, endSplitter, false, 50);
    await expect
        .poll(async () =>
            Number(await endSplitter.getAttribute("aria-valuenow")),
        )
        .toBeGreaterThan(250);
});

test("an overlay start border sits over the right of the layout, an end one over its left", async ({
    page,
}) => {
    const main = await open(page);
    await page.evaluate(() => {
        const model = window.__dockable?.model;
        for (const borderId of ["border_start", "border_end"]) {
            model?.run("border.configure", { borderId, mode: "overlay" });
        }
    });
    await findPath(page, "/border/start/tb0").click();
    const start = await box(page, "/border/start/t0");
    expect(Math.abs(right(start) - right(main))).toBeLessThan(2);
    sameWidth(await box(page, "/main"), main);

    await findPath(page, "/border/end/tb0").click();
    const end = await box(page, "/border/end/t0");
    expect(Math.abs(end.x - main.x)).toBeLessThan(2);
});

function sameWidth(a: Box, b: Box) {
    expect(Math.abs(a.width - b.width)).toBeLessThan(2);
}

test("a tab strip's arrow keys follow it from the right", async ({ page }) => {
    await open(page);
    const one = findPath(page, "/ts0/tb0");
    await one.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(findPath(page, "/ts0/tb1")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(findPath(page, "/ts0/tb2")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(findPath(page, "/ts0/tb1")).toBeFocused();
});

test("flipping dir at runtime moves the panels with the tabsets, no manual verb", async ({
    page,
}) => {
    await open(page);
    const panel = findPath(page, "/ts0/t0");
    const rtl = await waitForBox(panel, "panel");
    await page.evaluate(() => {
        document.documentElement.dir = "ltr";
    });
    await expect
        .poll(async () => (await box(page, "/ts0/content")).x)
        .toBeLessThan(rtl.x - 100);
    const content = await box(page, "/ts0/content");
    await expect
        .poll(async () => Math.round((await waitForBox(panel, "panel")).x))
        .toBe(Math.round(content.x));

    // and the interaction follows: ArrowRight is the next tab again
    await findPath(page, "/ts0/tb0").focus();
    await page.keyboard.press("ArrowRight");
    await expect(findPath(page, "/ts0/tb1")).toBeFocused();

    await page.evaluate(() => {
        document.documentElement.dir = "rtl";
    });
    await expect
        .poll(async () => Math.round((await waitForBox(panel, "panel")).x))
        .toBe(Math.round(rtl.x));
});

test("a popout of an RTL page is RTL, and its strip keys follow it", async ({
    page,
}) => {
    await open(page);
    await findPath(page, "/ts0/tb0").click();
    await findPath(page, "/ts0").getByTestId("popout-tabset").click();
    const popout = await waitForPopout(page.context(), page);
    await popout.waitForLoadState();
    await expect(popout.locator("html")).toHaveAttribute("dir", "rtl");
    const tabs = popout.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    const [one, two] = await Promise.all([
        waitForBox(tabs.nth(0), "One"),
        waitForBox(tabs.nth(1), "Two"),
    ]);
    expect(one.x).toBeGreaterThan(two.x);
    await tabs.nth(0).focus();
    await popout.keyboard.press("ArrowLeft");
    await expect(tabs.nth(1)).toBeFocused();

    // the page turns LTR on a wrapper (<body>, <html> stays rtl): the window follows the layout
    await page.evaluate(() => {
        document.body.dir = "ltr";
    });
    await expect(popout.locator("html")).toHaveAttribute("dir", "ltr");
    await expect
        .poll(async () => {
            const [a, b] = await Promise.all([
                tabs.nth(0).boundingBox(),
                tabs.nth(1).boundingBox(),
            ]);
            return (a?.x ?? 0) < (b?.x ?? 0);
        })
        .toBe(true);
    const panel = popout.getByRole("tabpanel");
    const content = popout.locator('[data-layout-path$="/content"]');
    await expect
        .poll(async () => {
            const [p, c] = await Promise.all([
                panel.boundingBox(),
                content.boundingBox(),
            ]);
            return Math.abs((p?.x ?? -1) - (c?.x ?? 1));
        })
        .toBeLessThan(1);
    await tabs.nth(0).focus();
    await popout.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
});
