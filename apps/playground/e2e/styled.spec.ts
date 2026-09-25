import { expect, test } from "@playwright/test";
import {
    dragOver,
    findPath,
    findTabButton,
    Location,
    waitForBox,
    waitForPopout,
} from "./helpers";

// A smoke test of the styled example: deep behaviour is covered on the unstyled fixtures.
test.describe("styled example", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/examples/styled/");
        await waitForBox(findPath(page, "/layout"), "layout root");
    });

    test("loads with the palette styles applied (Tailwind classes compiled)", async ({
        page,
    }) => {
        const selected = findTabButton(page, "/ts0", 0);
        await expect(selected).toHaveAttribute("data-selected", "");
        // a class that does not exist fails silently: assert computed values, not class names
        const background = await selected.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        expect(background).not.toBe("rgba(0, 0, 0, 0)");
        const unselected = await findTabButton(page, "/ts0", 1).evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        expect(unselected).not.toBe(background);
        const splitter = findPath(page, "/s0");
        await expect(splitter).toHaveCSS("width", "6px");
        await expect(splitter).toHaveAttribute("aria-label", "Resize");
    });

    test("a tab drag shows the drop indicator, rect then edge", async ({
        page,
    }) => {
        const indicator = findPath(page, "/outline");
        const drop = await dragOver(
            page,
            findTabButton(page, "/ts0", 1),
            findPath(page, "/r1/ts1/t0"),
            Location.CENTER,
        );
        await expect(indicator).toHaveAttribute("data-drop-location", "center");
        await expect(indicator).toHaveAttribute("data-drop-kind", "rect");
        const rectBorder = await indicator.evaluate(
            (el) => getComputedStyle(el).borderStyle,
        );
        expect(rectBorder).toBe("solid");

        const root = await waitForBox(findPath(page, "/layout"), "layout root");
        await page.mouse.move(
            root.x + root.width - 4,
            root.y + root.height / 2,
            { steps: 5 },
        );
        await page.mouse.move(
            root.x + root.width - 5,
            root.y + root.height / 2,
        );
        await expect(indicator).toHaveAttribute("data-drop-kind", "edge");
        await expect(indicator).toHaveAttribute("data-drop-location", "right");
        const edgeBorder = await indicator.evaluate(
            (el) => getComputedStyle(el).borderStyle,
        );
        expect(edgeBorder).toBe("dashed"); // edge and rect drops are styled apart
        await drop();
        await expect(indicator).toBeHidden();
    });

    test("the splitter keyboard resizes", async ({ page }) => {
        const before = await waitForBox(findPath(page, "/ts0"), "/ts0");
        await findPath(page, "/s0").focus();
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press("ArrowRight");
        }
        const after = await waitForBox(findPath(page, "/ts0"), "/ts0");
        expect(after.width).toBeGreaterThan(before.width + 25);
    });

    test("pop out and dock back, with the palette styles in the popout", async ({
        page,
    }) => {
        await findPath(page, "/ts0").getByTestId("popout").click();
        const popout = await waitForPopout(page.context(), page);
        const tab = popout.getByRole("tab", { name: "One" });
        await expect(tab).toBeVisible();
        const background = await tab.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        expect(background).not.toBe("rgba(0, 0, 0, 0)"); // mirrored Tailwind output + palette
        await popout.getByTestId("dock-back").evaluate((button) => {
            setTimeout(() => (button as HTMLElement).click(), 0);
        });
        await expect.poll(() => popout.isClosed()).toBe(true);
        await expect(page.getByRole("tab", { name: "One" })).toBeVisible();
    });
});
