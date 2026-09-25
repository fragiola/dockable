import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// Content source: the docs tree under content/docs.
export const docs = defineDocs({
    dir: "content/docs",
});

export default defineConfig({
    mdxOptions: {
        providerImportSource: "@/components/mdx",
    },
});
