// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// and src/view/layout/LayoutInternal.tsx (the measure-and-position cycle and the observers that
// drive it), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    EMPTY_RECT,
    equalsWhenRounded,
    positionElement,
    type Rect,
    relativeTo,
    toRect,
} from "../geometry/rect";
import { resolveBorder } from "../state/defaults";
import type { Model } from "../state/model";
import type { AnyBorder } from "../state/tree";
import type { DockableTypes, TabContainer } from "../state/types";
import type { SharedView } from "./LayoutEngine";

/** The kinds of element whose geometry the engine measures. */
export type MeasurableKind =
    | "row"
    | "tabset"
    | "tabstrip"
    | "tabsetcontent"
    | "tabbutton"
    | "borderheader"
    | "bordercontent";

/** Measures an element in viewport coordinates. Defaults to `getBoundingClientRect`. */
export type MeasureFunction = (element: HTMLElement) => Rect;

export const defaultMeasure: MeasureFunction = (element) =>
    element.getBoundingClientRect();

/** What the measure-and-position cycle calls back on its engine. */
export interface MeasureHost {
    redraw(): void;
    updateTabOverflow(): void;
    observeOverflow(observer: ResizeObserver): void;
}

function hasSize(rect: Rect | undefined): boolean {
    return !!rect && rect.width > 0 && rect.height > 0;
}

export function tabContainerOf<T extends DockableTypes>(
    model: Model<T>,
    tabId: string,
): TabContainer<T> | undefined {
    const container = model.get("node-parent-by", { nodeId: tabId });
    return container?.type === "tabset" || container?.type === "border"
        ? container
        : undefined;
}

export function panelShown<T extends DockableTypes>(
    model: Model<T>,
    tabId: string,
    container: TabContainer<T>,
): boolean {
    if (container.children[container.selected]?.id !== tabId) {
        return false;
    }
    if (container.type === "border") {
        return container.show !== false;
    }
    const layout = model.get("layout-id-by", {
        nodeId: container.id,
    });
    const maximized =
        layout === undefined
            ? undefined
            : model.get("maximized-tabset", { layoutId: layout });
    return maximized === undefined || maximized.id === container.id;
}

/**
 * The geometry of one layout: the elements an adapter registers, their measured rects, the tab
 * panels positioned over their content area, the splitter size and the layout root's rect.
 */
export class Measure<T extends DockableTypes> {
    readonly measureElement: MeasureFunction;
    private readonly model: Model<T>;
    private readonly shared: SharedView;
    private readonly host: MeasureHost;

    layoutRef: HTMLElement | null = null;
    cachedLayoutDomRect: Rect | undefined;
    private reLayout = false;
    rangesDirty = true;
    private lastRect: Rect = EMPTY_RECT;
    /** measured elements and their last rects, by `kind:id` */
    readonly measurables = new Map<
        string,
        { kind: MeasurableKind; id: string; element: HTMLElement }
    >();
    readonly rects = new Map<string, Rect>();
    readonly tabPanels = new Map<string, HTMLElement>();
    private readonly splitters = new Map<HTMLElement, () => boolean>();
    private readonly geometryListeners = new Set<() => void>();
    private geometryResizeObserver: ResizeObserver | undefined;
    private healFrame: number | undefined;

    constructor(
        model: Model<T>,
        shared: SharedView,
        measureElement: MeasureFunction,
        host: MeasureHost,
    ) {
        this.model = model;
        this.shared = shared;
        this.measureElement = measureElement;
        this.host = host;
    }

    dispose() {
        this.measurables.clear();
        this.rects.clear();
        this.tabPanels.clear();
        for (const element of this.splitters.keys()) {
            this.shared.splitters.delete(element);
        }
        this.splitters.clear();
    }

    /**
     * Runs the measure-and-position cycle: measures every registered element, positions the tab
     * panels and discovers the splitter size. Call after every commit.
     */
    sync() {
        const changed = this.applyMeasuredGeometry();
        if (changed) {
            // post-paint heal: re-measure after css settles (fonts, transitions)
            this.scheduleHeal();
        }
    }

