import { typedDockable } from "@fragiola/dockable-vue";

// A writing app's panes: the library's word count, the draft, its outline and the comments.
export type Types = {
    tabs: {
        stats: { caption: string; seed: number };
        draft: { paragraphs: string[] };
        outline: { headings: string[] };
        comments: { comments: { author: string; text: string }[] };
    };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();
