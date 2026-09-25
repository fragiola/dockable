import { redirect } from "next/navigation";
import { EXAMPLES } from "@/examples/manifest.generated";

// /examples has no page of its own: it opens the first example. A static
// export renders this as a redirect page; redirect() adds basePath itself.
export default function ExamplesIndex() {
    const first = EXAMPLES[0];
    redirect(first ? `/examples/${first.slug}/` : "/");
}
