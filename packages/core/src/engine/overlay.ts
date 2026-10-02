// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// (overlay borders and keyboard focus), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { CommandResult } from "../commands/types";
import type { DragDropManager } from "../dnd/DragDropManager";
import { contains } from "../geometry/rect";
import { type KeyEventLike, matchesKey } from "../keyboard/keymap";
import { borderShown, resolveBorder } from "../state/defaults";
import type { Model } from "../state/model";
import type { AnyBorder } from "../state/tree";
import type { DockableTypes } from "../state/types";
import type { Derived } from "./derived";
import type { SharedView } from "./LayoutEngine";
import { type Measure, tabContainerOf } from "./measure";
import { notFound, refused } from "./results";
import type { OverlayPlacement } from "./verbs";

/**
 * Marks an element that belongs to an open overlay border (its wrapper, splitter, toolbar): a
 * press on it does not close the overlay.
 */
export const OVERLAY_ATTRIBUTE = "data-dockable-overlay";

/** What the overlay borders and keyboard focus read from their engine. */
export interface OverlayHost {
    ownerDocument(): Document | undefined;
    isMainLayout(): boolean;
}

/** The overlay borders of a layout, and keyboard focus between its tabsets. */
export class Overlay<T extends DockableTypes> {
    private readonly model: Model<T>;
    private readonly layoutId: string;
    private readonly shared: SharedView;
    private readonly measure: Measure<T>;
    private readonly derived: Derived<T>;
    private readonly dragDropManager: DragDropManager;
    private readonly host: OverlayHost;

    constructor(
        model: Model<T>,
        layoutId: string,
        shared: SharedView,
        measure: Measure<T>,
        derived: Derived<T>,
        dragDropManager: DragDropManager,
        host: OverlayHost,
    ) {
        this.model = model;
        this.layoutId = layoutId;
        this.shared = shared;
        this.measure = measure;
        this.derived = derived;
        this.dragDropManager = dragDropManager;
        this.host = host;
    }

    private openOverlayBorders(): AnyBorder[] {
        const state = this.derived.state();
        return state.borders.filter((border) => {
            const resolved = resolveBorder(state.defaults, border);
            return (
                resolved.show &&
                resolved.mode === "overlay" &&
                border.selected !== -1
            );
        });
    }

    overlayPlacement(borderId: string): OverlayPlacement | undefined {
        const border = this.model.get("node-by", { id: borderId });
        if (
            border?.type !== "border" ||
            !this.model.is("border-overlay", { borderId })
        ) {
            return undefined;
        }
        if (border.location === "top") {
            return { top: 0, left: 0, right: 0 };
        }
        if (border.location === "bottom") {
            return { bottom: 0, left: 0, right: 0 };
        }
        let top = 0;
        let bottom = 0;
        for (const other of this.openOverlayBorders()) {
            const inset =
                resolveBorder(this.derived.state().defaults, other).size +
                this.shared.splitterSize;
            if (other.location === "top") {
                top = inset;
            } else if (other.location === "bottom") {
                bottom = inset;
            }
        }
        return border.location === "left"
            ? { left: 0, top, bottom }
            : { right: 0, top, bottom };
    }

    isBorderShown(borderId: string): boolean {
        const border = this.model.get("node-by", { id: borderId });
        return (
            this.host.isMainLayout() &&
            border?.type === "border" &&
            borderShown(
                this.derived.state().defaults,
                border,
                this.dragDropManager.getIndicatorState().revealedBorder ===
                    border.location,
            )
        );
    }

    isTabbable(tabId: string): boolean {
        if (this.model.is("tab-selected", { tabId })) {
            return true;
        }
        const container = tabContainerOf(this.model, tabId);
        return (
            container?.selected === -1 && container.children[0]?.id === tabId
        );
    }

    /**
     * Closes an overlay border's panel (`border.configure` with `open: false`). When focus was in
     * the panel, it goes back to the tab button.
     */
    closeOverlayBorder(
        borderId: string,
        dryRun = false,
    ): CommandResult<{ borderId: string }> {
        const border = this.model.get("node-by", { id: borderId });
        if (border?.type !== "border") {
            return notFound(`"${borderId}" is not a border`);
        }
        const tab = border.children[border.selected];
        if (!tab) {
            return refused(`"${borderId}" is not open`);
        }
        if (dryRun) {
            return this.model.check("border.configure", {
                borderId,
                open: false,
            });
        }
        const doc = this.host.ownerDocument();
        const panel = doc?.getElementById(this.derived.tabPanelId(tab.id));
        const refocus =
            doc?.activeElement != null && panel?.contains(doc.activeElement);
        const result = this.model.run("border.configure", {
            borderId,
            open: false,
        });
        if (result.ok && refocus) {
            doc?.getElementById(this.derived.tabButtonId(tab.id))?.focus();
        }
        return result;
    }

