import { Component, input, type OnInit } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createModel, type Model } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { DOCKABLE, injectModelState, injectTabSet } from "../src/public-api";
import { mustTestId } from "./helpers";
import { render, setInput, settle, type Types, twoTabsets } from "./layout";

const model = () => createModel<Types>(structuredClone(twoTabsets));

/** reads the number of tabs, counting how often its selector's answer reached the template */
@Component({
    selector: "test-count",
    template: `<span data-testid="count">{{ count() }}</span>`,
})
class Count {
    readonly count = injectModelState<Types, number>(
        (_state, m) => m.get("all-tabs").length,
    );
}

@Component({
    imports: [DOCKABLE, Count],
    template: `<div [dockableRoot]="model()"><test-count /></div>`,
})
class InRoot {
    readonly model = input.required<Model<Types>>();
}

describe("injectModelState", () => {
    it("reads the root's model, and changes with its selection", async () => {
        const m = model();
        await render(InRoot, { model: m });
        expect(mustTestId("count")).toHaveTextContent("3");
        m.run("tab.close", { tabId: "t0" });
        await settle();
        expect(mustTestId("count")).toHaveTextContent("2");
    });

    it("notifies its readers only when the selection changes (isEqual)", async () => {
        const m = model();
        const seen: string[] = [];
        @Component({
            selector: "test-selected",
            template: "",
        })
        class Selected implements OnInit {
            readonly selected = injectModelState<Types, string[]>(
                (_state, current) =>
                    current
                        .get("all-tabs")
                        .filter((tab) =>
                            current.is("tab-selected", { tabId: tab.id }),
                        )
                        .map((tab) => tab.id),
                {
                    model: m,
                    isEqual: (a, b) => a.join() === b.join(),
                },
            );
            ngOnInit() {
                seen.push(this.selected().join());
            }
        }
        const fixture = TestBed.createComponent(Selected);
        await settle(fixture);
        const first = fixture.componentInstance.selected();
        m.run("tab.rename", { tabId: "t0", label: "Renamed" });
        await settle(fixture);
        // nothing it selects changed: the same array
        expect(fixture.componentInstance.selected()).toBe(first);
        m.run("tab.select", { tabId: "t1" });
        await settle(fixture);
        expect(fixture.componentInstance.selected()).toEqual(["t1", "t2"]);
        expect(seen).toEqual(["t0,t2"]);
    });

    it("needs a [dockableRoot] or a model", () => {
        expect(() =>
            TestBed.runInInjectionContext(() => injectModelState(() => 1)()),
        ).toThrow(/dockableRoot/);
    });

    it("reads another model when its model signal changes", async () => {
        const a = model();
        const b = createModel<Types>({
            version: 1,
            root: { type: "row", children: [] },
        });
        @Component({
            selector: "test-switch",
            template: `<span data-testid="count">{{ count() }}</span>`,
        })
        class Switch {
            readonly model = input.required<Model<Types>>();
            readonly count = injectModelState<Types, number>(
                (_state, current) => current.get("all-tabs").length,
                { model: this.model },
            );
        }
        const fixture = await render(Switch, { model: a });
        expect(mustTestId("count")).toHaveTextContent("3");
        await setInput(fixture, "model", b);
        expect(mustTestId("count")).toHaveTextContent("0");
    });
});

describe("injectTabSet", () => {
    it("gives a component inside a tabset its state", async () => {
        @Component({
            selector: "test-active",
            template: `<span data-testid="active">{{ tabset.state().active }}</span>`,
        })
        class Active {
            readonly tabset = injectTabSet();
        }
        @Component({
            imports: [DOCKABLE, Active],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node">
                                    @if (node.id === "ts1") { <test-active /> }
                                    <div dockableTabSetContent></div>
                                </div>
                            }
                        </ng-template>
                    </div>
                </div>
            `,
        })
        class Host {
            readonly model = input.required<Model<Types>>();
        }
        const m = model();
        await render(Host, { model: m });
        expect(mustTestId("active")).toHaveTextContent("false");
        m.run("tabset.activate", { tabsetId: "ts1" });
        await settle();
        expect(mustTestId("active")).toHaveTextContent("true");
    });
});
