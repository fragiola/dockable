import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** The repository. Declared once; the footer and the docs link to it. */
export const GITHUB_URL = "https://github.com/fragiola/dockable";

// Shared options for the docs and home layouts: nav title, header links and
// the GitHub link.
export function baseOptions(): Pick<
    BaseLayoutProps,
    "nav" | "githubUrl" | "links"
> {
    return {
        nav: {
            title: "Dockable",
            url: "/",
        },
        links: [
            { text: "Docs", url: "/docs", active: "nested-url" },
            { text: "Examples", url: "/examples", active: "nested-url" },
        ],
        githubUrl: GITHUB_URL,
    };
}
