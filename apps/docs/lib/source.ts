import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

// The content source: defineDocs + loader, baseUrl /docs. `docs` is generated
// by fumadocs-mdx from source.config.ts.
export const source = loader({
    source: docs.toFumadocsSource(),
    baseUrl: "/docs",
});
