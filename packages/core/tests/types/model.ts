// Type fixtures (compiled by `pnpm typecheck`, never run): `tab.data` narrows on `tab.component`,
// and a wrong command, payload or data is a compile error.
import type { Middleware } from "../../src/commands/types";
import type { TabInitOf } from "../../src/state/json";
import { createModel, type Model } from "../../src/state/model";
import type { TabOf, TabsetNode } from "../../src/state/types";

type Types = {
    tabs: {
        editor: { name: string; path: string; dirty: boolean };
        chart: { name: string; series: string[] };
        empty: undefined;
    };
    tabset: { name?: string };
};

/** Uses values, so fixtures do not trip noUnusedLocals. */
function use(..._values: unknown[]): void {}

export function narrowing(tab: TabOf<Types>): string {
    switch (tab.component) {
        case "editor": {
            const path: string = tab.data.path;
            const dirty: boolean = tab.data.dirty;
            use(dirty);
            return path;
        }
        case "chart": {
            const series: string[] = tab.data.series;
            // @ts-expect-error: a chart's data has no path
            use(tab.data.path);
            return series.join();
        }
        case "empty": {
            const nothing: undefined = tab.data;
            return String(nothing);
        }
    }
}

export function commands(model: Model<Types>): void {
    const added = model.run("tab.add", {
        component: "chart",
        data: { name: "Sales", series: [] },
        to: "ts0",
    });
    if (added.ok) {
        const id: string = added.value.tabId;
        use(id);
    }
    // a component without data needs none
    model.run("tab.add", { component: "empty", to: "ts0" });

    model.run("tab.add", {
        component: "chart",
        // @ts-expect-error: the chart's data has no path
        data: { name: "x", path: "x" },
        to: "ts0",
    });
    // @ts-expect-error: the chart needs its data
    model.run("tab.add", { component: "chart", to: "ts0" });
    // @ts-expect-error: not a component of the registry
    model.run("tab.add", { component: "table", data: {}, to: "ts0" });
    // @ts-expect-error: not a command
    model.run("tab.nope", { tabId: "x" });
    // @ts-expect-error: tab.close takes `tabId`, not `nodeId`
    model.run("tab.close", { nodeId: "x" });
    // @ts-expect-error: a payload names its ids: `tabId`, not `tab`
    model.run("tab.close", { tab: "x" });
    const popped = model.run("tab.popout", { tabId: "x" });
    if (popped.ok) {
        const window: string = popped.value.windowId;
        use(window);
    }
    model.run("tab.update", {
        tabId: "t",
        component: "editor",
        // @ts-expect-error: tab.update checks the data against the component
        data: { name: "x", series: [] },
    });
    model.run("tab.update", {
        tabId: "t",
        component: "editor",
        data: { name: "a", path: "/a", dirty: true },
    });
    // @ts-expect-error: maximize takes an explicit value, it is not a toggle
    model.run("tabset.maximize", { tabsetId: "ts0" });

    // untrusted input is accepted as unknown and checked at runtime
    const dispatched = model.dispatch(JSON.parse("{}"));
    use(dispatched.ok);
    const allowed: boolean = model.can("tab.close", { tabId: "x" });
    use(allowed);
    // @ts-expect-error: can answers a boolean; the reason is check's
    use(model.can("tab.close", { tabId: "x" }).ok);
    const checked = model.check("tab.add", { component: "empty", to: "ts0" });
    if (checked.ok) {
        const id: string = checked.value.tabId;
        use(id);
    } else {
        use(checked.error.code);
    }
    // @ts-expect-error: check takes the command's payload
    model.check("tab.close", { tabsetId: "x" });
}

