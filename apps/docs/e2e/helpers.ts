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
