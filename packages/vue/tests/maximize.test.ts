import { createModel, type LayoutJson } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { renderLayout, settle, type Types } from "./layout";

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
                children: [
                    {
                        id: "a",
                        component: "test",
                        label: "A",
                        data: { name: "A" },
                    },
                ],
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
                            {
                                id: "b",
                                component: "test",
                                label: "B",
                                data: { name: "B" },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [
                            {
                                id: "c",
                                component: "test",
                                label: "C",
                                data: { name: "C" },
                            },
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
    it("hides the sibling nested row of a maximized top-level tabset, and restores it", async () => {
        const model = createModel<Types>(structuredClone(json));
        await renderLayout(model);
        const row = mustPath("/r1");
        expect(row.style.display).toBe("flex");
        model.run("tabset.maximize", { tabsetId: "ts0", value: true });
        await settle();
        expect(row.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("flex");
        expect(path("/row")?.style.display).toBe("flex"); // the root row never hides
        model.run("tabset.maximize", { tabsetId: "ts0", value: false });
        await settle();
        expect(row.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("flex");
    });

    it("keeps the ancestor rows of a maximized nested tabset", async () => {
        const model = createModel<Types>(structuredClone(json));
        await renderLayout(model);
        model.run("tabset.maximize", { tabsetId: "ts2", value: true });
        await settle();
        expect(path("/r1")?.style.display).toBe("flex");
        expect(path("/r1/ts1")?.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("none");
    });
});
