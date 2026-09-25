// The realtime cases are adapted from FlexLayout (https://github.com/caplin/FlexLayout),
// tests-playwright/realtime-splitter.spec.ts; the keyboard case from tests-playwright/a11y.spec.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { expect, type Page, test } from "@playwright/test";
import { dragSplitter, findPath, waitForBox } from "./helpers";

const open = async (page: Page, layout: string, extra = "") => {
    await page.goto(`/fixtures/basic/?layout=${layout}${extra}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

test.describe("splitter", () => {
    test("pointer drag resizes in realtime", async ({ page }) => {
        await open(page, "test_two_tabs");
        const before = await waitForBox(findPath(page, "/ts0"), "/ts0");
        await dragSplitter(page, findPath(page, "/s0"), false, 100);
        const after = await waitForBox(findPath(page, "/ts0"), "/ts0");
        expect(after.width).toBeGreaterThan(before.width + 80);
        // the panel follows its content area
        const content = await waitForBox(
            findPath(page, "/ts0/content"),
            "/ts0/content",
        );
        const panel = await waitForBox(findPath(page, "/ts0/t0"), "/ts0/t0");
        expect(Math.abs(panel.width - content.width)).toBeLessThan(1);
    });

    test("outline drag previews on the splitter and commits on release", async ({
        page,
    }) => {
        await open(page, "test_two_tabs", "&realtime=false");
        const splitter = findPath(page, "/s0");
        const before = await waitForBox(findPath(page, "/ts0"), "/ts0");
        const sr = await waitForBox(splitter, "/s0");

        await page.mouse.move(sr.x + sr.width / 2, sr.y + sr.height / 2);
        await page.mouse.down();
        await page.mouse.move(sr.x + sr.width / 2 + 60, sr.y + sr.height / 2, {
            steps: 5,
        });
        await expect(splitter).toHaveAttribute("data-dragging", "");
        await expect(splitter).toHaveCSS(
            "transform",
            /matrix\(1, 0, 0, 1, 60, 0\)/,
        );
        // nothing resized yet
        expect((await findPath(page, "/ts0").boundingBox())?.width).toBeCloseTo(
            before.width,
            0,
        );

        await page.mouse.up();
        await expect(splitter).not.toHaveAttribute("data-dragging");
        await expect(splitter).toHaveCSS("transform", "none");
        await expect
            .poll(
                async () => (await findPath(page, "/ts0").boundingBox())?.width,
            )
            .toBeGreaterThan(before.width + 50);
    });

    test("arrow keys resize a focused splitter", async ({ page }) => {
        await open(page, "test_two_tabs");
        const splitter = findPath(page, "/s0");
        const before = await waitForBox(findPath(page, "/ts0"), "/ts0");
        await expect(splitter).toHaveAttribute("aria-valuenow", /\d+/);
        const valueBefore = Number(
            await splitter.getAttribute("aria-valuenow"),
        );

        await splitter.focus();
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press("ArrowLeft");
        }
        const after = await waitForBox(findPath(page, "/ts0"), "/ts0");
        expect(after.width).toBeLessThan(before.width - 30);
        await expect
            .poll(async () =>
                Number(await splitter.getAttribute("aria-valuenow")),
            )
            .toBeLessThan(valueBefore);
    });

    test("realtime row drag keeps weights finite", async ({ page }) => {
        await open(page, "big");
        const sr = await waitForBox(findPath(page, "/s0"), "/s0");

        const bad = await page.evaluate(
            ({ cx, cy }) => {
                const opts = (x: number, y: number) => ({
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    pointerId: 1,
                });
                const splitter = document.querySelector(
                    '[data-layout-path="/s0"]',
                ) as HTMLElement;
                splitter.dispatchEvent(
                    new PointerEvent("pointerdown", opts(cx, cy)),
                );
                for (let i = 0; i < 30; i++) {
                    document.dispatchEvent(
                        new PointerEvent(
                            "pointermove",
                            opts(cx + (i % 10) * 6, cy),
                        ),
                    );
                }
                document.dispatchEvent(
                    new PointerEvent("pointerup", opts(cx, cy)),
                );

                const result: string[] = [];
                for (const el of document.querySelectorAll<HTMLElement>(
                    '[data-layout-path^="/r"], [data-layout-path^="/ts"]',
                )) {
                    if (el.getAttribute("role")) continue; // tabs, panels
                    const fg = Number(getComputedStyle(el).flexGrow);
                    if (!Number.isFinite(fg) || fg <= 0) {
                        result.push(`${el.dataset.layoutPath}: ${fg}`);
                    }
                }
                return result;
            },
            { cx: sr.x + sr.width / 2, cy: sr.y + sr.height / 2 },
        );
        expect(bad).toEqual([]);
        await expect(findPath(page, "/s0")).not.toHaveAttribute(
            "data-dragging",
        );
    });

    test("realtime row drag to the edge still fills the row (weight conservation)", async ({
        page,
    }) => {
        await open(page, "big");
        const sr = await waitForBox(findPath(page, "/s0"), "/s0");

        // drag far past the min-size bound; the splitter must clamp and the weights stay finite
        await page.evaluate(
            ({ cx, cy }) => {
                const opts = (x: number, y: number) => ({
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    pointerId: 1,
                });
                const splitter = document.querySelector(
                    '[data-layout-path="/s0"]',
                ) as HTMLElement;
                splitter.dispatchEvent(
                    new PointerEvent("pointerdown", opts(cx, cy)),
                );
                for (let i = 0; i < 20; i++) {
                    document.dispatchEvent(
                        new PointerEvent("pointermove", opts(cx + 1000, cy)),
                    );
                }
                document.dispatchEvent(
                    new PointerEvent("pointerup", opts(cx + 1000, cy)),
                );
            },
            { cx: sr.x + sr.width / 2, cy: sr.y + sr.height / 2 },
        );

        const fills = await page.evaluate(() => {
            const root = document.querySelector(
                '[data-layout-path="/row"]',
            ) as HTMLElement;
            const rootW = root.getBoundingClientRect().width;
            let childrenW = 0;
            const bad: string[] = [];
            for (const el of root.children) {
                childrenW += el.getBoundingClientRect().width;
                if (
                    el instanceof HTMLElement &&
                    !Number.isFinite(Number(getComputedStyle(el).flexGrow))
                ) {
                    bad.push(`${el.dataset.layoutPath}`);
                }
            }
            return { fills: Math.abs(rootW - childrenW) < 2, bad };
        });
        expect(fills.bad).toEqual([]);
        expect(fills.fills).toBe(true);
    });
});
