import { expect, test } from "@playwright/test";
import { EXAMPLES, openExample } from "./helpers";

// The examples browser: navigation, theme and code state in the URL, the code
// panel's files and copy buttons, reset, and the small-screen drawers.

const first = EXAMPLES[0];
if (!first) throw new Error("no examples");

test("/examples opens the first example", async ({ page }) => {
    await page.goto("examples/");
    await expect(page).toHaveURL(new RegExp(`/examples/${first.slug}/`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        first.meta.title,
    );
});

test("lists every example under its level", async ({ page }) => {
    await openExample(page, first.slug);
    const list = page.getByRole("navigation", { name: "Examples" });
    for (const example of EXAMPLES) {
        await expect(
            list.getByRole("link", { name: example.meta.title, exact: true }),
        ).toBeVisible();
    }
    await expect(
        list.getByRole("link", { name: first.meta.title, exact: true }),
    ).toHaveAttribute("aria-current", "page");
});

test("the filter narrows the list", async ({ page }) => {
    await openExample(page, first.slug);
    const list = page.getByRole("navigation", { name: "Examples" });
    await list.getByRole("searchbox").fill("zzzz-no-match");
    await expect(list.getByText("No example matches.")).toBeVisible();
    await list.getByRole("searchbox").fill(first.meta.title);
    await expect(
        list.getByRole("link", { name: first.meta.title, exact: true }),
    ).toBeVisible();
});

test("the theme switcher changes the stage theme and the URL, without a reload", async ({
    page,
}) => {
    const stage = await openExample(page, first.slug);
    await expect(stage).toHaveAttribute("data-example-theme", "light");
    await page.evaluate(() => {
        (window as unknown as { marker: boolean }).marker = true;
    });
    await page.locator('[data-theme-option="terminal"]').click();
    await expect(stage).toHaveAttribute("data-example-theme", "terminal");
    await expect(page).toHaveURL(/theme=terminal/);
    expect(
        await page.evaluate(
            () => (window as unknown as { marker?: boolean }).marker,
        ),
    ).toBe(true);
    await page.reload();
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
});

test("the code panel shows every file, and copies one or all", async ({
    page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openExample(page, first.slug);
    await page.getByTestId("toggle-code").click();
    await expect(page).toHaveURL(/code=1/);
    const panel = page.getByRole("complementary", { name: "Example code" });
    const tabs = panel.getByRole("tablist", { name: "Files" }).getByRole("tab");
    // the example's files, plus the current theme's CSS
    await expect(tabs).toHaveCount(first.files.length + 1);
    await expect(tabs.first()).toHaveText(first.files[0] ?? "");
    await expect(tabs.last()).toHaveText("_themes/light.css");

    await panel.getByTestId("copy-file").click();
    await expect(panel.getByTestId("copy-file")).toHaveAttribute(
        "data-copied",
        "",
    );
    const one = await page.evaluate(() => navigator.clipboard.readText());
    expect(one).toContain("export default function");

    await panel.getByTestId("copy-all").click();
    const all = await page.evaluate(() => navigator.clipboard.readText());
    for (const file of first.files) {
        expect(all).toContain(`// ${file}\n`);
    }

    await tabs.nth(1).click();
    await expect(panel.getByTestId("code-file")).toHaveAttribute(
        "data-path",
        first.files[1] ?? "",
    );
    await page.reload();
    await expect(
        page
            .getByRole("complementary", { name: "Example code" })
            .getByRole("tablist"),
    ).toBeVisible();
});

test("reset remounts the example", async ({ page }) => {
    await openExample(page, "hello-layout");
    const counter = page.getByTestId("stage").getByTestId("counter").first();
    await counter.click();
    await counter.click();
    await expect(counter).toHaveText("Count: 2");
    await page.getByTestId("reset").click();
    await expect(
        page.getByTestId("stage").getByTestId("counter").first(),
    ).toHaveText("Count: 0");
});

test("small screens get drawers for the list and the code", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openExample(page, first.slug);
    const list = page.getByRole("navigation", { name: "Examples" });
    await expect(list).toBeHidden();
    await page.getByRole("button", { name: "Examples list" }).click();
    await expect(list).toBeVisible();
    await list
        .getByRole("link", { name: first.meta.title, exact: true })
        .click();
    await expect(list).toBeHidden();
    await page.getByTestId("toggle-code").click();
    await expect(
        page.getByRole("complementary", { name: "Example code" }),
    ).toBeVisible();
    const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(375);
});
