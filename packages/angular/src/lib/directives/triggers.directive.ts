import {
    computed,
    Directive,
    effect,
    input,
    type Signal,
    untracked,
} from "@angular/core";
import type { AnyTypes, DockableTypes, TabOf } from "@fragiola/dockable";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "../context";
import { bindStructuralStyle, injectHost } from "../utils/helpers";
import { hiddenTabsSignal, registerElement } from "../utils/signals";
import { injectTabContainer } from "./tabset.directive";

/** A button element with no `type` of its own gets `type="button"` (it never submits a form). */
function buttonType(element: HTMLElement): void {
    if (element.tagName === "BUTTON" && !element.hasAttribute("type")) {
        element.setAttribute("type", "button");
    }
}

export interface PopoutTriggerState {
    /** what a press does: open a window (`"popout"`) or dock back into the main layout (`"dock"`) */
    mode: "popout" | "dock";
    /** what it acts on: the selected tab (or `node`), or the whole tabset */
    target: "tab" | "tabset";
}

/**
 * A button, inside `[dockableTabSet]` or `[dockableBorder]`, that pops the selected tab (or the
 * whole tabset) out into a window, and, in a window, docks it back into the main layout:
 * `<button dockablePopoutTrigger aria-label="Pop out">`. It is hidden (`display: none`) when neither is possible (popouts
 * unsupported, the model refuses it, no tab): `tab.popout` / `tabset.popout` decide, through
 * `model.can`. It has no name of its own: give it an `aria-label`, or name it from its `state()`
 * (`#trigger="dockablePopoutTrigger"`) when the two actions need different names.
 */
@Directive({
    selector: "[dockablePopoutTrigger]",
    exportAs: "dockablePopoutTrigger",
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-mode]": "data().mode",
        "[attr.data-target]": "data().target",
        "(click)": "onClick()",
    },
})
export class DockablePopoutTrigger<T extends DockableTypes = AnyTypes> {
    /**
     * `"tab"` (default) pops out one tab; `"tabset"` pops out the whole tabset (not in a border:
     * there the trigger stays hidden)
     */
    readonly target = input<"tab" | "tabset" | undefined>(undefined);
    /** the tab to act on; default: the enclosing tabset's (or border's) selected tab */
    readonly node = input<TabOf<T> | undefined>(undefined);

    private readonly context: DockableContext = injectDockableContext(
        "[dockablePopoutTrigger]",
    );
    private readonly layout = injectLayoutContext("[dockablePopoutTrigger]");
    private readonly container = injectTabContainer("[dockablePopoutTrigger]");
    private readonly subject = computed(() => {
        const { id, type } = this.container();
        if ((this.target() ?? "tab") === "tabset") {
            // a border is not a tabset: it has no window of its own
            return type === "border" ? undefined : id;
        }
        return (
            this.node()?.id ??
            this.context
                .model()
                .get(
                    "selected-tab-by",
                    type === "border" ? { borderId: id } : { tabsetId: id },
                )?.id
        );
    });
    private readonly mode = computed(() => {
        this.context.revision();
        const nodeId = this.subject();
        return nodeId === undefined
            ? undefined
            : this.layout.engine().get("popout-mode-by", { nodeId });
    });

    /** what a press does now; `undefined` while the trigger is hidden */
    readonly state: Signal<PopoutTriggerState | undefined> = computed(() => {
        const mode = this.mode();
        return mode ? { mode, target: this.target() ?? "tab" } : undefined;
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            // FlexLayout's path for a tabset's pop out button
            path: `${this.layout.engine().get("layout-path-by", { nodeId: this.container().id })}/button/popout`,
            mode: state?.mode ?? null,
            target: state?.target ?? null,
        };
    });

    constructor() {
        const host = injectHost();
        buttonType(host);
        bindStructuralStyle(host, () =>
            this.state() ? {} : { display: "none" },
        );
    }

    protected onClick(): void {
        const nodeId = this.subject();
        const mode = this.mode();
        if (!nodeId || !mode) {
            return;
        }
        if (mode === "dock") {
            this.layout.engine().run("dock-back", { nodeId });
        } else {
            this.layout.engine().run("popout", { nodeId });
        }
    }
}

export interface TabOverflowTriggerState<T extends DockableTypes = AnyTypes> {
    /** the tabs that do not fit in the strip, in model order: what the menu lists */
    hiddenTabs: TabOf<T>[];
}

/**
 * The button that opens your menu of hidden tabs, inside `[dockableTabSet]` or `[dockableBorder]`,
 * next to the `[dockableTabList]`: `<button dockableTabOverflowTrigger
 * #overflow="dockableTabOverflowTrigger" aria-label="More tabs">`. It shows only while tabs are
 * hidden (`display: none` otherwise), and the engine reserves the space it takes in the strip. It
 * renders no menu: make it your menu's trigger, list `overflow.state().hiddenTabs` (or
 * `injectTabOverflow()`), and select with `tab.select`, which brings the tab into the strip. It
 * has no name of its own: give it an `aria-label`.
 */
@Directive({
    selector: "[dockableTabOverflowTrigger]",
    exportAs: "dockableTabOverflowTrigger",
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-count]": "data().count",
    },
})
export class DockableTabOverflowTrigger<T extends DockableTypes = AnyTypes> {
    private readonly context: DockableContext = injectDockableContext(
        "[dockableTabOverflowTrigger]",
    );
    private readonly layout = injectLayoutContext(
        "[dockableTabOverflowTrigger]",
    );
    private readonly container = injectTabContainer<T>(
        "[dockableTabOverflowTrigger]",
    );
    private readonly id = computed(() => this.container().id);
    private readonly hidden = hiddenTabsSignal(this.layout.engine, () =>
        this.id(),
    );

    /** the hidden tabs: what the menu lists */
    readonly state: Signal<TabOverflowTriggerState<T>> = computed(() => {
        const hidden = this.hidden();
        return {
            hiddenTabs: this.container().children.filter((tab) =>
                hidden.includes(tab.id),
            ),
        };
    });

    protected readonly data = computed(() => {
        // the path moves with the layout (a tabset inserted before this one): read the revision
        this.context.revision();
        const count = this.state().hiddenTabs.length;
        return {
            // FlexLayout's path for a tabset's overflow button
            path: `${this.layout.engine().get("layout-path-by", { nodeId: this.id() })}/button/overflow`,
            count: count > 0 ? String(count) : null,
        };
    });

    constructor() {
        const host = injectHost();
        buttonType(host);
        const shown = computed(() => this.state().hiddenTabs.length > 0);
        bindStructuralStyle(host, () => (shown() ? {} : { display: "none" }));
        // the engine reserves the space of a shown trigger in the strip
        effect((onCleanup) => {
            const engine = this.layout.engine();
            const id = this.id();
            if (!shown()) {
                return;
            }
            untracked(() => {
                onCleanup(
                    registerElement(
                        engine,
                        `overflowtrigger:${id}`,
                        host,
                        (registered) =>
                            engine.adapter.registerOverflowTrigger(
                                id,
                                registered,
                            ),
                    ),
                );
                this.context.scheduleMeasure(engine);
            });
        });
    }
}
