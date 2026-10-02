// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// and src/view/layout/LayoutInternal.tsx (moveable element handling), with React, JSX and CSS
// class names removed. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { Model } from "../state/model";
import type { DockableTypes } from "../state/types";
import type { SharedView } from "./LayoutEngine";
import { type Measure, tabContainerOf } from "./measure";

/** How a panel hosts its content (a view option, not layout state). */
export interface MoveableOptions {
    /** the content scrolls inside its panel (default true); false clips it */
    scrollable?: boolean | undefined;
    /** the content is remounted when it moves to another window, so it is not parked (default false) */
    remountInWindow?: boolean | undefined;
}

/** Attribute that marks the element hosting a tab's content. */
export const MOVEABLE_ATTRIBUTE = "data-dockable-moveable";
/** Attribute that marks the hidden element parking moveables whose panel is gone. */
export const MOVEABLES_HOME_ATTRIBUTE = "data-dockable-moveables-home";

/** the element that hosts each moveable's scroll tracking, and the tab it currently hosts */
const scrollTracking = new WeakMap<
    HTMLElement,
    { tab: string; view: SharedView }
>();

/** What the moveable elements read from their engine. */
export interface MoveablesHost<T extends DockableTypes> {
    ownerDocument(): Document | undefined;
    measureOf(id: string): Measure<T>;
}

/**
 * The moveable elements that host tab content, shared by every layout of a model: created on
 * first use, re-parented between panels and documents, parked in the moveables home when their
 * panel goes away, and their scroll position kept across moves.
 */
export class Moveables<T extends DockableTypes> {
    private readonly model: Model<T>;
    private readonly shared: SharedView;
    private readonly host: MoveablesHost<T>;

    constructor(model: Model<T>, shared: SharedView, host: MoveablesHost<T>) {
        this.model = model;
        this.shared = shared;
        this.host = host;
    }

    /** Parks moveables in the root's moveables home; returns the function that lets it go. */
    attachHome(element: HTMLElement): () => void {
        const doc = element.ownerDocument;
        // reuse a home left behind by a previous engine of the same root
        let home = Array.from(element.children).find((child) =>
            child.hasAttribute(MOVEABLES_HOME_ATTRIBUTE),
        ) as HTMLElement | undefined;
        if (!home) {
            home = doc.createElement("div");
            home.setAttribute(MOVEABLES_HOME_ATTRIBUTE, "");
            home.setAttribute("aria-hidden", "true");
            home.style.display = "none";
            element.appendChild(home);
        }
        const parked = home;
        this.shared.moveablesHome = parked;
        return () => {
            // keep parked content alive: its portal still points at the moveable
            if (parked.childNodes.length === 0) {
                parked.remove();
            }
            if (this.shared.moveablesHome === parked) {
                this.shared.moveablesHome = null;
            }
        };
    }

    getMoveableElement(tabId: string): HTMLElement {
        const shared = this.shared;
        let element = shared.moveables.get(tabId);
        if (!element) {
            const doc = this.host.ownerDocument();
            if (!doc) {
                throw new Error(
                    "LayoutEngine.getMoveableElement: attach a root element first",
                );
            }
            element = doc.createElement("div");
            element.setAttribute(MOVEABLE_ATTRIBUTE, "");
            element.style.width = "100%";
            element.style.height = "100%";
            shared.moveables.set(tabId, element);
        }
        return element;
    }

    takeMoveable(tabId: string): HTMLElement | undefined {
        const element = this.shared.moveables.get(tabId);
        this.shared.moveables.delete(tabId);
        this.shared.rendered.delete(tabId);
        return element;
    }

    adoptMoveable(tabId: string, element: HTMLElement | undefined) {
        if (element) {
            this.shared.moveables.set(tabId, element);
            this.shared.rendered.add(tabId);
        }
    }

    attachMoveable(
        tabId: string,
        panel: HTMLElement,
        options: MoveableOptions = {},
    ) {
        const element = this.getMoveableElement(tabId);
        element.style.overflow =
            options.scrollable === false ? "hidden" : "auto";
        if (element.parentElement !== panel) {
            // appendChild adopts the node into the panel's document; identity is what preserves
            // the content's state, so the element is never imported or cloned
            panel.appendChild(element);
            this.restoreScroll(tabId, element);
        }
        // keep the scroll position, so it can be restored after a move. One listener per element
        // for its whole life: the element outlives engines, so the listener reads its current tab
        const tracking = scrollTracking.get(element);
        if (tracking) {
            tracking.tab = tabId;
            tracking.view = this.shared;
        } else {
            const state = { tab: tabId, view: this.shared };
            element.addEventListener("scroll", () => {
                state.view.scroll.set(state.tab, {
                    top: element.scrollTop,
                    left: element.scrollLeft,
                });
            });
            scrollTracking.set(element, state);
        }
    }

    private restoreScroll(tabId: string, element: HTMLElement) {
        const scroll = this.shared.scroll.get(tabId);
        // the frame callback comes from the element's own window, so a tab restored inside a
        // popout schedules on the popout's frame loop
        const view = element.ownerDocument.defaultView;
        if (view && scroll && (scroll.top || scroll.left)) {
            view.requestAnimationFrame(() => {
                element.scrollTop = scroll.top;
                element.scrollLeft = scroll.left;
            });
        }
    }

    releaseMoveable(
        tabId: string,
        panel?: HTMLElement,
        options: MoveableOptions = {},
    ) {
        const element = this.shared.moveables.get(tabId);
        if (!element) {
            return; // the tab is gone: nothing to park
        }
        if (panel !== undefined && element.parentElement !== panel) {
            return; // already attached elsewhere
        }
        const home = this.shared.moveablesHome;
        if (
            home &&
            this.model.get("node-by", { id: tabId }) &&
            options.remountInWindow !== true
        ) {
            home.appendChild(element); // keep it parented, so it stays in the document
        }
    }

    shouldRender(tabId: string, renderOnDemand = true): boolean {
        const shared = this.shared;
        if (shared.rendered.has(tabId)) {
            return true;
        }
        const container = tabContainerOf(this.model, tabId);
        if (!container) {
            return false;
        }
        const selected = container.children[container.selected]?.id === tabId;
        if (!selected && renderOnDemand) {
            return false;
        }
        const rect = this.host.measureOf(tabId).contentRect(container);
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        shared.rendered.add(tabId);
        return true;
    }
}
