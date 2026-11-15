// What the layout holds, and which tabsets are locked: read by index.ts and doc-panel.ts.

export type Types = {
    tabs: {
        doc: { region: string };
        console: undefined;
    };
    tabset: { name: string };
};

export const REFERENCE = "reference";
export const CONSOLE = "console";
export const LOCKED = new Set([REFERENCE, CONSOLE]);
