import { expect, type Page, test } from "@playwright/test";
import { moveDragTo, openExample, path, startDrag } from "../helpers";

async function box(page: Page, layoutPath: string) {
    const b = await path(page, layoutPath).boundingBox();
    if (!b) throw new Error(`no box for ${layoutPath}`);
    return b;
}

test("start is on the right: the first tabset, the start border, and the splitter keys follow the screen", async ({
    page,
}) => {
    await openExample(page, "rtl-layout");
    const main = await box(page, "/main");
    const first = await box(page, "/ts0");
    expect(
        Math.abs(first.x + first.width - (main.x + main.width)),
    ).toBeLessThan(2);
    expect((await box(page, "/border/start")).x).toBeGreaterThan(main.x);
    expect((await box(page, "/border/end")).x).toBeLessThan(main.x);

    // ArrowLeft moves the splitter left: the start tabset, on the right, grows
    const splitter = path(page, "/s0");
    const value = Number(await splitter.getAttribute("aria-valuenow"));
    const x = (await box(page, "/s0")).x;
    await splitter.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
        .poll(async () => Math.abs((await box(page, "/s0")).x - (x - 10)))
        .toBeLessThan(1);
    await expect
        .poll(async () => Number(await splitter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(value);

    // the tab strip runs from the right: ArrowLeft is the next tab
    await path(page, "/ts0/tb0").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(path(page, "/ts0/tb1")).toBeFocused();
});

test("a drag near the right edge docks at the start", async ({ page }) => {
    await openExample(page, "rtl-layout");
    const main = await box(page, "/main");
    await startDrag(page, path(page, "/r1/ts1/tb0"));
    await moveDragTo(page, {
        x: main.x + main.width - 4,
        y: main.y + main.height / 2,
    });
    const outline = path(page, "/outline");
    await expect(outline).toHaveAttribute("data-drop-location", "start");
    await expect(path(page, "/edge/start")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    await page.mouse.up();
    // a new first tabset: rightmost
    const traffic = page.getByRole("tab", { name: "Traffic" });
    const message = page.getByRole("tab", { name: "Message" });
    await expect
        .poll(
            async () =>
                ((await traffic.boundingBox())?.x ?? 0) -
                ((await message.boundingBox())?.x ?? 0),
        )
        .toBeGreaterThan(0);
});

test("flipping the direction moves the panels and the borders, with no manual measure", async ({
    page,
}) => {
    const stage = await openExample(page, "rtl-layout");
    const panel = path(page, "/ts0/t0");
    const rtl = await panel.boundingBox();
    await stage.getByTestId("direction").click();
    await expect(stage.getByTestId("direction")).toHaveAttribute(
        "aria-pressed",
        "false",
    );
    await expect
        .poll(async () => (await panel.boundingBox())?.x ?? 0)
        .toBeLessThan((rtl?.x ?? 0) - 100);
    const content = await box(page, "/ts0/content");
    await expect
        .poll(async () => Math.round((await panel.boundingBox())?.x ?? 0))
        .toBe(Math.round(content.x));
    expect((await box(page, "/border/start")).x).toBeLessThan(
        (await box(page, "/main")).x,
    );
});

test("in a frame, as the site shows it, the keys follow the direction", async ({
    page,
}) => {
    await page.goto(`/host.html?${new URLSearchParams({ id: "rtl-layout" })}`);
    const frame = page.frameLocator('[data-testid="frame"]');
    const tab = (i: number) =>
        frame.locator(`[data-layout-path="/ts0/tb${i}"]`);
    await expect(tab(0)).toBeVisible();
    await tab(0).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(1)).toBeFocused();
});
