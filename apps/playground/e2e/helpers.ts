// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), tests-playwright/helpers.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type BrowserContext,
    expect,
    type Locator,
    type Page,
} from "@playwright/test";

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Wait until `locator` has a real (non-null) bounding box and the box is stable (two consecutive
 * polls agree), then return it. boundingBox() returns null for an element that is attached but not
 * yet laid out (zero size or hidden), which happens transiently after a reload or a drag that
 * reshapes the layout. Requiring two stable measurements avoids catching a brief flicker during a
 * re-measure, so the returned box reflects the settled layout.
 */
export async function waitForBox(
    locator: Locator,
    label: string,
): Promise<Box> {
    let last: Box | null = null;
    let stable = false;
    await expect
        .poll(
            async () => {
                const box = await locator.boundingBox().catch(() => null);
                stable =
                    box !== null &&
                    last !== null &&
                    Math.abs(box.x - last.x) < 1 &&
                    Math.abs(box.y - last.y) < 1 &&
                    Math.abs(box.width - last.width) < 1 &&
                    Math.abs(box.height - last.height) < 1;
                last = box;
                return stable;
            },
            {
                timeout: 15000,
                message: `timed out waiting for a stable bounding box for ${label}`,
            },
        )
        .toBe(true);
    if (!last) throw new Error(`Could not get bounding box for ${label}`);
    return last;
}

/**
 * Wait for a popout window and return its page. Under react strict mode (dev) the popout component
 * double-mounts: the first window opens and immediately closes and the reopened one stays, so a
 * single sample of `context.pages()` can catch the doomed first window (or the gap between the
 * two windows, where no live popout exists at all). Requires the same live non-main page on two
 * consecutive samples 250ms apart, which the short-lived first window cannot satisfy.
 */
export async function waitForPopout(
    context: BrowserContext,
    mainPage: Page,
): Promise<Page> {
    let candidate: Page | null = null;
    await expect
        .poll(
            async () => {
                const live = context
                    .pages()
                    .filter((p) => p !== mainPage && !p.isClosed());
                const next = live.length === 1 ? (live[0] ?? null) : null;
                const stable = next !== null && next === candidate;
                candidate = next;
                return stable;
            },
            {
                timeout: 15000,
                message: "timed out waiting for the popout window to stay open",
                intervals: [250],
            },
        )
        .toBe(true);
    if (!candidate) throw new Error("no popout window");
    return candidate;
}

export const findPath = (page: Page, path: string) => {
    return page.locator(`[data-layout-path="${path}"]`);
};
