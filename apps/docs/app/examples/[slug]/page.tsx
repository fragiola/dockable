import { readFile } from "node:fs/promises";
import path from "node:path";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SourceFile } from "@/components/site/code-panel";
import { ExamplesShell } from "@/components/site/examples-shell";
import { THEMES } from "@/examples/_themes/themes";
import { EXAMPLES } from "@/examples/manifest.generated";

// One page per example, generated at build time. The page reads the example's
// files from disk (the list comes from the manifest, which follows the
// example's imports) and highlights them on the server, so the code panel
// shows exactly the files that were compiled.

const EXAMPLES_DIR = path.join(process.cwd(), "examples");

/** The Fragiola UI registry (the items the examples import come from it). */
const REGISTRY = "https://ui.fragiola.com/r";

function lang(file: string): string {
    return path.extname(file).slice(1) || "tsx";
}

async function sourceFile(file: string): Promise<SourceFile> {
    const code = await readFile(path.join(EXAMPLES_DIR, file), "utf-8");
    return {
        path: file,
        code,
        highlighted: (
            <ServerCodeBlock
                code={code}
                lang={lang(file)}
                codeblock={{ allowCopy: false }}
            />
        ),
    };
}

function setupCommand(registry: string[], packages: string[]): string {
    const lines = [
        [
            "pnpm add @fragiola/dockable @fragiola/dockable-react",
            ...packages,
        ].join(" "),
    ];
    if (registry.length > 0) {
        lines.push(
            `pnpm dlx shadcn@latest add ${registry
                .map((item) => `${REGISTRY}/${item}.json`)
                .join(" ")}`,
        );
    }
    return lines.join("\n");
}

export default async function ExamplePage(props: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await props.params;
    const example = EXAMPLES.find((entry) => entry.slug === slug);
    if (!example) notFound();

    const files = await Promise.all(example.files.map(sourceFile));
    const themeFiles = Object.fromEntries(
        await Promise.all(
            THEMES.map(
                async (theme) =>
                    [
                        theme.name,
                        await sourceFile(`_themes/${theme.name}.css`),
                    ] as const,
            ),
        ),
    );

    return (
        <ExamplesShell
            examples={EXAMPLES}
            example={example}
            files={files}
            themeFiles={themeFiles}
            setup={setupCommand(example.registry, example.packages)}
        />
    );
}

export function generateStaticParams() {
    return EXAMPLES.map((example) => ({ slug: example.slug }));
}

export async function generateMetadata(props: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await props.params;
    const example = EXAMPLES.find((entry) => entry.slug === slug);
    if (!example) notFound();
    return {
        title: `${example.meta.title} · Examples`,
        description: example.meta.description,
    };
}
