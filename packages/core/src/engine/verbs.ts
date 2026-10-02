import type { FlexSizing } from "../split/split";
import type { NoPayload } from "../state/queries";

/**
 * Where an overlay border's panel sits over the layout: its insets from the layout's edges, in
 * pixels. An edge it leaves free is absent.
 */
export interface OverlayPlacement {
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly left?: number;
}

/**
 * What `engine.run(action, payload)` does: each screen action's payload and result. An action's
 * key has no dot, so it never reads as a command (`tab.close`): commands change the layout through
 * `model.run`; actions are what only the screen can do (windows, focus, measuring). The ones that
 * change the layout do it by running commands, so middleware sees them.
 */
export interface EngineActionMap {
    /**
     * pops a tab, or a whole tabset, out into a window at its place on screen (`tab.popout` /
     * `tabset.popout`); refused where popouts are not supported
     */
    popout: { payload: { nodeId: string }; result: { windowId: string } };
    /**
     * docks a tab, or a tabset, of a window back into the main layout's default tabset (its active
     * one, else its first): `window.close` when it is all its window holds, else `tab.move`s
     */
    "dock-back": { payload: { nodeId: string }; result: { tabIds: string[] } };
    /**
     * moves focus to the selected tab of the next or previous tabset of this layout (wrapping) and
     * activates that tabset (`tabset.activate`); refused when focus is not in the layout, or is in
     * a text field or a menu
     */
    "focus-tabset": {
        payload: { direction: "next" | "previous" };
        result: { tabsetId: string };
    };
    /** closes an open border's panel (`border.configure`); focus in it goes back to its tab */
    "close-overlay-border": {
        payload: { borderId: string };
        result: { borderId: string };
    };
    /**
     * measures the layout again and repositions the panels; call it after a change the engine
     * cannot observe (flipping `dir` at runtime)
     */
    "measure-and-position": { payload: NoPayload; result: NoPayload };
}

/** A key of `engine.run`. */
export type EngineActionKey = keyof EngineActionMap;

/** The payload of `engine.run(K)`. */
export type EngineActionPayload<K extends EngineActionKey> =
    EngineActionMap[K]["payload"];

/** The result of `engine.run(K)`. */
export type EngineActionResult<K extends EngineActionKey> =
    EngineActionMap[K]["result"];

/**
 * What `engine.get(key, payload)` reads: facts of this layout on screen. A key names what it returns
 * and whose id it takes, as on the model.
 */
export interface EngineGetMap {
    /** a node's `data-layout-path` in this layout (`/ts0/t1`) */
    "layout-path-by": { payload: { nodeId: string }; result: string };
    /** the DOM id of a tab's button (unique on the page): its panel's `aria-labelledby` */
    "tab-button-dom-id-by": {
        payload: { tabId: string };
        result: string;
    };
    /** the DOM id of a tab's panel (unique on the page): its button's `aria-controls` */
    "tab-panel-dom-id-by": {
        payload: { tabId: string };
        result: string;
    };
    /**
     * how a row or a tabset sizes in its row: its flex grow (from its weight, at least 1) and its
     * min/max, in pixels
     */
    "flex-by": {
        payload: { nodeId: string };
        result: FlexSizing;
    };
    /**
     * where an overlay border's panel sits over the layout: a left or right one stops at the open
     * top and bottom overlays; undefined for a border that is not an overlay
     */
    "overlay-placement-by": {
        payload: { borderId: string };
        result: OverlayPlacement | undefined;
    };
    /** the measured splitter thickness, in pixels */
    "splitter-size": { payload: NoPayload; result: number };
    /** the document this layout renders in (a popout's own, for a window's layout) */
    "owner-document": { payload: NoPayload; result: Document | undefined };
    /** the window this layout renders in (a popout's own, for a window's layout) */
    "owner-window": { payload: NoPayload; result: Window | undefined };
}

/** A key of `engine.get`. */
export type EngineGetKey = keyof EngineGetMap;

/** The payload of `engine.get(K)`. */
export type EngineGetPayload<K extends EngineGetKey> =
    EngineGetMap[K]["payload"];

/** The result of `engine.get(K)`. */
export type EngineGetResult<K extends EngineGetKey> = EngineGetMap[K]["result"];

/** What `engine.is(key, payload)` asks: each question's payload. */
export interface EngineIsMap {
    /** popout windows open on this page (a desktop browser, or `popout.supportsPopout`) */
    "popout-supported": NoPayload;
    /** a tab's panel is shown: selected, and not hidden by a maximize or a hidden border */
    "tab-panel-visible": { tabId: string };
    /** this engine draws the main layout (not a popout window's) */
    "main-layout": NoPayload;
    /** a splitter of the model is being dragged */
    "splitter-dragging": NoPayload;
    /**
     * a border shows in this layout (the main one): its `show` is on and, when it `autoHide`s, it
     * has tabs or the drag reveals it
     */
    "border-shown": { borderId: string };
    /**
     * a tab is its tab list's tab stop (`tabIndex` 0): the selected tab, or the first one when
     * none is selected
     */
    "tab-tabbable": { tabId: string };
}

/** A key of `engine.is`. */
export type EngineIsKey = keyof EngineIsMap;

/** The payload of `engine.is(K)`. */
export type EngineIsPayload<K extends EngineIsKey> = EngineIsMap[K];
