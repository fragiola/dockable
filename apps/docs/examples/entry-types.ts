import type { ExampleMeta } from "./meta-types";

/** One example in the generated manifest. */
export interface ExampleEntry {
    slug: string;
    meta: ExampleMeta;
    /** its source files, relative to examples/, entry first */
    files: string[];
    /** the Fragiola UI registry items it imports */
    registry: string[];
    /** other npm packages it imports directly (e.g. lucide-react) */
    packages: string[];
}
