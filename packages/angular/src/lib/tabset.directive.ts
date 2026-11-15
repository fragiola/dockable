// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (sizing, activation on pointer down);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    computed,
    Directive,
    forwardRef,
    inject,
    input,
    type Signal,
} from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    DropLocation,
    TabContainer,
    TabsetNode,
} from "@fragiola/dockable";
import {
    DOCKABLE_TAB_CONTAINER,
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
    type TabContainerContext,
} from "./context";
import { bindMeasurable, dropStateSignal } from "./internal";
import {
    beforeInputs,
    bindStructuralStyle,
    dataAttr,
    injectHost,
    px,
} from "./utils";

export interface TabSetState {
    /** the tabset is its layout's active tabset */
    active: boolean;
    /** the tabset is maximized */
    maximized: boolean;
    /** another tabset of the layout is maximized, so this one is hidden */
    hidden: boolean;
    /** the tabset has no tabs */
    empty: boolean;
    /** the current drag would drop into or beside this tabset (its content or its strip) */
    dropTarget: boolean;
    /** while it is the drop target: where the drag would dock relative to it */
    dropLocation: DropLocation | undefined;
    /** the current drag is over this tabset, but a drop rule refuses it */
    dropRefused: boolean;
    /**
     * while the drag aims at this tabset's strip: the index among its tabs the tab would be
     * inserted at (its length for the end), else `undefined`
     */
    dropIndex: number | undefined;
}

/** A tabset's state before its input is set (see `beforeInputs`). */
const UNSET_TABSET_STATE: TabSetState = {
    active: false,
    maximized: false,
    hidden: false,
    empty: false,
    dropTarget: false,
    dropLocation: undefined,
    dropRefused: false,
    dropIndex: undefined,
};

/**
 * A tabset: `<div [dockableTabSet]="node">`, a flex item of its row, sized by its weight. Pressing
 * inside it makes it the active tabset. Put a `[dockableTabList]` and a `[dockableTabSetContent]`
 * inside.
 */
@Directive({
    selector: "[dockableTabSet]",
    exportAs: "dockableTabSet",
    providers: [
        {
            provide: DOCKABLE_TAB_CONTAINER,
            useExisting: forwardRef(() => DockableTabSet),
        },
    ],
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-active]": "data().active",
        "[attr.data-maximized]": "data().maximized",
        "[attr.data-empty]": "data().empty",
        "[attr.data-drop-target]": "data().dropTarget",
        "[attr.data-drop-location]": "data().dropLocation",
        "[attr.data-drop-refused]": "data().dropRefused",
        "(pointerdown)": "onPointerDown($event)",
    },
})
export class DockableTabSet<T extends DockableTypes = AnyTypes>
    implements TabContainerContext
{
    readonly dockableTabSet = input.required<TabsetNode<T>>();

    private readonly context: DockableContext =
        injectDockableContext("[dockableTabSet]");
    private readonly layout = injectLayoutContext("[dockableTabSet]");
    private readonly host = injectHost();

    readonly containerId: Signal<string> = computed(
        () => this.dockableTabSet().id,
    );
    private readonly drop = dropStateSignal(this.layout.engine, () =>
        this.containerId(),
    );

    /** what the tabset shows as `data-*` */
    readonly state: Signal<TabSetState> = computed(() => {
        return beforeInputs(UNSET_TABSET_STATE, () => {
            this.context.revision();
            const model = this.context.model();
            const tabsetId = this.containerId();
            const drop = this.drop();
            return {
                active: model.is("tabset-active", { tabsetId }),
                maximized: model.is("tabset-maximized", { tabsetId }),
                hidden: model.is("node-hidden-by-maximize", {
                    nodeId: tabsetId,
                }),
                empty: this.dockableTabSet().children.length === 0,
                dropTarget: drop.target,
                dropLocation: drop.location,
                dropRefused: drop.refused,
                dropIndex: drop.index,
            };
        });
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: this.layout
                .engine()
                .get("layout-path-by", { nodeId: this.containerId() }),
            active: dataAttr(state.active),
            maximized: dataAttr(state.maximized),
            empty: dataAttr(state.empty),
            dropTarget: dataAttr(state.dropTarget),
            dropLocation: dataAttr(state.dropLocation),
            dropRefused: dataAttr(state.dropRefused),
        };
    });

    constructor() {
        bindMeasurable(
            this.context,
            this.layout.engine,
            this.host,
            () => this.containerId(),
            "tabset",
        );
        bindStructuralStyle(this.host, () => {
            const state = this.state();
            const flex = this.layout
                .engine()
                .get("flex-by", { nodeId: this.containerId() });
            return {
                display: state.hidden ? "none" : "flex",
                flexDirection: "column",
                flexBasis: 0,
                flexGrow: flex.grow,
                minWidth: px(flex.minWidth),
                minHeight: px(flex.minHeight),
                maxWidth: px(flex.maxWidth),
                maxHeight: px(flex.maxHeight),
                overflow: "hidden",
            };
        });
    }

    protected onPointerDown(event: PointerEvent): void {
        this.layout
            .engine()
            .adapter.handleTabSetPointerDown(this.containerId(), event);
    }
}

/**
 * @internal the enclosing tabset or border, as a signal of its current node
 */
export function injectTabContainer<T extends DockableTypes = AnyTypes>(
    part: string,
): Signal<TabContainer<T>> {
    const container = inject(DOCKABLE_TAB_CONTAINER, { optional: true });
    const context = injectDockableContext(part);
    if (!container) {
        throw new Error(
            `${part} must be used inside [dockableTabSet] or [dockableBorder]`,
        );
    }
    // the last node found: a command that removes the container (`layout.load`, a close) changes
    // the model before the view that renders it is destroyed (a row folds away), and its parts may
    // read it once more
    let last: TabContainer<T> | undefined;
    let lastId: string | undefined;
    return computed(() => {
        context.revision();
        const node = context
            .model()
            .get("node-by", { id: container.containerId() });
        if (node?.type === "tabset" || node?.type === "border") {
            last = node as unknown as TabContainer<T>;
            lastId = node.id;
            return last;
        }
        // only for the container it was found under: another id gets its own node or the error
        if (last && container.containerId() === lastId) return last;
        throw new Error(
            `${part} must be used inside [dockableTabSet] or [dockableBorder]`,
        );
    });
}

/** @internal the enclosing tabset, as a signal of its current node */
export function injectTabSetNode(part: string): Signal<TabsetNode> {
    const container = injectTabContainer(part);
    return computed(() => {
        const node = container();
        if (node.type !== "tabset") {
            throw new Error(`${part} must be used inside [dockableTabSet]`);
        }
        return node;
    });
}
