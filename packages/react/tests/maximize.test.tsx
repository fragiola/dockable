import { createModel, type LayoutJson } from "@fragiola/dockable";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { Layout, type Types } from "./layout";

// root row: ts0 | nested row r1 (ts1 above ts2)
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                weight: 60,
                children: [{ id: "a", component: "test", data: { name: "A" } }],
            },
            {
                type: "row",
                id: "r1",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            { id: "b", component: "test", data: { name: "B" } },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [
                            { id: "c", component: "test", data: { name: "C" } },
                        ],
                    },
                ],
            },
        ],
    },
};

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);
const mustPath = (value: string) => {
    const element = path(value);
    if (!element) throw new Error(`no element at ${value}`);
    return element;
};

describe("maximize", () => {
    it("hides the sibling nested row of a maximized top-level tabset, and restores it", () => {
        const model = createModel<Types>(structuredClone(json));
        render(<Layout model={model} />);
        const row = mustPath("/r1");
        expect(row.style.display).toBe("flex");
        act(() => {
            model.run("tabset.maximize", { tabset: "ts0", value: true });
        });
        expect(row.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("flex");
        expect(path("/row")?.style.display).toBe("flex"); // the root row never hides
        act(() => {
            model.run("tabset.maximize", { tabset: "ts0", value: false });
        });
        expect(row.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("flex");
    });

    it("keeps the ancestor rows of a maximized nested tabset", () => {
        const model = createModel<Types>(structuredClone(json));
        render(<Layout model={model} />);
        act(() => {
            model.run("tabset.maximize", { tabset: "ts2", value: true });
        });
        expect(path("/r1")?.style.display).toBe("flex");
        expect(path("/r1/ts1")?.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("none");
    });
});

void React;
