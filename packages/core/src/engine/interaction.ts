// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx,
// src/view/TabSet.tsx and src/view/layout/LayoutInternal.tsx (APG keyboard handling of the tab
// strip, roving focus, tabset activation, document key handling), with React, JSX and CSS class
// names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { DragDropManager, DropLocation } from "../dnd/DragDropManager";
import {
    hasModifier,
    type KeyEventLike,
    type KeyMap,
    matchesKey,
    resolveKeyMap,
    toAriaKeyShortcuts,
} from "../keyboard/keymap";
import type { Model } from "../state/model";
import type { DockableTypes } from "../state/types";
import type { Derived } from "./derived";

/** What the current drag means for one tab container (a tabset or a border). */
export interface ContainerDropState {
    /** the current drag would drop into or beside this container */
    readonly target: boolean;
    /** while it is the target: where the drag would dock */
    readonly location: DropLocation | undefined;
    /** while the drop goes into its tab strip: the insertion index among its tabs */
    readonly index: number | undefined;
    /** the current drag is over this container, but a drop rule refuses it */
    readonly refused: boolean;
}

/** A keyboard event as a key handler of the adapter reads it (native or a framework's). */
export interface KeyEventInput extends KeyEventLike {
    readonly defaultPrevented: boolean;
    preventDefault(): void;
}

/** A pointer press as a press handler of the adapter reads it. */
export interface PressInput {
    readonly button: number;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
}

/** The element a part's `aria-keyshortcuts` is for. */
export type KeyShortcutsPart = "tab" | "tablist" | "panel";

const NO_DROP: ContainerDropState = Object.freeze({
    target: false,
    location: undefined,
    index: undefined,
    refused: false,
});

const REFUSED: ContainerDropState = Object.freeze({
    ...NO_DROP,
    refused: true,
});

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** focus the first focusable element in `container`, or the container itself */
function focusFirstIn(container: HTMLElement | null) {
    if (container) {
        const focusable = container.querySelector<HTMLElement>(FOCUSABLE);
        (focusable ?? container).focus();
    }
}

/** the keys to the previous and the next tab: a horizontal strip runs from the right in RTL */
function arrowKeys(
    orientation: "horizontal" | "vertical",
    direction: "ltr" | "rtl",
): [string, string] {
    if (orientation === "vertical") {
        return ["ArrowUp", "ArrowDown"];
    }
    return direction === "rtl"
        ? ["ArrowRight", "ArrowLeft"]
        : ["ArrowLeft", "ArrowRight"];
}

/** What the interaction rules read from their engine. */
export interface InteractionHost {
    /** the main engine's interaction (it holds the key map) */
    main(): Interaction<DockableTypes>;
    direction(): "ltr" | "rtl";
    /** focus the next or previous tabset (`engine.run("focus-tabset")`); true when it moved */
    focusTabset(direction: "next" | "previous"): boolean;
    handleOverlayKeyDown(
        event: KeyEventInput,
        key: string | undefined,
    ): boolean;
}

/**
 * The rules every adapter applies to the parts' events, so no adapter re-implements them: the tab
 * strip's keyboard (APG tabs, manual activation), a tab press, a tabset press, a panel's focus
 * key, the document's keys, the `aria-keyshortcuts` of each part, and what the drag means for a
 * tab container.
 */
export class Interaction<T extends DockableTypes> {
    private readonly model: Model<T>;
    private readonly derived: Derived<T>;
    private readonly dragDropManager: DragDropManager;
    private readonly host: InteractionHost;
    private keyMap: KeyMap = resolveKeyMap(undefined);
    private readonly dropStates = new Map<string, ContainerDropState>();

    constructor(
        model: Model<T>,
        derived: Derived<T>,
        dragDropManager: DragDropManager,
        host: InteractionHost,
    ) {
        this.model = model;
        this.derived = derived;
        this.dragDropManager = dragDropManager;
        this.host = host;
    }

    setKeyMap(keyMap: KeyMap | undefined) {
        this.keyMap = resolveKeyMap(keyMap);
    }

    /** the resolved key map: the main engine's, for every engine of the model */
    getKeyMap(): KeyMap {
        return this.host.main().keyMap;
    }