    handleOverlayPointerDown(event: {
        target: EventTarget | null;
        clientX: number;
        clientY: number;
    }): boolean {
        const open = this.openOverlayBorders();
        if (open.length === 0 || !this.measure.layoutRef) {
            return false;
        }
        const target = event.target as Element | null;
        if (target?.closest?.(`[${OVERLAY_ATTRIBUTE}]`)) {
            return false;
        }
        const root = this.measure.getFreshDomRect();
        const x = event.clientX - root.x;
        const y = event.clientY - root.y;
        const main = this.measure.rect("row", this.derived.state().root.id);
        if (!main || !contains(main, x, y)) {
            return false; // a border strip, or outside the layout
        }
        let closed = false;
        for (const border of open) {
            const content = this.measure.rect("bordercontent", border.id);
            if (!content || !contains(content, x, y)) {
                closed = this.closeOverlayBorder(border.id).ok || closed;
            }
        }
        return closed;
    }

    handleOverlayKeyDown(
        event: KeyEventLike & { preventDefault(): void },
        key: string | undefined,
    ): boolean {
        const doc = this.host.ownerDocument();
        const active = doc?.activeElement;
        if (!key || !doc || !active || !matchesKey(event, key)) {
            return false;
        }
        for (const border of this.openOverlayBorders()) {
            const tab = border.children[border.selected];
            if (!tab) {
                continue;
            }
            const button = doc.getElementById(this.derived.tabButtonId(tab.id));
            const panel = doc.getElementById(this.derived.tabPanelId(tab.id));
            if (active === button || panel?.contains(active)) {
                if (!this.closeOverlayBorder(border.id).ok) {
                    return false; // a middleware keeps it open: the key is not ours
                }
                event.preventDefault();
                return true;
            }
        }
        return false;
    }

    /**
     * Moves focus to the selected tab button of the next/previous tabset in this layout
     * (wrapping), starting from the tabset containing focus and falling back to the active one;
     * the target becomes the active tabset. Refused when focus is not in this layout.
     */
    focusAdjacentTabset(
        delta: number,
        dryRun: boolean,
    ): CommandResult<{ tabsetId: string }> {
        const doc = this.host.ownerDocument();
        const active = doc?.activeElement;
        if (!doc || !active || !this.measure.layoutRef?.contains(active)) {
            return refused("focus is not in this layout");
        }
        // leave text editing contexts alone
        const tag = active.tagName;
        if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable ||
            active.closest('[role="menu"]')
        ) {
            return refused("focus is in a text field or a menu");
        }
        if (
            this.model.get("maximized-tabset", {
                layoutId: this.layoutId,
            }) !== undefined
        ) {
            return refused("a tabset is maximized: it is the only one shown");
        }
        const tabsets = this.model
            .get("tabsets", { layoutId: this.layoutId })
            .filter((tabset) => tabset.children[tabset.selected] !== undefined);
        if (tabsets.length < 2) {
            return refused("no other tabset to move focus to");
        }
        const containsFocus = (tabset: (typeof tabsets)[number]) => {
            if (
                this.measure.measurables
                    .get(`tabset:${tabset.id}`)
                    ?.element.contains(active)
            ) {
                return true; // focus in the tab strip
            }
            const selected = tabset.children[tabset.selected];
            return (
                !!selected &&
                !!this.measure.tabPanels.get(selected.id)?.contains(active)
            );
        };
        let index = tabsets.findIndex(containsFocus);
        if (index === -1) {
            const activeTabset = this.model.get("active-tabset", {
                layoutId: this.layoutId,
            });
            index = activeTabset
                ? tabsets.findIndex((t) => t.id === activeTabset.id)
                : 0;
            if (index === -1) {
                index = 0;
            }
        }
        const target =
            tabsets[(index + delta + tabsets.length) % tabsets.length];
        const selected = target?.children[target.selected];
        if (!target || !selected) {
            return refused("no other tabset to move focus to");
        }
        if (!dryRun) {
            this.measure.measurables
                .get(`tabbutton:${selected.id}`)
                ?.element.focus();
            // focus moved whether or not a middleware lets the tabset become active
            this.model.run("tabset.activate", { tabsetId: target.id });
        }
        return { ok: true, value: { tabsetId: target.id } };
    }
}
