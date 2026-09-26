import { expect, type Locator, type Page } from "@playwright/test";
import { THEMES, type ThemeName } from "../examples/_themes/themes";
import { EXAMPLES } from "../examples/manifest.generated";

export { EXAMPLES, THEMES };

/** Opens an example in a theme and waits for its layout to mount. */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName; code?: boolean } = {},
) {
    const params = new URLSearchParams();
    if (options.theme) params.set("theme", options.theme);
    if (options.code) params.set("code", "1");
    const query = params.toString();
    await page.goto(`examples/${slug}/${query ? `?${query}` : ""}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(stage).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await expect(
        stage.locator('[data-layout-path="/layout"]').first(),
    ).toBeVisible();
    return stage;
}

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    return errors;
}

/** A locator for a layout path inside the stage. */
export function path(page: Page, layoutPath: string) {
    return page
        .getByTestId("stage")
        .locator(`[data-layout-path="${layoutPath}"]`);
}

/** The centre of a locator's box. */
export async function centre(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("no bounding box");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Starts a native HTML5 drag of `from` (as apps/playground/e2e/helpers.ts does): press, wait,
 * then move ~10px so the browser fires dragstart even when the target is near.
 */
export async function startDrag(page: Page, from: Locator) {
    const start = await centre(from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.move(start.x + 10, start.y + 10);
    await page.mouse.move(start.x + 11, start.y + 11);
}

/**
 * Moves an active drag to `point`. A step that crosses into another element can fire only
 * dragenter/dragleave, so a 1px nudge at the end makes a dragover report the final point.
 */
export async function moveDragTo(page: Page, point: { x: number; y: number }) {
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.mouse.move(point.x + 1, point.y);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(50);
}

/** Drags `from` to `point` and drops it there. */
export async function dragTo(
    page: Page,
    from: Locator,
    point: { x: number; y: number },
) {
    await startDrag(page, from);
    await moveDragTo(page, point);
    await page.mouse.up();
}

/** The popout window, once exactly one extra page stays open (StrictMode opens, closes, reopens). */
export async function waitForPopout(page: Page, count = 1): Promise<Page[]> {
    let candidates: Page[] = [];
    await expect
        .poll(
            () => {
                const live = page
                    .context()
                    .pages()
                    .filter((p) => p !== page && !p.isClosed());
                const stable =
                    live.length === count &&
                    live.every((p, i) => p === candidates[i]);
                candidates = live;
                return stable;
            },
            { timeout: 15000, intervals: [250] },
        )
        .toBe(true);
    return candidates;
}

/**
 * Drags `source` onto the centre of `target` in another window, with synthetic drag events: HTML5
 * drag and drop cannot be driven across windows with the mouse. The drag state lives in
 * JavaScript, shared by the windows of a page, so the events only need to reach the right elements.
 */
export async function dragAcrossWindows(source: Locator, target: Locator) {
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("no box");
    await source.evaluate(
        (el, { x, y }) => {
            el.dispatchEvent(
                new DragEvent("dragstart", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: new DataTransfer(),
                    clientX: x,
                    clientY: y,
                }),
            );
        },
        { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    );
    await target.evaluate(
        (el, { x, y }) => {
            const init = {
                bubbles: true,
                cancelable: true,
                dataTransfer: new DataTransfer(),
                clientX: x,
                clientY: y,
            };
            el.dispatchEvent(new DragEvent("dragenter", init));
            el.dispatchEvent(new DragEvent("dragover", init));
            el.dispatchEvent(new DragEvent("drop", init));
        },
        { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    );
}
