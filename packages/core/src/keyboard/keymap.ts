// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutTypes.ts
// (IKeyMap, defaultKeyMap) and src/view/Utils.tsx (matchesKey, hasModifier, resolveKeyMap,
// toAriaKeyShortcuts). Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

/**
 * Keyboard bindings for the command shortcuts, as `"Ctrl+Shift+Key"` strings (modifiers in any
 * order, key compared case-insensitively against `KeyboardEvent.key`).
 *
 * Bindings given to the adapter are merged over {@link defaultKeyMap}; passing an explicit
 * undefined for a binding disables that shortcut. The bindings are advertised to assistive
 * technology via aria-keyshortcuts on the affected elements, so the advertised shortcuts always
 * match the configured ones.
 *
 * Only command shortcuts are configurable; the structural keys defined by the WAI-ARIA widget
 * patterns (arrow keys within a tablist, Enter/Space activation) are fixed, since assistive
 * technology announces those from the widget roles themselves.
 *
 * Note: WCAG 2.1.4 requires single printable character shortcuts to be remappable or off by
 * default, so prefer function keys or modifier combinations.
 */
export interface IKeyMap {
    /** closes the focused tab button's tab (when the tab is closeable) */
    closeTab?: string;
    /** starts renaming the focused tab button's tab (when the tab is renameable, tabset tabs only) */
    renameTab?: string;
    /** toggles focus between the selected tab button and its content; off by default */
    focusTabToggle?: string;
    /** moves focus to the selected tab button of the next tabset in the layout (wrapping),
     * from anywhere within the layout including inside tab content; off by default */
    focusNextTabset?: string;
    /** moves focus to the selected tab button of the previous tabset in the layout (wrapping),
     * from anywhere within the layout including inside tab content; off by default */
    focusPreviousTabset?: string;
    /** closes an open overlay border panel when focus is inside it (or on its tab button) and
     * returns focus to the tab button */
    closeOverlayBorder?: string;
}

/** the default keyboard bindings, exported so applications can display or re-register them */
export const defaultKeyMap: Readonly<IKeyMap> = {
    closeTab: "Ctrl+Delete",
    renameTab: "F2",
    focusTabToggle: undefined,
    focusNextTabset: undefined,
    focusPreviousTabset: undefined,
    closeOverlayBorder: "Escape",
};

/** the modifier/key fields shared by native and framework keyboard events */
export interface IKeyEventLike {
    key: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

/** true when `event` is exactly the key combination `spec` (a disabled binding never matches) */
export function matchesKey(
    event: IKeyEventLike,
    spec: string | undefined,
): boolean {
    if (!spec) {
        return false;
    }
    const parts = spec.split("+");
    const key = parts.pop() ?? "";
    const has = (mod: string) => parts.some((p) => p.toLowerCase() === mod);
    return (
        event.key.toLowerCase() === key.toLowerCase() &&
        event.ctrlKey === has("ctrl") &&
        event.shiftKey === has("shift") &&
        event.altKey === has("alt") &&
        event.metaKey === has("meta")
    );
}

/** true when any modifier key is held; the fixed ARIA pattern keys (arrows on tabs and
 * splitters) only apply unmodified, so modified presses stay available for keymap bindings */
export function hasModifier(event: IKeyEventLike): boolean {
    return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
}

/** merge the configured bindings over the defaults; a binding passed as an explicit
 * undefined disables that shortcut */
export function resolveKeyMap(keyMap: IKeyMap | undefined): IKeyMap {
    return { ...defaultKeyMap, ...keyMap };
}

/** the `aria-keyshortcuts` spelling of a binding */
export function toAriaKeyShortcuts(spec: string | undefined) {
    return spec?.replace(/\bctrl\b/i, "Control"); // the aria-keyshortcuts attribute spells it "Control"
}
