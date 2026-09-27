import { beforeAll, describe, expect, it } from "vitest";
import { anchorsOf, type Site, validateSite } from "../contract.ts";
import { readSite } from "../sources.ts";

// The export's sources meet the site export contract (v1), and the checks that guarantee it
// catch what `www` would reject: each case below breaks one rule on a copy of the real site.

let site: Site;

beforeAll(async () => {
    site = await readSite();
});

/** A copy of the site with one page replaced (or added). */
function withPage(path: string, source: string): Site {
    return { ...site, pages: new Map([...site.pages, [path, source]]) };
}

const page = (body: string) =>
    `---\ntitle: T\ndescription: D\n---\n\n## A heading\n\n${body}\n`;

/** The problems of a copy where `limitations` (a listed page) has `body`. */
const problemsOf = (body: string) =>
    validateSite(withPage("limitations", page(body)));

describe("the site export", () => {
    it("has the landing, every page in the sidebar and all 37 examples", () => {
        expect(site.pages.has("index")).toBe(true);
        expect(site.pages.size).toBe(59);
        expect(site.manifests.get("react")?.examples).toHaveLength(37);
    });

    it("passes the contract checks", () => {
        expect(validateSite(site)).toEqual([]);
    });
});

describe("the contract checks", () => {
    it("accept the vocabulary and base-free links", () => {
        expect(
            problemsOf(
                [
                    '<Example id="hello-layout" theme="ide" variant="card" height={400} />',
                    '<Callout type="info" title="x">y</Callout>',
                    "[a](/docs/guides/tabs) [b](/examples/add-tabs) [c](/) [d](#a-heading) [e](https://x.dev)",
                    '```tsx title="a.tsx"\nconst a = <Foo />;\n```',
                    "`<Inline />` is code",
                ].join("\n\n"),
            ),
        ).toEqual([]);
    });

    it("reject a component outside the vocabulary, and raw HTML", () => {
        expect(problemsOf("<Foo />")).toEqual([
            expect.stringContaining("<Foo> is not in the v1 vocabulary"),
        ]);
        expect(problemsOf("<div>x</div>").join()).toContain("<div>");
    });

    it("reject unknown props and bad values", () => {
        expect(problemsOf('<Example slug="hello-layout" />').join()).toMatch(
            /takes no "slug".*needs "id"/,
        );
        expect(problemsOf('<Example id="nope" />').join()).toContain(
            "is not an example",
        );
        expect(
            problemsOf('<Example id="add-tabs" theme="neon" />').join(),
        ).toContain("not in examples.json");
        expect(
            problemsOf('<Callout type="warning">x</Callout>').join(),
        ).toContain('<Callout type="warning">');
        expect(problemsOf('<Hero title="x" />').join()).toContain(
            "landing only",
        );
    });

    it("reject broken, relative and anchorless links", () => {
        expect(problemsOf("[x](/docs/nope)").join()).toContain(
            "no page /docs/nope",
        );
        expect(problemsOf("[x](/docs/guides/tabs#nope)").join()).toContain(
            "no heading #nope",
        );
        expect(problemsOf("[x](../guides/tabs.mdx)").join()).toContain(
            "relative link",
        );
        expect(problemsOf("[x](/examples/nope)").join()).toContain(
            'no example "nope"',
        );
        expect(problemsOf("[x](#nope)").join()).toContain("no heading #nope");
    });

    it("reject a code block without a language, and ESM", () => {
        expect(problemsOf("```\nx\n```").join()).toContain("takes a language");
        expect(problemsOf('import x from "y";').join()).toContain(
            "import/export",
        );
    });

    it("reject missing frontmatter, and a page missing from the sidebar", () => {
        expect(
            validateSite(withPage("limitations", "# no frontmatter\n")).join(),
        ).toMatch(/title is required.*description is required/);
        expect(validateSite(withPage("extra", page(""))).join()).toContain(
            "extra.mdx is not listed",
        );
    });

    it("slug headings like Fumadocs", () => {
        expect([
            ...anchorsOf(
                "## The `onAction` hook\n\n## Tabs & tabsets\n\n## Tabs & tabsets\n",
            ),
        ]).toEqual(["the-onaction-hook", "tabs--tabsets", "tabs--tabsets-1"]);
    });
});
