import type { ParentNode } from "@fragiola/dockable-angular";
import type { Types } from "./index";

// The palettes a tabset can take, and how a node's palette is read.

export const PALETTES = [
    { value: "palette-blue", title: "Blue" },
    { value: "palette-orange", title: "Orange" },
    { value: "palette-green", title: "Green" },
    { value: "palette-purple", title: "Purple" },
    { value: "palette-surface", title: "Surface" },
    { value: "palette-raised", title: "Raised" },
] as const;

const DEFAULT_PALETTE = "palette-raised";

/** A tabset's palette (a tab's parent may also be a border, which has none). */
export function paletteOf(node: ParentNode<Types> | undefined): string {
    return (node?.type === "tabset" && node.data?.palette) || DEFAULT_PALETTE;
}