export function queries(model: Model<Types>): void {
    const node = model.get("node-by-id", { nodeId: "x" });
    // @ts-expect-error: a node can be missing
    use(node.id);
    use(node?.id);
    const name: string | undefined = model.get("active-tabset-by-layout-id")
        ?.data?.name;
    use(name);
    for (const tab of model.get("all-tabs")) {
        if (tab.component === "editor") {
            use(tab.data.path.length);
        }
    }
    const selected = model.get("selected-tab-by-tabset-id", {
        tabsetId: "ts0",
    });
    if (selected?.component === "chart") {
        const series: string[] = selected.data.series;
        use(series);
    }
    const found = model.get("node-by-id", { nodeId: "t0" });
    if (found?.type === "tab" && found.component === "editor") {
        const dirty: boolean = found.data.dirty;
        use(dirty);
    }
    const parentType: "row" | "tabset" | "border" | undefined = model.get(
        "node-parent-by-id",
        { nodeId: "t0" },
    )?.type;
    use(parentType);
    const layout: string | undefined = model.get("layout-id-by-node-id", {
        nodeId: "t0",
    });
    const closable: boolean | undefined = model.get("tab-settings-by-id", {
        tabId: "t0",
    })?.enableClose;
    const json: number = model.get("layout-json").version;
    const commands: number = model.get("commands").length;
    use(layout, closable, json, commands, model.get("layout-settings"));
    use(
        model.get("tabsets-by-layout-id", { layoutId: "w0" }),
        model.get("root-row-by-layout-id"),
    );

    // @ts-expect-error: not a query
    model.get("nope");
    // @ts-expect-error: an old key
    model.get("node", { node: "t0" });
    // @ts-expect-error: node-parent-by-id needs its payload
    model.get("node-parent-by-id");
    // @ts-expect-error: node-parent-by-id takes `nodeId`, not `tab`
    model.get("node-parent-by-id", { tab: "t0" });
    // @ts-expect-error: a tabset's selected tab is read by the tabset's id, not a container's
    model.get("selected-tab-by-tabset-id", { container: "ts0" });
    // @ts-expect-error: selected-tab-by-tabset-id answers a tab, not a tabset
    const wrong: TabsetNode<Types> | undefined = model.get(
        "selected-tab-by-tabset-id",
        {
            tabsetId: "ts0",
        },
    );
    use(wrong);

    const maximized: boolean = model.is("tabset-maximized", {
        tabsetId: "ts0",
    });
    use(maximized, model.is("node-hidden-by-maximize", { nodeId: "r0" }));
    // @ts-expect-error: not a question
    model.is("nope", { node: "x" });
    // @ts-expect-error: tabset-maximized takes a tabset's id
    model.is("tabset-maximized", { tabId: "t0" });
    // @ts-expect-error: tabset-active takes `tabsetId`, not `tabId`
    model.is("tabset-active", { tabId: "t0" });
    // @ts-expect-error: an old key
    model.is("active", { tabset: "ts0" });
    // @ts-expect-error: a question needs its payload
    model.is("tab-pinned");
}

export function detached(model: Model<Types>): void {
    // every method is bound
    const { get, is, can, check, run } = model;
    use(get("all-tabs"), is("tab-pinned", { tabId: "t" }), can, check, run);
}

export function middleware(model: Model<Types>): void {
    const guard: Middleware<Types> = (ctx, next) => {
        if (ctx.command === "tab.close" && ctx.state.maximized !== undefined) {
            return {
                ok: false,
                error: { code: "vetoed", message: "maximized" },
            };
        }
        return next();
    };
    const reads: Middleware<Types> = (ctx, next) => {
        if (ctx.command === "tab.close") {
            const tab = ctx.get("node-by-id", { nodeId: ctx.payload.tabId });
            const parentType: "row" | "tabset" | "border" | undefined = ctx.get(
                "node-parent-by-id",
                { nodeId: ctx.payload.tabId },
            )?.type;
            use(tab?.id, parentType);
            // @ts-expect-error: a middleware reads only nodes and parents
            ctx.get("all-tabs");
            // @ts-expect-error: the old key
            ctx.get("node", { node: "x" });
        }
        return next();
    };
    model.use(reads);
    const remove = model.use(guard);
    remove();
}

export function json(): void {
    createModel<Types>({
        version: 1,
        root: {
            type: "row",
            children: [
                {
                    type: "tabset",
                    data: { name: "Editors" },
                    children: [
                        {
                            component: "editor",
                            data: { name: "a", path: "/a", dirty: false },
                        },
                    ],
                },
            ],
        },
    });
    createModel<Types>({
        version: 1,
        root: {
            type: "row",
            children: [
                {
                    type: "tabset",
                    // @ts-expect-error: the editor's data is checked in JSON too
                    children: [{ component: "editor", data: { series: [] } }],
                },
            ],
        },
    });
    const init: TabInitOf<Types> = {
        component: "chart",
        data: { name: "c", series: ["a"] },
    };
    use(init);
}

// middleware: checking the command narrows the payload
export function middlewareNarrowing() {
    const model = createModel<Types>();
    model.use((ctx, next) => {
        if (ctx.command === "tab.close") {
            const tab: string = ctx.payload.tabId;
            void tab;
        } else if (ctx.command === "tab.add") {
            if (ctx.payload.component === "editor") {
                const path: string = ctx.payload.data.path;
                void path;
            }
        } else if (ctx.command === "tab.move") {
            // @ts-expect-error: a move has no component
            ctx.payload.component;
        }
        return next();
    });
}

/** `true` when `A` and `B` are the same union. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// the model's whole surface: one verb per member (a new member must be added here on purpose)
export const modelSurface: Same<
    keyof Model,
    | "state"
    | "run"
    | "dispatch"
    | "can"
    | "check"
    | "get"
    | "is"
    | "use"
    | "subscribe"
> = true;