    /** what the current drag means for `containerId`: the same object until it changes */
    getDropState(containerId: string): ContainerDropState {
        const indicator = this.dragDropManager.getIndicatorState();
        let next = NO_DROP;
        if (indicator.refused && indicator.refusedTabsetId === containerId) {
            next = REFUSED;
        } else if (
            indicator.visible &&
            indicator.targetTabsetId === containerId
        ) {
            const strip =
                indicator.location === "center" &&
                indicator.index >= 0 &&
                indicator.targetNodeId === containerId;
            next = {
                target: true,
                location: indicator.location,
                index: strip ? indicator.index : undefined,
                refused: false,
            };
        }
        const previous = this.dropStates.get(containerId);
        if (
            previous !== undefined &&
            previous.target === next.target &&
            previous.location === next.location &&
            previous.index === next.index &&
            previous.refused === next.refused
        ) {
            return previous;
        }
        if (next === NO_DROP) {
            this.dropStates.delete(containerId);
        } else {
            this.dropStates.set(containerId, next);
        }
        return next;
    }

    /** a primary press in a tabset (its strip, its content) makes it the active tabset */
    handleTabSetPointerDown(tabsetId: string, event: PressInput) {
        if (
            event.button === 0 &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.shiftKey
        ) {
            this.activateTabset(tabsetId);
        }
    }

    /** a press in a tab's panel makes its tabset the active one */
    handlePanelPointerDown(tabId: string) {
        const tabset = this.model.get("node-parent-by", { nodeId: tabId });
        if (tabset?.type === "tabset") {
            this.activateTabset(tabset.id);
        }
    }

    private activateTabset(tabsetId: string) {
        if (!this.model.is("tabset-active", { tabsetId })) {
            this.model.run("tabset.activate", { tabsetId });
        }
    }

    /** a click on a tab button: selects it; on a border's selected tab, closes the border's panel */
    handleTabClick(tabId: string) {
        const container = this.model.get("node-parent-by", { nodeId: tabId });
        const selected = this.model.is("tab-selected", { tabId });
        if (container?.type === "border" && selected) {
            this.model.run("border.configure", {
                borderId: container.id,
                open: false,
            });
        } else if (!selected) {
            this.model.run("tab.select", { tabId });
        }
    }

    /**
     * A key pressed on a tab button (`element`): arrow keys along `orientation` (mirrored in RTL),
     * Home and End move focus between tabs; Enter or Space selects, or, on the selected tab, moves
     * focus into its panel; the `focusTabToggle` key moves focus into the panel; the `closeTab`
     * key closes the tab when the model allows it. Returns true when the key was handled (its
     * default is prevented).
     */
    handleTabKeyDown(
        tabId: string,
        event: KeyEventInput,
        options: {
            element: HTMLElement;
            orientation: "horizontal" | "vertical";
        },
    ): boolean {
        if (event.defaultPrevented) {
            return false;
        }
        const { element, orientation } = options;
        const keyMap = this.getKeyMap();
        const [previousKey, nextKey] = arrowKeys(
            orientation,
            this.host.direction(),
        );
        const handled = (): boolean => {
            event.preventDefault();
            return true;
        };
        if (matchesKey(event, keyMap.focusTabToggle)) {
            this.focusTabContent(tabId, element);
            return handled();
        }
        if (event.key === "Enter" || event.key === " ") {
            if (this.model.is("tab-selected", { tabId })) {
                this.focusTabContent(tabId, element);
            } else {
                this.select(tabId);
            }
            return handled();
        }
        if (
            matchesKey(event, keyMap.closeTab) &&
            this.model.can("tab.close", { tabId })
        ) {
            // move focus to a neighbour before this tab is removed (the previous one for the last)
            if (!this.focusAdjacentTab(tabId, element, 1)) {
                this.focusAdjacentTab(tabId, element, -1);
            }
            this.model.run("tab.close", { tabId });
            return handled();
        }
        if (hasModifier(event)) {
            return false; // modified arrows are left for keymap bindings (e.g. tabset cycling)
        }
        const to =
            event.key === previousKey
                ? -1
                : event.key === nextKey
                  ? 1
                  : event.key === "Home"
                    ? "first"
                    : event.key === "End"
                      ? "last"
                      : undefined;
        if (to === undefined) {
            return false;
        }
        this.focusAdjacentTab(tabId, element, to);
        return handled();
    }

    /**
     * A key pressed within a tab's panel: the `focusTabToggle` key returns focus to the tab button.
     * Returns true when it did (its default is prevented; stop its propagation).
     */
    handlePanelKeyDown(
        tabId: string,
        event: KeyEventInput,
        panel: HTMLElement,
    ) {
        const key = this.getKeyMap().focusTabToggle;
        if (event.defaultPrevented || !matchesKey(event, key)) {
            return false;
        }
        const button = panel.ownerDocument.getElementById(
            this.derived.tabButtonId(tabId),
        );
        if (!button) {
            return false;
        }
        button.focus();
        event.preventDefault();
        return true;
    }

