import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import { baseOptions } from "@/lib/layout.shared";

// The landing page: what the package is, and the two ways in.
export default function HomePage() {
    return (
        <HomeLayout {...baseOptions()}>
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-16">
                <h1 className="text-4xl font-semibold tracking-tight">
                    Dockable panels, without a single line of CSS from us.
                </h1>
                <p className="max-w-2xl text-lg text-palette-accent/85">
                    A headless layout manager for React: tabs, tabsets,
                    splitters, drag and drop and popout windows. It ships
                    behaviour and accessibility. Every pixel is yours.
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
                        Browse the examples
                    </Link>
                </div>
            </div>
        </HomeLayout>
    );
}
