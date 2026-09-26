import type { ReactNode } from "react";
import { ExamplesChrome } from "@/components/site/examples-chrome";
import { EXAMPLES } from "@/examples/manifest.generated";

// The examples browser's chrome (header, list, shell state) is a layout: on navigation between
// examples it stays mounted, so the list keeps its scroll and its filter.
export default function ExamplesLayout({ children }: { children: ReactNode }) {
    return <ExamplesChrome examples={EXAMPLES}>{children}</ExamplesChrome>;
}
