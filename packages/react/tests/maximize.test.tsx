import { Actions, type IJsonModel, Model } from "@fragiola/dockable";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { Layout } from "./layout";

// root row: ts0 | nested row r1 (ts1 above ts2)
const json: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                weight: 60,
                children: [{ type: "tab", id: "a", name: "A" }],
            },
            {
                type: "row",
                id: "r1",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ type: "tab", id: "b", name: "B" }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [{ type: "tab", id: "c", name: "C" }],
                    },
                ],
            },
        ],
    },
};

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);

describe("maximize", () => {
    it("hides the sibling nested row of a maximized top-level tabset, and restores it", () => {
        const model = Model.fromJson(structuredClone(json));
        render(<Layout model={model} />);
        const row = path("/r1") as HTMLElement;
        expect(row.style.display).toBe("flex");
        act(() => {
            model.doAction(Actions.maximizeToggle("ts0"));
        });
        expect(row.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("flex");
        expect(path("/row")?.style.display).toBe("flex"); // the root row never hides
        act(() => {
            model.doAction(Actions.maximizeToggle("ts0"));
        });
        expect(row.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("flex");
    });

    it("keeps the ancestor rows of a maximized nested tabset", () => {
        const model = Model.fromJson(structuredClone(json));
        render(<Layout model={model} />);
        act(() => {
            model.doAction(Actions.maximizeToggle("ts2"));
        });
        expect(path("/r1")?.style.display).toBe("flex");
        expect(path("/r1/ts1")?.style.display).toBe("flex");
        expect(path("/r1/ts0")?.style.display).toBe("none");
        expect(path("/ts0")?.style.display).toBe("none");
    });
});

void React;
