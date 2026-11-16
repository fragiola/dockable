import {
    type KeyMap,
    resolveKeyMap,
    typedDockable,
} from "@fragiola/dockable-vue";

export type Types = {
    tabs: {
        keys: undefined;
        doc: { text: string };
        table: undefined;
        log: undefined;
    };
    // a tabset's name is its tab list's accessible name (layout-node.vue reads `data.name`)
    tabset: { name: string };
};

// The primitives typed by Types: `tab` in a slot is a tab of this layout.
export const Dockable = typedDockable<Types>();

/**
 * The command shortcuts, merged over `defaultKeyMap` (closeTab: Ctrl+Delete). Tabset cycling
 * and the tab/content toggle are off by default; this example turns them on. Pick modified
 * keys: single printable characters must be remappable (WCAG 2.1.4). The arrows, Home/End,
 * Enter and Space are the ARIA patterns' own keys and are not configurable.
 */
export const keyMap: KeyMap = {
    focusNextTabset: "Ctrl+Alt+ArrowRight",
    focusPreviousTabset: "Ctrl+Alt+ArrowLeft",
    focusTabToggle: "Ctrl+Enter",
};
export const keys = resolveKeyMap(keyMap);
