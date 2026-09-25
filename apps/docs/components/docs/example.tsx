import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EXAMPLES } from "@/examples/manifest.generated";
import { LEVEL_TITLES } from "@/examples/meta-types";

export interface ExampleProps {
    /** the example's folder name under `examples/`, e.g. `"hello-layout"` */
    slug: string;
}

/**
 * A link card to a live example, for MDX pages (`<Example slug="hello-layout" />`). It renders on
 * the server and never imports example code: the docs pages stay static, and the example runs
 * on its own page in the examples browser (with themes and the code panel). The title and
 * description come from the generated manifest; an example missing from it still gets a link.
 */
export function Example({ slug }: ExampleProps) {
    const entry = EXAMPLES.find((example) => example.slug === slug);
    const title = entry?.meta.title ?? slug;
    return (
        <Link
            href={`/examples/${slug}/`}
            prefetch={false}
            data-example-link={slug}
            className="not-prose group my-6 flex items-center gap-4 rounded-xl border border-fd-border bg-fd-card p-4 text-fd-card-foreground no-underline transition-colors hover:bg-fd-accent/60"
        >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-fd-muted-foreground text-xs uppercase tracking-wide">
                    {entry
                        ? `${LEVEL_TITLES[entry.meta.level]} example`
                        : "Example"}
                </span>
                <span className="font-medium">{title}</span>
                {entry ? (
                    <span className="text-fd-muted-foreground text-sm">
                        {entry.meta.description}
                    </span>
                ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1 font-medium text-fd-primary text-sm">
                Open the live example
                <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                />
            </span>
        </Link>
    );
}
