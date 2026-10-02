// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabOverflowHook.tsx (the
// tabs hidden by tab overflow) and src/view/layout/LayoutInternal.tsx (the observers that drive
// it), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { computeTabOverflow } from "../overflow/tabOverflow";
import type { Model } from "../state/model";
import type { DockableTypes } from "../state/types";
import type { Measure } from "./measure";

const NO_TABS: readonly string[] = Object.freeze([]);

interface Axis {
    readonly size: "width" | "height";
    readonly start: "Left" | "Top";
    readonly end: "Right" | "Bottom";
    readonly gap: "columnGap" | "rowGap";
}

const HORIZONTAL: Axis = {
    size: "width",
    start: "Left",
    end: "Right",
    gap: "columnGap",
};
const VERTICAL: Axis = {
    size: "height",
    start: "Top",
    end: "Bottom",
    gap: "rowGap",
};

function px(value: string | undefined): number {
    return Number.parseFloat(value ?? "") || 0;
}

/** a border only counts when drawn (some engines report a width for `none`) */
function borderWidth(
    style: CSSStyleDeclaration | undefined,
    side: Axis["start"] | Axis["end"],
): number {
    const kind = style?.[`border${side}Style`];
    return kind === "none" || kind === "hidden"
        ? 0
        : px(style?.[`border${side}Width`]);
}

/**
 * The tab overflow of one layout: the tab lists and overflow triggers an adapter registers, the
 * natural size of each tab, and the tabs hidden because they do not fit.
 */
export class Overflow<T extends DockableTypes> {
    private readonly model: Model<T>;
    private readonly measure: Measure<T>;
    private readonly tabLists = new Map<
        string,
        { element: HTMLElement; vertical: boolean }
    >();
    private readonly overflowTriggers = new Map<string, HTMLElement>();
    readonly naturalTabSizes = new Map<string, number>();
    readonly reservedSpace = new Map<string, number>();
    private readonly hiddenTabs = new Map<string, readonly string[]>();
    private readonly overflowListeners = new Set<() => void>();

    constructor(model: Model<T>, measure: Measure<T>) {
        this.model = model;
        this.measure = measure;
    }

    dispose() {
        this.tabLists.clear();
        this.overflowTriggers.clear();
        this.overflowListeners.clear();
    }

    observe(observer: ResizeObserver) {
        for (const { element } of this.tabLists.values()) {
            observer.observe(element);
        }
        for (const element of this.overflowTriggers.values()) {
            observer.observe(element);
        }
    }

    registerTabList(
        containerId: string,
        element: HTMLElement | null,
        vertical = false,
    ) {
        this.measure.watch(this.tabLists.get(containerId)?.element, element);
        if (element) {
            this.tabLists.set(containerId, { element, vertical });
        } else {
            this.tabLists.delete(containerId);
            this.setHiddenTabs(containerId, []);
        }
    }

    registerOverflowTrigger(containerId: string, element: HTMLElement | null) {
        this.measure.watch(this.overflowTriggers.get(containerId), element);
        if (element) {
            this.overflowTriggers.set(containerId, element);
        } else {
            this.overflowTriggers.delete(containerId);
        }
    }

    readonly getHiddenTabs = (containerId: string): readonly string[] =>
        this.hiddenTabs.get(containerId) ?? NO_TABS;

    readonly subscribeOverflow = (listener: () => void): (() => void) => {
        this.overflowListeners.add(listener);
        return () => {
            this.overflowListeners.delete(listener);
        };
    };

    private setHiddenTabs(containerId: string, hidden: readonly string[]) {
        const prev = this.getHiddenTabs(containerId);
        if (
            prev.length === hidden.length &&
            prev.every((id, i) => id === hidden[i])
        ) {
            return false;
        }
        if (hidden.length === 0) {
            this.hiddenTabs.delete(containerId);
        } else {
            this.hiddenTabs.set(containerId, hidden);
        }
        return true;
    }

    updateTabOverflow() {
        let changed = false;
        for (const [id, { element, vertical }] of this.tabLists) {
            const container = this.model.get("node-by", { id });
            if (container?.type !== "tabset" && container?.type !== "border") {
                continue; // the container left the model
            }
            const axis = vertical ? VERTICAL : HORIZONTAL;
            const { inner, gap } = this.innerSize(element, axis);
            if (inner <= 0) {
                continue; // not laid out (hidden, or not measured yet)
            }
            const tabs = container.children;
            const hidden = new Set(this.getHiddenTabs(id));
            const sizes = tabs.map((tab) => {
                const button = this.measure.measurables.get(
                    `tabbutton:${tab.id}`,
                )?.element;
                if (button && !hidden.has(tab.id)) {
                    const size = this.measure.measureElement(button)[axis.size];
                    if (size > 0) {
                        this.naturalTabSizes.set(tab.id, size);
                    }
                }
                return this.naturalTabSizes.get(tab.id) ?? 0;
            });
            const trigger = this.overflowTriggers.get(id);
            const taken = trigger ? this.triggerSpace(trigger, axis) : 0;
            if (taken > 0) {
                this.reservedSpace.set(id, taken);
            }
            const result = computeTabOverflow({
                available: inner + taken,
                sizes,
                gap,
                selectedIndex: container.selected,
                reserve: this.reservedSpace.get(id) ?? 0,
            });
            const next = result.hidden.map((index) => tabs[index]?.id ?? "");
            changed = this.setHiddenTabs(id, next) || changed;
        }
        if (changed) {
            for (const listener of [...this.overflowListeners]) {
                listener();
            }
        }
    }

    /** a tab list's size inside its padding and borders, and the gap between its tabs */
    private innerSize(
        list: HTMLElement,
        axis: Axis,
    ): { inner: number; gap: number } {
        const style = list.ownerDocument.defaultView?.getComputedStyle(list);
        const inset =
            px(style?.[`padding${axis.start}`]) +
            px(style?.[`padding${axis.end}`]) +
            borderWidth(style, axis.start) +
            borderWidth(style, axis.end);
        return {
            inner: this.measure.measureElement(list)[axis.size] - inset,
            gap: px(style?.[axis.gap]),
        };
    }

    /** the space the trigger takes while it shows: its size, its margins and the gap before it */
    private triggerSpace(trigger: HTMLElement, axis: Axis): number {
        const view = trigger.ownerDocument.defaultView;
        const style = view?.getComputedStyle(trigger);
        const parent = trigger.parentElement;
        const gap =
            parent && parent.children.length > 1
                ? px(view?.getComputedStyle(parent)[axis.gap])
                : 0;
        return (
            this.measure.measureElement(trigger)[axis.size] +
            px(style?.[`margin${axis.start}`]) +
            px(style?.[`margin${axis.end}`]) +
            gap
        );
    }
}
