import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";

// With the kit off, the package paints nothing: its elements carry no class, only structural
// inline styles, and no stylesheet rule targets them.

/** The inline style properties the primitive contract allows (AGENTS.md), as longhands. */
const STRUCTURAL = new Set([
    "position",
    "inset",
    "left",
    "top",
    "right",
    "bottom",
    "width",
    "height",
    "display",
    "flex",
    "flex-direction",
    "flex-basis",
    "flex-grow",
    "flex-shrink",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "overflow",
    "overflow-x",
    "overflow-y",
    "transform",
]);

for (const theme of ["light", "dark"] as const) {
    test(`the layout is unstyled with the kit off (${theme})`, async ({
        page,
    }) => {
        const stage = await openExample(page, "unstyled", { theme });
        const report = await stage
            .locator('[data-layout-path="/layout"]')
            .evaluate((root) => {
                const elements = [
                    root,
                    ...root.querySelectorAll<HTMLElement>("[data-layout-path]"),
                ] as HTMLElement[];

                // Every style rule on the page, including those nested in @media/@layer/@supports.
                const rules: CSSStyleRule[] = [];
                const collect = (list: CSSRuleList) => {
                    for (const rule of Array.from(list)) {
                        if (rule instanceof CSSStyleRule) rules.push(rule);
                        if ("cssRules" in rule && rule.cssRules) {
                            collect(rule.cssRules as CSSRuleList);
                        }
                    }
                };
                for (const sheet of Array.from(document.styleSheets)) {
                    try {
                        collect(sheet.cssRules);
                    } catch {
                        // a cross-origin sheet cannot be read; the site has none
                    }
                }

                /** Top-level selectors of a list, split on commas outside parentheses. */
                const split = (text: string) => {
                    const parts: string[] = [];
                    let depth = 0;
                    let start = 0;
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        if (char === "(" || char === "[") depth++;
                        else if (char === ")" || char === "]") depth--;
                        else if (char === "," && depth === 0) {
                            parts.push(text.slice(start, i).trim());
                            start = i + 1;
                        }
                    }
                    parts.push(text.slice(start).trim());
                    return parts;
                };
                const matches = (element: Element, selector: string) => {
                    try {
                        return element.matches(selector);
                    } catch {
                        return false; // pseudo-elements and unsupported syntax
                    }
                };

                const classes: string[] = [];
                const styles: string[] = [];
                const matched: string[] = [];
                for (const element of elements) {
                    const path = element.dataset.layoutPath;
                    if (element.getAttribute("class")) {
                        classes.push(
                            `${path}: ${element.getAttribute("class")}`,
                        );
                    }
                    for (let i = 0; i < element.style.length; i++) {
                        const property = element.style.item(i);
                        styles.push(property);
                    }
                    for (const rule of rules) {
                        for (const selector of split(rule.selectorText)) {
                            // The page's reset (Tailwind preflight: `*`, `div`, …) styles every
                            // element on the page by type; only a selector naming a class, an
                            // attribute or an id could target the layout.
                            if (!/[.#[]/.test(selector)) continue;
                            if (matches(element, selector)) {
                                matched.push(`${path}: ${selector}`);
                            }
                        }
                    }
                }
                return {
                    count: elements.length,
                    classes,
                    styles: [...new Set(styles)],
                    matched,
                };
            });

        expect(report.count).toBeGreaterThan(8);
        expect(report.classes).toEqual([]);
        expect(report.matched).toEqual([]);
        for (const property of report.styles) {
            expect(STRUCTURAL, property).toContain(property);
        }

        // the kit's class names are one toggle away
        await page.getByTestId("kit-toggle").click();
        await expect(
            stage.locator('[data-layout-path="/layout"]'),
        ).toHaveAttribute("class", /palette-surface/);
    });
}