    // *********************************************************************************
    // Registration
    // *********************************************************************************

    watch(prev: HTMLElement | undefined, next: HTMLElement | null | undefined) {
        if (prev === next) {
            return;
        }
        if (prev) {
            this.geometryResizeObserver?.unobserve(prev);
        }
        if (next) {
            this.geometryResizeObserver?.observe(next);
        }
    }

    registerMeasurable(
        id: string,
        kind: MeasurableKind,
        element: HTMLElement | null,
    ) {
        const key = `${kind}:${id}`;
        this.watch(this.measurables.get(key)?.element, element);
        if (element) {
            this.measurables.set(key, { kind, id, element });
        } else {
            this.measurables.delete(key);
            // an unmounted border strip or panel area must not leave a ghost that takes drops
            if (kind === "borderheader" || kind === "bordercontent") {
                this.rects.delete(key);
            }
        }
    }

    registerTabPanel(tabId: string, element: HTMLElement | null) {
        if (element) {
            this.tabPanels.set(tabId, element);
        } else {
            this.tabPanels.delete(tabId);
        }
    }

    registerSplitter(
        element: HTMLElement,
        isHorizontal: () => boolean,
    ): () => void {
        if (!this.splitters.has(element)) {
            this.watch(undefined, element);
        }
        this.splitters.set(element, isHorizontal);
        this.shared.splitters.set(element, isHorizontal);
        return () => {
            if (this.splitters.delete(element)) {
                this.shared.splitters.delete(element);
                this.watch(element, undefined);
            }
        };
    }

    subscribeGeometry(listener: () => void): () => void {
        this.geometryListeners.add(listener);
        return () => {
            this.geometryListeners.delete(listener);
        };
    }

    getRegistrations() {
        return {
            measurables: this.measurables,
            tabPanels: this.tabPanels,
            splitters: this.splitters,
        };
    }

    // *********************************************************************************
    // Measure and position
    // *********************************************************************************

    rect(kind: MeasurableKind, id: string): Rect | undefined {
        return this.rects.get(`${kind}:${id}`);
    }

    contentRect(container: TabContainer<T>): Rect | undefined {
        return this.rect(
            container.type === "border" ? "bordercontent" : "tabsetcontent",
            container.id,
        );
    }

    private syncLayoutMetrics(): boolean {
        this.cachedLayoutDomRect = undefined;
        let changed = false;
        for (const [key, { kind, element }] of this.measurables) {
            if (!element.isConnected) {
                continue;
            }
            const rect = this.rectInLayout(element);
            const content =
                kind === "tabsetcontent" || kind === "bordercontent";
            if (
                content &&
                (Number.isNaN(rect.x) ||
                    (kind === "bordercontent" && rect.width <= 0))
            ) {
                continue;
            }
            const previous = this.rects.get(key);
            if (equalsWhenRounded(previous, rect)) {
                continue;
            }
            this.rects.set(key, rect);
            changed = true;
            // the content render waits for a sized content area: re-render when one first gets a size
            if (content && !hasSize(previous) && hasSize(rect)) {
                this.reLayout = true;
            }
            if (
                kind === "tabstrip" &&
                (!previous ||
                    Math.round(previous.height) !== Math.round(rect.height))
            ) {
                this.rangesDirty = true;
            }
        }
        return changed;
    }

    isPanelVisible(tabId: string): boolean {
        const container = tabContainerOf(this.model, tabId);
        return (
            container !== undefined && panelShown(this.model, tabId, container)
        );
    }

    private positionTabPanels() {
        for (const [tabId, element] of this.tabPanels) {
            const container = tabContainerOf(this.model, tabId);
            if (!container) {
                continue; // the tab left the tree (it is being closed)
            }
            positionElement(element, this.contentRect(container) ?? EMPTY_RECT);
            element.style.display = panelShown(this.model, tabId, container)
                ? ""
                : "none";
        }
    }

