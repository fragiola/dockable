import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, EXAMPLES } from "./helpers";

// The written docs on the exported site: search finds primitives, props and attributes through
// the search dialog (the static index at api/search), pages render without console errors, and
// the <Example> cards link the examples browser under the base path.

async function search(page: Page, query: string) {
    await page.goto("docs/getting-started/introduction/");
    await page
        .getByRole("button", { name: /search/i })
        .first()
        .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Search").fill(query);
    return dialog;
}

for (const query of ["maximize", "popoutURL", "data-selected"]) {
    test(`search finds "${query}"`, async ({ page: browser }) => {
        const errors = collectErrors(browser);
        const dialog = await search(browser, query);
        const results = dialog.getByRole("button").filter({ hasText: /\S/ });
        await expect(
            results.filter({ hasText: new RegExp(query, "i") }).first(),
        ).toBeVisible();
        // the first result opens a page that talks about it
        await browser.keyboard.press("Enter");
        await expect(browser).toHaveURL(/\/dockable\/docs\/.+/);
        await expect(browser.getByRole("dialog")).toBeHidden();
        await expect(browser.locator("body")).toContainText(
            new RegExp(query, "i"),
        );
        expect(errors).toEqual([]);
    });
}

test("the static search index has the API terms", async ({ request }) => {
    const response = await request.get("api/search");
    expect(response.ok()).toBe(true);
    const index = await response.text();
    for (const term of ["maximizeToggle", "popoutURL", "data-selected"]) {
        expect(index).toContain(term);
    }
});

test("an Example card links the example under the base path", async ({
    page,
}) => {
    await page.goto("docs/getting-started/first-layout/");
    const card = page.locator('a[data-example-link="hello-layout"]').first();
    await expect(card).toContainText("Open the live example");
    await expect(card).toHaveAttribute(
        "href",
        "/dockable/examples/hello-layout/",
    );
    await card.click();
    await expect(page).toHaveURL(/\/dockable\/examples\/hello-layout\//);
    await expect(
        page
            .getByTestId("stage")
            .locator('[data-layout-path="/layout"]')
            .first(),
    ).toBeVisible();
});

test("the reference pages render", async ({ page }) => {
    const errors = collectErrors(page);
    for (const slug of ["root", "tab", "actions", "json-model", "labels"]) {
        await page.goto(`docs/api/${slug}/`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("table").first()).toBeVisible();
    }
    await page.goto("docs/limitations/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Known limitations",
    );
    expect(errors).toEqual([]);
});

test("the exported docs have no broken internal links", () => {
    const out = join(import.meta.dirname, "../out");
    const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
            const path = join(dir, name);
            return statSync(path).isDirectory() ? walk(path) : [path];
        });
    const pages = walk(join(out, "docs")).filter((file) =>
        file.endsWith(".html"),
    );
    expect(pages.length).toBeGreaterThan(40);
    const built = new Set(EXAMPLES.map((example) => example.slug));
    const broken: string[] = [];
    for (const file of pages) {
        const html = readFileSync(file, "utf-8");
        for (const match of html.matchAll(/href="\/dockable(\/[^"]*)"/g)) {
            const [path = "", hash] = (match[1] ?? "").split("#");
            if (!/^\/(docs|examples)\//.test(path)) continue;
            // an example written in parallel with the docs is checked once it is in the
            // manifest; tests/docs-links.test.ts checks its slug against the planned list
            const example = /^\/examples\/([^/]+)\/$/.exec(path);
            if (example && !built.has(example[1] ?? "")) continue;
            const target = join(out, path, "index.html");
            if (!existsSync(target)) {
                broken.push(`${relative(out, file)} → ${path}`);
            } else if (
                hash &&
                !readFileSync(target, "utf-8").includes(`id="${hash}"`)
            ) {
                broken.push(`${relative(out, file)} → ${path}#${hash}`);
            }
        }
    }
    expect(broken).toEqual([]);
});
