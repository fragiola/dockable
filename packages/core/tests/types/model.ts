// Type fixtures (compiled by `pnpm typecheck`, never run): `tab.data` narrows on `tab.component`,
// and a wrong command, payload or data is a compile error.
import type { Middleware } from "../../src/commands/types";
import type { TabInitOf } from "../../src/state/json";
import { createModel, type Model } from "../../src/state/model";
import type { TabOf } from "../../src/state/types";

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
        const id: string = added.value.tab;
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
    model.run("tab.nope", { tab: "x" });
    // @ts-expect-error: tab.close takes `tab`, not `node`
    model.run("tab.close", { node: "x" });
    model.run("tab.update", {
        tab: "t",
        component: "editor",
        // @ts-expect-error: tab.update checks the data against the component
        data: { name: "x", series: [] },
    });
    model.run("tab.update", {
        tab: "t",
        component: "editor",
        data: { name: "a", path: "/a", dirty: true },
    });
    // @ts-expect-error: maximize takes an explicit value, it is not a toggle
    model.run("tabset.maximize", { tabset: "ts0" });

    // untrusted input is accepted as unknown and checked at runtime
    const dispatched = model.dispatch(JSON.parse("{}"));
    use(dispatched.ok);
    use(model.can("tab.close", { tab: "x" }).ok);
}

export function queries(model: Model<Types>): void {
    const node = model.get("x");
    // @ts-expect-error: a node can be missing
    use(node.id);
    use(node?.id);
    const name: string | undefined = model.activeTabset()?.data?.name;
    use(name);
    for (const tab of model.tabs()) {
        if (tab.component === "editor") {
            use(tab.data.path.length);
        }
    }
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
