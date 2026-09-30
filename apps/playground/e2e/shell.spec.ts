import { expect, type Locator, type Page, test } from "@playwright/test";
import { drag, findPath, Location, waitForPopout } from "./helpers";

// The shell around the examples of examples/react: sidebar, theme, stage, source panel. The
// examples' own behaviour is covered by examples/react's e2e; this checks they render here.

const sidebar = (page: Page) =>
    page.getByRole("navigation", { name: "Playground" });

const backgroundOf = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).backgroundColor);

async function openExample(page: Page, query: string) {
    await page.goto(`/?${query}`);
    const stage = page.getByTestId("stage");
    await expect(findPath(page, "/layout").first()).toBeVisible();
    return stage;
}

test("lists the site's examples and the fixtures, and opens an example from the sidebar", async ({
    page,
}) => {
    await page.goto("/");
    const nav = sidebar(page);
    await expect(nav.getByRole("heading", { name: "Examples" })).toBeVisible();
    await expect(nav.getByRole("heading", { name: "Fixtures" })).toBeVisible();
    await expect(
        nav.getByRole("link", { name: "Basic fixture" }),
    ).toHaveAttribute("href", "/fixtures/basic/");

    await nav.getByRole("link", { name: "Hello layout" }).click();
    await expect(page).toHaveURL(/\?example=hello-layout$/);
    await expect(findPath(page, "/layout").first()).toBeVisible();
    await expect(
        nav.getByRole("link", { name: "Hello layout" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle("Hello layout · Dockable playground");

    // choosing another entry is a navigation: back returns to the previous one
    await nav.getByRole("link", { name: "Unstyled" }).click();
    await expect(page).toHaveURL(/\?example=unstyled$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?example=hello-layout$/);
    await expect(
        nav.getByRole("link", { name: "Hello layout" }),
    ).toHaveAttribute("aria-current", "page");
});

test("switches the example theme live, and restores it from the URL", async ({
    page,
}) => {
    const stage = await openExample(page, "example=hello-layout");
    await expect(stage).toHaveAttribute("data-example-theme", "light");
    const layout = findPath(page, "/layout").first();
    // a class that compiled to nothing fails silently: assert computed values, not class names
    const light = await backgroundOf(layout);
    expect(light).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByRole("button", { name: "Terminal" }).click();
    await expect(stage).toHaveAttribute("data-example-theme", "terminal");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => backgroundOf(layout)).not.toBe(light);
    await expect(page).toHaveURL(/theme=terminal/);

    await page.reload();
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    await expect(
        page.getByRole("button", { name: "Terminal" }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("an example works in the stage: a tab dragged into the other tabset", async ({
    page,
}) => {
    await openExample(page, "example=hello-layout");
    await drag(
        page,
        findPath(page, "/ts0/tb1"),
        findPath(page, "/ts1/content"),
        Location.CENTER,
    );
    await expect(findPath(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Inspector",
        "Notes",
    ]);
});

test("shows the example's files in the source panel", async ({ page }) => {
    await openExample(page, "example=hello-layout");
    await page.getByRole("button", { name: "Source" }).click();
    const panel = page.getByRole("complementary", { name: "Source" });
    await expect(panel.getByTestId("source-path")).toHaveText(
        "examples/react/src/examples/hello-layout/index.tsx",
    );
    await expect(panel.locator("code")).toContainText(
        "export default function HelloLayout",
    );
    await expect(page).toHaveURL(/code=1/);
});

test("opens a popout window from the playground, themed like the stage", async ({
    page,
    context,
}) => {
    await openExample(page, "example=popout&theme=terminal");
    await findPath(page, "/ts1")
        .getByRole("button", { name: "Pop out Chat" })
        .click();
    const popout = await waitForPopout(context, page);
    await expect(popout.locator("body")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    await expect(
        popout.locator("body [data-layout-path]").first(),
    ).toBeVisible();
});

test("names an unknown example instead of rendering nothing", async ({
    page,
}) => {
    await page.goto("/?example=nope");
    await expect(page.getByRole("main")).toContainText(
        "No example with id “nope”.",
    );
});
