import type {
    LayoutJson,
    Model,
    RowNode,
    TabOf,
    TabsetNode,
} from "@fragiola/dockable";
import { mount } from "@vue/test-utils";
import {
    defineComponent,
    h,
    onMounted,
    type PropType,
    ref,
    type VNodeChild,
} from "vue";
import { type RootProps, typedDockable } from "../src";

/** The registry of the fixture layouts: every tab has a name. */
export type Types = { tabs: { test: { name: string } } };

/** The primitives typed by the fixture's registry. */
export const Dockable = typedDockable<Types>();

export const twoTabsets: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    {
                        id: "t0",
                        component: "test",
                        label: "One",
                        data: { name: "One" },
                    },
                    {
                        id: "t1",
                        component: "test",
                        label: "Two",
                        data: { name: "Two" },
                    },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [
                    {
                        id: "t2",
                        component: "test",
                        label: "Three",
                        data: { name: "Three" },
                    },
                ],
            },
        ],
    },
};

/** Tab content with observable state: a counter, an input, and a mount counter. */
export const mounts = new Map<string, number>();

export const Counter = defineComponent({
    name: "TestCounter",
    props: { id: { type: String, required: true } },
    setup(props) {
        const count = ref(0);
        onMounted(() => {
            mounts.set(props.id, (mounts.get(props.id) ?? 0) + 1);
        });
        return () =>
            h("div", { "data-testid": `content-${props.id}` }, [
                h(
                    "button",
                    {
                        type: "button",
                        "data-testid": `inc-${props.id}`,
                        onClick: () => {
                            count.value++;
                        },
                    },
                    `count ${count.value}`,
                ),
                h("input", {
                    "data-testid": `input-${props.id}`,
                    "aria-label": `input ${props.id}`,
                }),
            ]);
    },
});

export function renderNode(
    child: TabsetNode<Types> | RowNode<Types>,
): VNodeChild {
    if (child.type === "tabset") {
        return h(
            Dockable.TabSet,
            { node: child },
            {
                default: () => [
                    h(Dockable.TabList, null, {
                        default: ({ tab }: { tab: TabOf<Types> }) => [
                            h(
                                Dockable.Tab,
                                { node: tab },
                                { default: () => tab.label },
                            ),
                        ],
                    }),
                    h(Dockable.TabSetContent),
                ],
            },
        );
    }
    return h(
        Dockable.Row,
        { node: child },
        {
            default: ({
                node,
            }: {
                node: TabsetNode<Types> | RowNode<Types>;
            }) => [renderNode(node)],
        },
    );
}

export function renderPanel(tab: TabOf<Types>): VNodeChild {
    return h(
        Dockable.Panel,
        { node: tab },
        { default: () => [h(Counter, { id: tab.id })] },
    );
}

export type LayoutProps = Omit<RootProps<Types>, "model"> & {
    model: Model<Types>;
    [attribute: string]: unknown;
};

/** The fixture layout: every primitive, composed with slots. */
export const Layout = defineComponent({
    name: "TestLayout",
    inheritAttrs: false,
    props: {
        model: { type: Object as PropType<Model<Types>>, required: true },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                Dockable.Root,
                { model: props.model, "data-testid": "root", ...attrs },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: ({
                                node,
                            }: {
                                node: TabsetNode<Types> | RowNode<Types>;
                            }) => [renderNode(node)],
                        }),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                renderPanel(tab),
                            ],
                        }),
                        slots.default?.(),
                    ],
                },
            );
    },
});

/** Mounts `component` (or the fixture layout with `props`) in the document, and lets it settle. */
export async function render(
    component: Parameters<typeof mount>[0],
    props: Record<string, unknown> = {},
) {
    const wrapper = mount(component, {
        props,
        attachTo: document.body.appendChild(document.createElement("div")),
    });
    await settle();
    return wrapper;
}

/** Mounts the fixture layout for `model` (attributes go on the root). */
export function renderLayout(
    model: Model<Types>,
    attrs: Record<string, unknown> = {},
    children?: () => VNodeChild,
) {
    return render(
        defineComponent({
            setup: () => () =>
                h(
                    Layout,
                    { model, ...attrs },
                    children ? { default: children } : undefined,
                ),
        }),
    );
}

/** Lets the renders, the measure cycles and the timers they schedule run. */
export async function settle() {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

/** The commands a model ran, recorded by a middleware (engine-issued and direct alike). */
export function recordCommands(
    model: Model<Types>,
): { command: string; payload: unknown; transient: boolean }[] {
    const commands: {
        command: string;
        payload: unknown;
        transient: boolean;
    }[] = [];
    model.use((ctx, next) => {
        if (!ctx.dryRun && !ctx.inBatch) {
            commands.push({
                command: ctx.command,
                payload: ctx.payload,
                transient: ctx.transient,
            });
        }
        return next();
    });
    return commands;
}
