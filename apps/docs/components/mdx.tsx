import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Example } from "@/components/docs/example";

// The MDX component registry: pages use these without importing them.
// `Example` links a live example by slug (see components/docs/example.tsx).
export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        Example,
        Step,
        Steps,
        Tab,
        Tabs,
        ...components,
    } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
