// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), tests-playwright/a11y.spec.ts:
// the checks that apply to the skeleton's primitives. Copyright (c) 2017 Caplin Systems Ltd. MIT
// licence, see LICENSE.
import { expect, type Page, test } from "@playwright/test";
import { findPath, findTabButton, waitForBox } from "./helpers";

const open = async (page: Page, layout: string) => {
    await page.goto(`/fixtures/basic/?layout=${layout}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
};

test.describe("aria semantics", () => {
    test("tabs have roles and selection state", async ({ page }) => {
        await open(page, "multi");
        await expect(page.getByRole("tablist")).toHaveCount(2);
        await expect(page.getByRole("tab")).toHaveCount(4);
        await expect(findTabButton(page, "/ts0", 0)).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expect(findTabButton(page, "/ts0", 1)).toHaveAttribute(
            "aria-selected",
            "false",
        );
    });

    test("tab panels are labelled by their tab buttons", async ({ page }) => {
        await open(page, "multi");
        const panel = findPath(page, "/ts0/t0");
        const button = findTabButton(page, "/ts0", 0);
        await expect(panel).toHaveAttribute("role", "tabpanel");
        const labelledBy = await panel.getAttribute("aria-labelledby");
        expect(labelledBy).toBe(await button.getAttribute("id"));
        await expect(button).toHaveAttribute(
            "aria-controls",
            (await panel.getAttribute("id")) ?? "",
        );
        await expect(page.getByRole("tabpanel", { name: "One" })).toBeVisible();
    });

    test("selecting a tab updates aria-selected and keeps one tab stop", async ({
        page,
    }) => {
        await open(page, "multi");
        await findTabButton(page, "/ts0", 1).click();
        await expect(findTabButton(page, "/ts0", 1)).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expect(findTabButton(page, "/ts0", 0)).toHaveAttribute(
            "aria-selected",
            "false",
        );
        await expect(
            page.locator('[data-layout-path^="/ts0/tb"][tabindex="0"]'),
        ).toHaveCount(1);
    });

    test("splitters are focusable separators with a value", async ({
        page,
    }) => {
        await open(page, "test_two_tabs");
        const splitter = page.getByRole("separator");
        await expect(splitter).toHaveCount(1);
        await expect(splitter).toHaveAttribute("aria-orientation", "vertical");
        await expect(splitter).toHaveAttribute("aria-valuemin", "0");
        await expect(splitter).toHaveAttribute("aria-valuemax", "100");
        await expect(splitter).toHaveAttribute("aria-valuetext", /\d+%/);
        await expect(splitter).toHaveAttribute("tabindex", "0");
    });
});

test.describe("keyboard operation", () => {
    test("configured key toggles focus between tab and its content", async ({
        page,
    }) => {
        await open(page, "multi");
        const tab = findTabButton(page, "/ts0", 0);
        await tab.focus();
        await page.keyboard.press("F6");
        const inPanel = await page.evaluate(
            () => document.activeElement?.closest('[role="tabpanel"]') !== null,
        );
        expect(inPanel).toBe(true);
        await page.keyboard.press("F6");
        await expect(tab).toBeFocused();

        // enter on an already selected tab also enters the content
        await page.keyboard.press("Enter");
        const inPanel2 = await page.evaluate(
            () => document.activeElement?.closest('[role="tabpanel"]') !== null,
        );
        expect(inPanel2).toBe(true);
    });

    test("configured keys cycle focus between tabsets", async ({ page }) => {
        await open(page, "test_three_tabs");
        await expect(page.getByRole("tablist").first()).toHaveAttribute(
            "aria-keyshortcuts",
            "Control+] Control+[",
        );

        const tb0 = findTabButton(page, "/ts0", 0);
        const tb1 = findTabButton(page, "/ts1", 0);
        const tb2 = findTabButton(page, "/ts2", 0);

        await tb0.focus();
        await page.keyboard.press("Control+]");
        await expect(tb1).toBeFocused();
        await page.keyboard.press("Control+]");
        await expect(tb2).toBeFocused();
        await page.keyboard.press("Control+]"); // wraps to the first tabset
        await expect(tb0).toBeFocused();
        await page.keyboard.press("Control+["); // and wraps backwards
        await expect(tb2).toBeFocused();

        // the target tabset becomes the active tabset
        await expect(findPath(page, "/ts2")).toHaveAttribute("data-active", "");

        // also works with focus inside the tab content (F6 moves into the panel)
        await page.keyboard.press("F6");
        await page.keyboard.press("Control+]");
        await expect(tb0).toBeFocused();
    });
});
