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

export const findTabButton = (page: Page, path: string, index: number) => {
    return findPath(page, `${path}/tb${index}`);
};

/** the tab button and panel at `path`/`index`: selection state, name, and panel visibility */
export const checkTab = async (
    page: Page,
    path: string,
    index: number,
    selected: boolean,
    text: string,
) => {
    const tabButton = findTabButton(page, path, index);
    const tabContent = findPath(page, `${path}/t${index}`);

    await expect(tabButton).toBeVisible();
    await expect(tabButton).toHaveAttribute("aria-selected", String(selected));
    await expect(tabButton).toContainText(text);

    await expect(tabContent).toBeVisible({ visible: selected });
    if (selected) {
        await expect(tabContent).toContainText(text);
    }
};

/** drags a splitter by `distance` px along its axis (`upDown` for a splitter between stacked children) */
export async function dragSplitter(
    page: Page,
    from: Locator,
    upDown: boolean,
    distance: number,
) {
    const fr = await waitForBox(from, "splitter");
    const cf = { x: fr.x + fr.width / 2, y: fr.y + fr.height / 2 };
    const ct = {
        x: cf.x + (upDown ? 0 : distance),
        y: cf.y + (upDown ? distance : 0),
    };
    // firefox drops input events with coordinates outside the viewport; clamp the target to the
    // viewport edges. the splitter position is clamped to the layout bounds by the library itself,
    // so an oversized drag lands on the same bound either way
    const vp = page.viewportSize();
    const clamp = (p: { x: number; y: number }) => {
        if (!vp) return p;
        return {
            x: Math.max(0, Math.min(vp.width - 1, p.x)),
            y: Math.max(0, Math.min(vp.height - 1, p.y)),
        };
    };
    const target = clamp(ct);
    await page.mouse.move(cf.x, cf.y);
    await page.mouse.down();
    await page.waitForTimeout(50);
    // nudge along the drag axis first so small distances still fire pointermove
    const dir = distance === 0 ? 1 : Math.sign(distance);
    for (const step of [12, 13]) {
        const n = clamp(
            upDown
                ? { x: cf.x, y: cf.y + dir * step }
                : { x: cf.x + dir * step, y: cf.y },
        );
        await page.mouse.move(n.x, n.y);
    }
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(50);
    await page.mouse.up();
}
