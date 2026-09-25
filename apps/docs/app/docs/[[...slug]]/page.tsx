import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

/** Where /docs sends the reader: the tree has no root page. */
const FIRST_PAGE = "/docs/getting-started/introduction";

export default async function Page(props: {
    params: Promise<{ slug?: string[] }>;
}) {
    const params = await props.params;
    // A static export cannot honour next.config redirects(): this renders a
    // redirect page at out/docs/index.html. redirect() adds basePath itself.
    if (!params.slug?.length) {
        redirect(FIRST_PAGE);
    }
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full}>
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
            <DocsBody>
                <MDX
                    components={getMDXComponents({
                        a: createRelativeLink(source, page),
                    })}
                />
            </DocsBody>
        </DocsPage>
    );
}

export async function generateStaticParams() {
    return [{ slug: [] }, ...source.generateParams()];
}

export async function generateMetadata(props: {
    params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
    const params = await props.params;
    if (!params.slug?.length) return {};
    const page = source.getPage(params.slug);
    if (!page) notFound();
    return { title: page.data.title, description: page.data.description };
}
