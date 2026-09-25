import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import { LiveDemo } from "@/components/landing/live-demo";
import { EXAMPLES } from "@/examples/manifest.generated";
import { baseOptions, GITHUB_URL } from "@/lib/layout.shared";

// The landing page: what the package is, a live Advanced example in five
// themes, what it ships and what it never ships, and the two ways in.

/** The demo on the first screen: the IDE workbench when it exists. */
const DEMO =
    EXAMPLES.find((example) => example.slug === "ide-workbench") ??
    EXAMPLES.find((example) => example.meta.level === "advanced") ??
    EXAMPLES[0];

const SHIPS = [
    [
        "Behaviour",
        "Resize, drag and drop between tabsets and to the edges, popout windows, maximize, undo/redo.",
    ],
    [
        "Accessibility",
        "The APG tabs pattern, keyboard splitters with ARIA values, focus management, layout paths for tests.",
    ],
    [
        "A JSON model",
        "The layout is data: load it, save it, intercept every change with onAction.",
    ],
    [
        "Primitives",
        "Root, Row, TabSet, Tab, Panel, Splitter… each renders only what you give it, with render instead of asChild.",
    ],
];

const NEVER = ["CSS", "Icons", "Text", "Rendered menus", "A design system"];

export default function HomePage() {
    return (
        <HomeLayout {...baseOptions()}>
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-14">
                <section className="flex flex-col gap-5">
                    <p className="text-sm font-medium text-palette-accent/85">
                        @fragiola/dockable · React
                    </p>
                    <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                        Dockable panels, without a single line of CSS from us.
                    </h1>
                    <p className="max-w-2xl text-lg text-palette-accent/85">
                        A headless layout manager: tabs, tabsets, splitters,
                        drag and drop and popout windows. It ships the behaviour
                        and the accessibility. Every pixel is yours.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/docs"
                            className="palette-blue rounded-md bg-palette-base px-4 py-2 font-medium text-palette-contrast hover:bg-palette-base-hover"
                        >
                            Read the docs
                        </Link>
                        <Link
                            href="/examples"
                            className="rounded-md border border-palette-line px-4 py-2 font-medium hover:bg-palette-soft"
                        >
                            Browse {EXAMPLES.length} examples
                        </Link>
                        <a
                            href={GITHUB_URL}
                            className="rounded-md px-4 py-2 font-medium hover:bg-palette-soft"
                        >
                            GitHub
                        </a>
                    </div>
                </section>

                {DEMO ? (
                    <section aria-label="Live example">
                        <LiveDemo slug={DEMO.slug} initialTheme="ide" />
                    </section>
                ) : null}

                <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {SHIPS.map(([title, text]) => (
                        <div
                            key={title}
                            className="rounded-lg border border-palette-line p-4"
                        >
                            <h2 className="text-base">{title}</h2>
                            <p className="mt-1 text-sm text-palette-accent/85">
                                {text}
                            </p>
                        </div>
                    ))}
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-xl">What it never ships</h2>
                    <ul className="flex flex-wrap gap-2">
                        {NEVER.map((item) => (
                            <li
                                key={item}
                                className="rounded-full border border-palette-line px-3 py-1 text-sm text-palette-accent/85 line-through decoration-palette-line"
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                    <p className="max-w-2xl text-sm text-palette-accent/85">
                        The state is exposed as data-* attributes and ARIA, so
                        any styling solution works: Tailwind, plain CSS, CSS
                        modules, CSS-in-JS. The examples use Fragiola UI and its
                        palettes.
                    </p>
                </section>
            </div>
        </HomeLayout>
    );
}
