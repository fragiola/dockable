import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
    anchorsOf,
    noindexProblem,
    type ProjectInfo,
    type Site,
    validateSite,
} from "../contract.ts";
import { readSite } from "../sources.ts";

// The export's sources meet the site export contract (v1.2), and the checks that guarantee it
// catch what `www` would reject: each case below breaks one rule on a copy of the real site.

let site: Site;

beforeAll(async () => {
    site = await readSite();
});

/** A copy of the site with one page replaced (or added). */
function withPage(path: string, source: string): Site {
    return { ...site, pages: new Map([...site.pages, [path, source]]) };
}

/** A description of 50–160 characters (v1.2). */
const DESCRIPTION =
    "A page of the contract tests, long enough to be a real description.";

const page = (body: string) =>
    `---\ntitle: T\ndescription: ${DESCRIPTION}\n---\n\n## A heading\n\n${body}\n`;

/** The landing's frontmatter: a title that names the project and says what it is. */
const LANDING = `---\ntitle: Dockable — a test landing\ndescription: ${DESCRIPTION}\nlayout: landing\n---`;

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
            expect.stringContaining("<Foo> is not in the v1.1 vocabulary"),
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

    it("accept the v1.1 landing vocabulary on the landing, and only there", () => {
        const landing = [
            LANDING,
            '<Hero eyebrow="e" title="t" background="grid" actions={[',
            '    { label: "Docs", href: "/docs/guides/tabs", variant: "primary", icon: "arrow" },',
            '    { label: "Browse {examples} examples", href: "/examples", variant: "secondary" },',
            '    { label: "GitHub", href: "https://github.com/x", variant: "ghost", icon: "external" },',
            "]} />",
            '<Example id="ide-workbench" variant="showcase" theme="ide" label="Themes:" />',
            '<Features columns={4} numbered>\n<Feature title="a">b</Feature>\n</Features>',
            '<Section title="t" eyebrow="e" description="d">',
            '<Pills strike items={["CSS", "Icons"]} />',
            "</Section>",
        ].join("\n\n");
        expect(validateSite(withPage("index", landing))).toEqual([]);
        expect(problemsOf('<Section title="t">x</Section>').join()).toContain(
            "<Section> belongs on the landing only",
        );
        expect(problemsOf('<Pills items={["a"]} />').join()).toContain(
            "<Pills> belongs on the landing only",
        );
    });

    it("reject bad v1.1 values", () => {
        const onLanding = (body: string) =>
            validateSite(withPage("index", `${LANDING}\n\n${body}\n`)).join();
        expect(
            onLanding(
                '<Hero title="t" actions={[{ label: "x", href: "/", variant: "loud" }]} />',
            ),
        ).toContain("<Hero actions> takes a list");
        expect(
            onLanding('<Hero title="t" actions={[{ label: "x" }]} />'),
        ).toContain("<Hero actions> takes a list");
        expect(onLanding('<Hero title="t" background="dots" />')).toContain(
            '<Hero background="dots">',
        );
        expect(
            onLanding(
                '<Features columns={5}><Feature title="a">b</Feature></Features>',
            ),
        ).toContain("<Features columns> takes 2, 3 or 4");
        expect(onLanding("<Pills items={[]} />")).toContain(
            "<Pills items> takes a list of strings",
        );
        expect(onLanding("<Feature>x</Feature>")).toContain(
            '<Feature> needs "title"',
        );
        expect(onLanding('<Example id="ide-workbench" label="x" />')).toContain(
            '<Example label> goes with variant="showcase"',
        );
        expect(
            validateSite({
                ...site,
                project: { ...site.project, repository: "github.com/x" },
            }).join(),
        ).toContain("repository must be an https:// URL");
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

describe("the v1.2 checks", () => {
    const withProject = (changes: Partial<ProjectInfo>) =>
        validateSite({ ...site, project: { ...site.project, ...changes } });
    /** The problems of a landing with this frontmatter title and body. */
    const landing = (body: string, title = "Dockable — a test landing") =>
        validateSite(
            withPage(
                "index",
                `---\ntitle: ${title}\ndescription: ${DESCRIPTION}\nlayout: landing\n---\n\n${body}\n`,
            ),
        );
    const HERO = '<Hero title="t" />';

    it("measure the project's description in code points (§2)", () => {
        expect(withProject({ description: "Too short." })).toEqual([
            "project.json: description is 10 characters: 50–160 (§2)",
        ]);
        expect(withProject({ description: "x".repeat(161) })).toEqual([
            "project.json: description is 161 characters: 50–160 (§2)",
        ]);
        // 50 code points, 100 UTF-16 units
        expect(withProject({ description: "🧩".repeat(50) })).toEqual([]);
    });

    it("check the keywords: 1–8 unique lowercase topics of at most 40 characters (§2)", () => {
        expect(withProject({ keywords: ["react", "tabs"] })).toEqual([]);
        expect(withProject({ keywords: [] })).toEqual([
            "project.json: keywords must list 1–8 topics (§2)",
        ]);
        expect(
            withProject({
                keywords: Array.from({ length: 9 }, (_, i) => `k${i}`),
            }),
        ).toEqual(["project.json: keywords must list 1–8 topics (§2)"]);
        expect(
            withProject({
                keywords: [
                    " tabs",
                    "",
                    3 as unknown as string,
                    "React",
                    "a".repeat(41),
                    "tabs",
                    "tabs",
                ],
            }),
        ).toEqual([
            'project.json: keywords: " tabs" is not a topic: a non-empty string, no surrounding spaces (§2)',
            'project.json: keywords: "" is not a topic: a non-empty string, no surrounding spaces (§2)',
            "project.json: keywords: 3 is not a topic: a non-empty string, no surrounding spaces (§2)",
            'project.json: keywords: "React" is not lowercase (§2)',
            `project.json: keywords: "${"a".repeat(41)}" is 41 characters: at most 40 (§2)`,
            'project.json: keywords: "tabs" is listed twice (§2)',
        ]);
    });

    it("measure the frontmatter's title and description, at their lines (§3.2)", () => {
        expect(
            validateSite(
                withPage(
                    "limitations",
                    `---\ntitle: ${"t".repeat(61)}\ndescription: Short.\n---\n\n## A heading\n`,
                ),
            ),
        ).toEqual([
            "docs/limitations.mdx:2: frontmatter: title is 61 characters: at most 60 (§3.2)",
            "docs/limitations.mdx:3: frontmatter: description is 6 characters: 50–160 (§3.2)",
        ]);
        expect(
            validateSite(
                withPage(
                    "limitations",
                    `---\ntitle: ${"é".repeat(60)}\ndescription: ${"é".repeat(160)}\n---\n`,
                ),
            ),
        ).toEqual([]);
    });

    it("reject a frontmatter value YAML would not read as text", () => {
        expect(
            validateSite(
                withPage(
                    "limitations",
                    `---\ntitle: Hooks\ndescription: The lower layer: hooks under the primitives, for your own markup.\n---\n`,
                ),
            ),
        ).toEqual([
            `docs/limitations.mdx:3: the frontmatter is not valid YAML: description's value has ": " or " #" in it; quote it`,
        ]);
        expect(
            validateSite(
                withPage(
                    "limitations",
                    `---\ntitle: "Hooks: the lower layer"\ndescription: "The lower layer: hooks under the primitives, for your own markup."\n---\n`,
                ),
            ),
        ).toEqual([]);
    });

    it("want the landing's title to name the project and say what it is (§3.2)", () => {
        expect(landing(HERO)).toEqual([]);
        expect(landing(HERO, "Docking panels")).toEqual([
            'docs/index.mdx:2: frontmatter: the landing\'s title "Docking panels" is its <title>: it contains the project\'s title "Dockable" (§3.2)',
        ]);
        expect(landing(HERO, "Dockable")).toEqual([
            'docs/index.mdx:2: frontmatter: the landing\'s title is its <title>: say what Dockable is, not only its name ("Dockable — …") (§3.2)',
        ]);
    });

    it("want exactly one <Hero> on the landing (§3.4)", () => {
        expect(landing("Prose only.")).toEqual([
            "docs/index.mdx:1: the landing has no <Hero>: its title is the landing's h1 (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n${HERO}`)).toEqual([
            "docs/index.mdx:9: a second <Hero>: the landing has exactly one, its only h1 (§3.4)",
        ]);
    });

    it("reject a Markdown # heading and a skipped level (§3.4)", () => {
        // the body of problemsOf starts on line 8, under "## A heading"
        expect(problemsOf("# Title")).toEqual([
            "docs/limitations.mdx:8: a Markdown # heading: the page's h1 is its frontmatter title (§3.4)",
        ]);
        expect(problemsOf("#### Deep")).toEqual([
            "docs/limitations.mdx:8: a #### heading after an h2: headings do not skip a level (§3.4)",
        ]);
        expect(
            validateSite(
                withPage(
                    "limitations",
                    `---\ntitle: T\ndescription: ${DESCRIPTION}\n---\n\n### Steps first\n`,
                ),
            ),
        ).toEqual([
            "docs/limitations.mdx:6: a ### heading after an h1: headings do not skip a level (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n# Title`)).toEqual([
            "docs/index.mdx:9: a Markdown # heading: the page's h1 is its <Hero>'s title (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n### Skipped`)).toEqual([
            "docs/index.mdx:9: a ### heading after an h1: headings do not skip a level (§3.4)",
        ]);
        expect(
            landing(
                `${HERO}\n\n<Section title="s">\n\n#### Too deep\n\n</Section>`,
            ),
        ).toEqual([
            "docs/index.mdx:11: a #### heading after an h2: headings do not skip a level (§3.4)",
        ]);
    });

    it("accept an outline that only steps down one level, and headings in code (§3.4)", () => {
        expect(
            problemsOf(
                "### Sub\n\n#### Subsub\n\n## Back up\n\n```sh\n# a comment\n#### not a heading\n```",
            ),
        ).toEqual([]);
        expect(
            landing(
                [
                    HERO,
                    "## Top",
                    '<Section title="s">',
                    "### Inside the section",
                    '<Features><Feature title="f">x</Feature></Features>',
                    "#### Under a feature in a section",
                    "</Section>",
                    '<Features columns={2}>\n<Feature title="g">y</Feature>\n</Features>',
                    "### Under a feature outside a section",
                ].join("\n\n"),
            ),
        ).toEqual([]);
    });

    it("want alt text on every image (§3.4)", () => {
        expect(problemsOf("![](https://x.dev/a.png)")).toEqual([
            "docs/limitations.mdx:8: an image needs alt text: ![what it shows](…) (§3.4)",
        ]);
        expect(problemsOf("![ ][shot]\n\n[shot]: https://x.dev/a.png")).toEqual(
            [
                "docs/limitations.mdx:8: an image needs alt text: ![what it shows](…) (§3.4)",
            ],
        );
        expect(
            problemsOf("![Two tabsets side by side](https://x.dev/a.png)"),
        ).toEqual([]);
    });

    it("want noindex in every HTML file of an embed app (§5.1)", () => {
        const html = (meta: string) =>
            `<!doctype html>\n<html>\n    <head>\n        ${meta}\n    </head>\n</html>\n`;
        const message =
            'needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)';
        expect(noindexProblem("embed/react/popout.html", html(""))).toBe(
            `embed/react/popout.html:3: ${message}`,
        );
        expect(
            noindexProblem(
                "embed/react/index.html",
                html('<meta name="robots" content="index" />'),
            ),
        ).toBe(`embed/react/index.html:3: ${message}`);
        expect(noindexProblem("embed/react/a.html", "<p>x</p>")).toBe(
            `embed/react/a.html: ${message}`,
        );
        expect(
            noindexProblem(
                "embed/react/index.html",
                html("<meta content='noindex, nofollow' name=robots>"),
            ),
        ).toBeUndefined();
    });

    it("find noindex in the examples app's HTML: index.html and popout.html (§5.1)", () => {
        const app = join(import.meta.dirname, "../../examples/react");
        for (const file of ["index.html", "public/popout.html"]) {
            expect(
                noindexProblem(file, readFileSync(join(app, file), "utf-8")),
            ).toBeUndefined();
        }
    });
});
