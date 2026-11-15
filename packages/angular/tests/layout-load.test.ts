import { Component, input } from "@angular/core";
import { createModel, type LayoutJson, type Model } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { DOCKABLE } from "../src/public-api";
import { render, settle, type Types } from "./layout";

@Component({
    imports: [DOCKABLE],
    template: `
        <div [dockableRoot]="model()">
            <div dockableBorders>
                <div dockableRow>
                    <ng-template [dockableRowChild]="model()" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node">
                                <div dockableTabList>
                                    <ng-template [dockableTabListItem]="model()" let-tab>
                                        <div [dockableTab]="tab">{{ tab.label }}</div>
                                    </ng-template>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class Replaced {
    readonly model = input.required<Model<Types>>();
}

const tab = (label: string) => ({
    component: "test" as const,
    label,
    data: { name: label },
});
const start: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        id: "root",
        children: [
            { type: "tabset", id: "primary", children: [tab("Welcome")] },
            {
                type: "row",
                id: "side",
                children: [
                    { type: "tabset", id: "top", children: [tab("Inspector")] },
                    {
                        type: "tabset",
                        id: "bottom",
                        children: [tab("Console")],
                    },
                ],
            },
        ],
    },
};

// A command that removes tabsets (`layout.load` here) changes the model before Angular destroys the
// views that render them: their parts must not throw when they read their node once more.

describe("a layout replaced by layout.load", () => {
    it("renders the new tabsets where a row and its tabsets were", async () => {
        const model = createModel<Types>(structuredClone(start));
        const fixture = await render(Replaced, { model });
        const result = model.run("layout.load", {
            layout: {
                version: 1,
                root: {
                    type: "row",
                    children: ["A", "B", "C"].map((n) => ({
                        type: "tabset",
                        children: [tab(n)],
                    })),
                },
            },
        });
        expect(result.ok).toBe(true);
        await settle(fixture);
        expect(document.querySelectorAll('[role="tab"]').length).toBe(3);
    });
});
