import {
    expect,
    type FrameLocator,
    type Locator,
    type Page,
    test,
} from "@playwright/test";
import { examplesApp, listExampleSlugs } from "../scripts/examples-lib.ts";
import { THEMES, type ThemeName } from "../src/themes/themes.ts";
import { embedBase, frameworkOf, skipOrFail } from "./available.ts";

// The examples run in a framework's embed app, addressed by its directory URL (`…/?id=`, §5.1 of
// the site export contract), alone on the page: the stage is the page's own `data-testid="stage"`,
// and the site's Reset (which reloads the iframe) is a reload.
//
// Every framework runs these specs (config.ts). They reach the examples only through what every
// adapter reproduces: `data-layout-path`, roles and accessible names, `data-*` state and test ids
// the example sets itself; never a class name or a framework detail.

/** The framework under test, set by the app's playwright.config.ts. */
export const FRAMEWORK = frameworkOf(process.env.EXAMPLES_FRAMEWORK);
/** Where the e2e server mounts its embed (serve.ts). */
export const EMBED_BASE = embedBase(FRAMEWORK);
const AVAILABLE = listExampleSlugs(examplesApp(FRAMEWORK));
/** The framework's examples: a spec loops over these, never over a fixed list. */
export const EXAMPLES = AVAILABLE.map((slug) => ({ slug }));
export { THEMES };

/**
 * Skips the running test (or, at the top of a spec file, the whole file) when the framework has
 * not every one of these examples: a framework may ship a subset of them. A complete framework
 * (React, Vue, Angular) fails instead.
 */
export function requireExamples(...slugs: string[]) {
    const reason = skipOrFail(FRAMEWORK, AVAILABLE, slugs);
    test.skip(reason !== undefined, reason);
}

/**
 * Opens an example in a theme and waits for its layout to mount. Skips the test when the
 * framework has no such example.
 */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName } = {},
) {
    requireExamples(slug);
    const params = new URLSearchParams({ id: slug });
    if (options.theme) params.set("theme", options.theme);
    await page.goto(`./?${params}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await expect(
        stage.locator('[data-layout-path="/layout"]').first(),
    ).toBeVisible();
    return stage;
}

/**
 * Opens an example as fragiola.com shows it: in an iframe of a same-origin page (serve.ts,
 * /host.html). Skips the test when the framework has no such example (an unknown id is opened
 * with `page.goto` instead).
 */
export async function openHosted(
    page: Page,
    query: { id: string; theme?: string },
): Promise<FrameLocator> {
    requireExamples(query.id);
    await page.goto(`/host.html?${new URLSearchParams(query)}`);
    const frame = page.frameLocator('[data-testid="frame"]');
    await expect(
        frame.locator('[data-layout-path="/layout"]').first(),
    ).toBeVisible();
    return frame;
}

/** The site's Reset: it reloads the example's frame. */
export async function reset(page: Page) {
    await page.reload();
    await expect(
        page
            .getByTestId("stage")
            .locator('[data-layout-path="/layout"]')
            .first(),
    ).toBeVisible();
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
