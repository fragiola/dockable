import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

// The MDX component registry: pages use these without importing them.
export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        ...components,
    } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
