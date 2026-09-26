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

/** the number of tabsets rendered (each has exactly one tab list) */
export const findAllTabSets = (page: Page) => {
    return page.getByRole("tablist");
};

export enum Location {
    CENTER = 0,
    TOP = 1,
    BOTTOM = 2,
    LEFT = 3,
    RIGHT = 4,
}

function getLocation(rect: Box, loc: Location) {
    switch (loc) {
        case Location.CENTER:
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        case Location.TOP:
            return { x: rect.x + rect.width / 2, y: rect.y + 5 };
        case Location.BOTTOM:
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height - 5 };
        case Location.LEFT:
            return { x: rect.x + 5, y: rect.y + rect.height / 2 };
        case Location.RIGHT:
            return { x: rect.x + rect.width - 5, y: rect.y + rect.height / 2 };
    }
}

/** starts a native drag of `from`: press, then move far enough for dragstart to fire */
async function startDrag(page: Page, from: Locator) {
    const fr = await waitForBox(from, "drag source");
    const cf = getLocation(fr, Location.CENTER);
    await page.mouse.move(cf.x, cf.y);
    await page.mouse.down();
    await page.waitForTimeout(50); // let the native drag start before moving
    // native HTML5 drag requires a minimum movement before dragstart fires; move at least ~10px
    // first so the drag session starts even when the final target is nearby
    await page.mouse.move(cf.x + 10, cf.y + 10);
    await page.mouse.move(cf.x + 11, cf.y + 11);
}

/**
 * moves an active drag to `point`. A step that crosses into another element can fire only
 * dragenter/dragleave, so a 1px nudge at the end makes sure a dragover reports the final point
 */
async function moveDragTo(page: Page, point: { x: number; y: number }) {
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.mouse.move(point.x + 1, point.y);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(50); // let dragover register before the drop
}

/** moves an active drag to `point` and drops it there */
async function dropAt(page: Page, point: { x: number; y: number }) {
    await moveDragTo(page, point);
    await page.mouse.up();
}

/** drags `from` onto `loc` of `to` */
export async function drag(
    page: Page,
    from: Locator,
    to: Locator,
    loc: Location,
) {
    const tr = await waitForBox(to, "drag target");
    await startDrag(page, from);
    await dropAt(page, getLocation(tr, loc));
}

/** the layout edges, in FlexLayout's edge indicator order */
export enum Edge {
    TOP = 0,
    LEFT = 1,
    BOTTOM = 2,
    RIGHT = 3,
}

/**
 * drags `from` to an edge of the layout root: the middle of that edge, 4px inside it (edge docking
 * takes the outer 10px band around each edge's centre)
 */
export async function dragToEdge(page: Page, from: Locator, edge: Edge) {
    const root = await waitForBox(findPath(page, "/layout"), "layout root");
    const cx = root.x + root.width / 2;
    const cy = root.y + root.height / 2;
    const point = {
        [Edge.TOP]: { x: cx, y: root.y + 4 },
        [Edge.LEFT]: { x: root.x + 4, y: cy },
        [Edge.BOTTOM]: { x: cx, y: root.y + root.height - 4 },
        [Edge.RIGHT]: { x: root.x + root.width - 4, y: cy },
    }[edge];
    await startDrag(page, from);
    await dropAt(page, point);
}

/** starts dragging `from` and hovers `loc` of `to` without dropping; returns a drop function */
export async function dragOver(
    page: Page,
    from: Locator,
    to: Locator,
    loc: Location,
) {
    const tr = await waitForBox(to, "drag target");
    await startDrag(page, from);
    await moveDragTo(page, getLocation(tr, loc));
    return async () => {
        await page.mouse.up();
    };
}

/**
 * Drags `source` into another window's layout with synthetic drag events: HTML5 drag and drop
 * cannot be driven across windows with the mouse (ported from FlexLayout's dragAcrossWindows).
 * The drag state lives in JavaScript (shared by the windows of a page), so the events only need to
 * reach the right elements. `drop: false` stops over the target, for checks mid-drag.
 */
export async function dragAcrossWindows(
    source: Locator,
    targetPage: Page,
    target: Locator,
    loc: Location,
    options: { drop?: boolean } = {},
) {
    const fr = await waitForBox(source, "cross-window drag source");
    const tr = await waitForBox(target, "cross-window drag target");
    const cf = getLocation(fr, Location.CENTER);
    const ct = getLocation(tr, loc);

    await source.evaluate(
        (el, { x, y }: { x: number; y: number }) => {
            const dt = new DataTransfer();
            el.dispatchEvent(
                new DragEvent("dragstart", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dt,
                    clientX: x,
                    clientY: y,
                }),
            );
        },
        { x: cf.x, y: cf.y },
    );
    await target.evaluate(
        (el, { x, y, drop }: { x: number; y: number; drop: boolean }) => {
            const dt = new DataTransfer();
            const init = {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
                clientX: x,
                clientY: y,
            };
            el.dispatchEvent(new DragEvent("dragenter", init));
            el.dispatchEvent(new DragEvent("dragover", init));
            if (drop) {
                el.dispatchEvent(new DragEvent("drop", init));
            }
        },
        { x: ct.x, y: ct.y, drop: options.drop !== false },
    );
    void targetPage;
}