    /** measures the splitter thickness; returns true on change */
    private syncSplitterSize(): boolean {
        for (const [element, isHorizontal] of this.shared.splitters) {
            if (!element.isConnected) {
                continue;
            }
            const r = this.measureElement(element);
            const size = isHorizontal() ? r.width : r.height;
            if (size <= 0) {
                continue; // hidden (e.g. while a tabset is maximized)
            }
            if (Math.abs(size - this.shared.splitterSize) > 0.5) {
                this.shared.splitterSize = size;
                return true;
            }
            return false;
        }
        return false;
    }

    applyMeasuredGeometry(): boolean {
        const changed = this.syncLayoutMetrics();
        this.positionTabPanels();
        this.host.updateTabOverflow();
        const splitterSizeChanged = this.syncSplitterSize();
        if (splitterSizeChanged || this.reLayout) {
            this.reLayout = false;
            this.host.redraw();
        }
        if (changed) {
            for (const listener of [...this.geometryListeners]) {
                listener();
            }
        }
        return changed;
    }

    applyTransientBorderSize(payload: { borderId: string }): boolean {
        const border = this.model.get("node-by", {
            id: payload.borderId,
        });
        if (border?.type !== "border") {
            return false;
        }
        const resolved = resolveBorder(
            this.model.state.defaults,
            border as unknown as AnyBorder,
        );
        if (resolved.mode === "overlay") {
            return false; // an overlay's placement depends on the other open overlays
        }
        const element = this.measurables.get(
            `bordercontent:${border.id}`,
        )?.element;
        if (!element) {
            return false;
        }
        if (border.location === "start" || border.location === "end") {
            element.style.width = `${resolved.size}px`;
            element.style.minWidth = `${resolved.minSize}px`;
            element.style.maxWidth = `${resolved.maxSize}px`;
        } else {
            element.style.height = `${resolved.size}px`;
            element.style.minHeight = `${resolved.minSize}px`;
            element.style.maxHeight = `${resolved.maxSize}px`;
        }
        this.applyMeasuredGeometry();
        return true;
    }

    private scheduleHeal() {
        const win = this.layoutRef?.ownerDocument.defaultView;
        if (!win) {
            return;
        }
        this.cancelHeal();
        this.healFrame = win.requestAnimationFrame(() => {
            this.healFrame = undefined;
            this.applyMeasuredGeometry();
        });
    }

    cancelHeal() {
        if (this.healFrame !== undefined) {
            this.layoutRef?.ownerDocument.defaultView?.cancelAnimationFrame(
                this.healFrame,
            );
            this.healFrame = undefined;
        }
    }

    setGeometryResizeObserver(observer: ResizeObserver | undefined) {
        this.geometryResizeObserver = observer;
        if (observer) {
            for (const { element } of this.measurables.values()) {
                observer.observe(element);
            }
            for (const element of this.splitters.keys()) {
                observer.observe(element);
            }
            this.host.observeOverflow(observer);
        }
    }

    /** re-measures the layout root; a changed size relayouts */
    readonly updateRect = () => {
        const element = this.layoutRef;
        if (!element) {
            return;
        }
        const rect = toRect(this.measureElement(element));
        if (
            !equalsWhenRounded(rect, this.lastRect) &&
            rect.width !== 0 &&
            rect.height !== 0
        ) {
            this.lastRect = rect;
            this.host.redraw();
        }
    };

    // *********************************************************************************
    // Geometry
    // *********************************************************************************

    rectInLayout(element: HTMLElement): Rect {
        return relativeTo(this.measureElement(element), this.getDomRect());
    }

    getFreshDomRect(): Rect {
        this.cachedLayoutDomRect = undefined;
        return this.getDomRect();
    }

    getDomRect(): Rect {
        if (this.cachedLayoutDomRect !== undefined) {
            return this.cachedLayoutDomRect;
        }
        if (this.layoutRef) {
            this.cachedLayoutDomRect = toRect(
                this.measureElement(this.layoutRef),
            );
            return this.cachedLayoutDomRect;
        }
        return EMPTY_RECT;
    }
}
