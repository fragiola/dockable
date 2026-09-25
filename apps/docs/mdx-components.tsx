import { getMDXComponents } from "@/components/mdx";

// Next.js convention: the MDX runtime resolves components through this.
export function useMDXComponents() {
    return getMDXComponents();
}
