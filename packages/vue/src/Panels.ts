// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx (renderTabContents: which tabs render);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    type TabOf,
} from "@fragiola/dockable";
import { Fragment, h } from "vue";
import { useDockableContext } from "./context";
import {
    type DockableComponent,
    definePrimitive,
    type SlotFunction,
} from "./utils/primitive";

export interface PanelsProps<T extends DockableTypes = AnyTypes> {
    /**
     * render a tab's content only once it is first shown (default `true`); `false` renders every
     * tab's content at once. A function decides per tab.
     */
    renderOnDemand?: boolean | ((tab: TabOf<T>) => boolean) | undefined;
}

export interface PanelsSlots<T extends DockableTypes = AnyTypes> {
    /** renders a tab's panel (a `Dockable.Panel`); `tab.data` narrows on `tab.component` */
    default?: SlotFunction<{ tab: TabOf<T> }>;
}

/**
 * The panel layer. Place it once, directly under `Dockable.Root` (typed with
 * `typedDockable<Types>().Panels`). It renders the default slot for every tab of every layout of
 * the model whose content should render: the selected tab once its content area has a size, a
 * tab rendered before (content is kept alive), and every tab not rendered on demand. Tabs are
 * iterated in stable id order, so Vue never reorders DOM the engine has re-parented. Renders no
 * element of its own.
 */
export const Panels: DockableComponent<PanelsProps, PanelsSlots> =
    definePrimitive<PanelsProps, PanelsSlots>(
        "Panels",
        ["renderOnDemand"],
        (props, { slots }) => {
            const {
                model: erased,
                engine,
                layers,
                revision,
            } = useDockableContext("Panels");
            const model = erased;
            return () => {
                revision.value;
                if (!layers.value.has(MAIN_LAYOUT)) {
                    return null; // the root is not attached yet: nothing can host content
                }
                const renderOnDemand = props.renderOnDemand ?? true;
                // every layout's tabs, including those whose panel layer is not mounted (yet): the
                // content of a tab moving to a window that is still opening must stay mounted
                const tabs = model
                    .get("all-tabs")
                    .filter((tab) =>
                        engine.adapter.shouldRender(
                            tab.id,
                            typeof renderOnDemand === "function"
                                ? renderOnDemand(tab)
                                : renderOnDemand,
                        ),
                    );
                tabs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
                return h(
                    Fragment,
                    tabs.map((tab) =>
                        h(Fragment, { key: tab.id }, slots.default?.({ tab })),
                    ),
                );
            };
        },
        ["renderOnDemand"],
    );