    /**
     * A key pressed anywhere in the root's document: the `focusNextTabset`/`focusPreviousTabset`
     * keys move focus between tabsets, else the `closeOverlayBorder` key closes an open overlay
     * border. Content that handled the key keeps it. Returns true when the key was handled.
     */
    handleDocumentKeyDown(event: KeyEventInput): boolean {
        if (event.defaultPrevented) {
            return false;
        }
        const keyMap = this.getKeyMap();
        const direction = matchesKey(event, keyMap.focusNextTabset)
            ? "next"
            : matchesKey(event, keyMap.focusPreviousTabset)
              ? "previous"
              : undefined;
        if (direction && this.host.focusTabset(direction)) {
            event.preventDefault();
            return true;
        }
        return this.host.handleOverlayKeyDown(event, keyMap.closeOverlayBorder);
    }

    /** the `aria-keyshortcuts` of a part (a tab's names its own close key) */
    getKeyShortcuts(
        part: KeyShortcutsPart,
        tabId?: string,
    ): string | undefined {
        const keyMap = this.getKeyMap();
        if (part === "tablist") {
            return toAriaKeyShortcuts(
                keyMap.focusNextTabset,
                keyMap.focusPreviousTabset,
            );
        }
        if (part === "panel") {
            return toAriaKeyShortcuts(keyMap.focusTabToggle);
        }
        const tab =
            tabId === undefined
                ? undefined
                : this.model.get("node-by", { id: tabId });
        // the hint follows the tab's own rule; the key itself asks the model
        const closable =
            tab?.type === "tab" &&
            tab.pinned !== true &&
            this.model.get("tab-settings-by", { tabId: tab.id })?.closable ===
                true;
        return toAriaKeyShortcuts(
            keyMap.focusTabToggle,
            closable ? keyMap.closeTab : undefined,
        );
    }

    /** whether a tab or a tabset can be dragged now (its `draggable` setting) */
    isDraggable(nodeId: string): boolean {
        const node = this.model.get("node-by", { id: nodeId });
        if (node?.type === "tab") {
            return (
                this.model.get("tab-settings-by", { tabId: nodeId })
                    ?.draggable ?? false
            );
        }
        if (node?.type === "tabset") {
            return (
                this.model.get("tabset-settings-by", { tabsetId: nodeId })
                    ?.draggable ?? false
            );
        }
        return false;
    }

    private select(tabId: string) {
        if (!this.model.is("tab-selected", { tabId })) {
            this.model.run("tab.select", { tabId });
        }
    }

    private focusAdjacentTab(
        tabId: string,
        self: HTMLElement,
        to: number | "first" | "last",
    ): boolean {
        const tablist = self.closest('[role="tablist"]');
        if (!tablist) {
            return false;
        }
        const tabs = Array.from(
            tablist.querySelectorAll<HTMLElement>('[role="tab"]'),
        );
        const next =
            to === "first"
                ? tabs[0]
                : to === "last"
                  ? tabs[tabs.length - 1]
                  : tabs[tabs.indexOf(self) + to];
        if (next?.hasAttribute("data-overflow-hidden")) {
            // a tab hidden by tab overflow: select it, which brings it into the strip, then focus it
            const container = this.model.get("node-parent-by", {
                nodeId: tabId,
            });
            const target = container?.children.find(
                (tab) =>
                    tab.type === "tab" &&
                    this.derived.tabButtonId(tab.id) === next.id,
            );
            if (target) {
                this.model.run("tab.select", { tabId: target.id });
                self.ownerDocument.defaultView?.requestAnimationFrame(() =>
                    self.ownerDocument.getElementById(next.id)?.focus(),
                );
            }
            return true;
        }
        next?.focus();
        return next !== undefined;
    }

    // move focus into the tab content: the first focusable element, or the panel itself
    private focusTabContent(tabId: string, self: HTMLElement) {
        const doc = self.ownerDocument;
        const focusPanel = () =>
            focusFirstIn(doc.getElementById(this.derived.tabPanelId(tabId)));
        if (this.model.is("tab-selected", { tabId })) {
            focusPanel();
        } else {
            this.select(tabId); // select first, focus once the panel is shown
            doc.defaultView?.requestAnimationFrame(focusPanel);
        }
    }
}
